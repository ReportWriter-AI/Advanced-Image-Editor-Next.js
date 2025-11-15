import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import SectionChecklist from '@/src/models/SectionChecklist';

async function dbConnect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
}

// POST /api/information-sections/sections/reorder
// Body: { sectionId: string, kind: 'status' | 'limitations', orderedIds: string[] }
export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const body = await req.json().catch(() => ({}));
    const { sectionId, kind, orderedIds } = body || {};

    if (!sectionId || !Array.isArray(orderedIds) || (kind !== 'status' && kind !== 'limitations')) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    // Build filter based on kind
    const filter: any = { section_id: sectionId };
    if (kind === 'status') filter.type = 'status';
    if (kind === 'limitations') filter.tab = 'limitations';

    // Fetch current set for validation
    const current = await SectionChecklist.find(filter).select('_id').lean();
    const currentIds = current.map((d) => d._id.toString());

    if (currentIds.length !== orderedIds.length) {
      return NextResponse.json({ success: false, error: 'Mismatch in item count for reorder' }, { status: 400 });
    }

    // Ensure orderedIds contains exactly the same set
    const sameSet = new Set(currentIds).size === new Set(orderedIds).size && orderedIds.every((id: string) => currentIds.includes(id));
    if (!sameSet) {
      return NextResponse.json({ success: false, error: 'Ordered list does not match existing items' }, { status: 400 });
    }

    // Prepare bulk updates to set order_index sequentially
    const ops = orderedIds.map((id: string, index: number) => ({
      updateOne: {
        filter: { _id: id, section_id: sectionId },
        update: { $set: { order_index: index } },
      }
    }));

    await (SectionChecklist as any).bulkWrite(ops, { ordered: true });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('POST /api/information-sections/sections/reorder error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
