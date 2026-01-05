import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import InspectionSection from '@/src/models/InspectionSection';

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

    if (!sectionId || !mongoose.isValidObjectId(sectionId) || !Array.isArray(orderedIds) || (kind !== 'status' && kind !== 'limitations')) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    // Fetch the section
    const section = await InspectionSection.findById(sectionId);
    if (!section) {
      return NextResponse.json({ success: false, error: 'Section not found' }, { status: 404 });
    }

    // Filter checklists by kind
    const checklists = section.checklists || [];
    const filteredChecklists = checklists.filter((cl: any) => {
      if (kind === 'status') return cl.type === 'status';
      if (kind === 'limitations') return cl.tab === 'limitations';
      return false;
    });

    // Get current IDs for validation
    const currentIds = filteredChecklists.map((cl: any) => cl._id.toString());

    if (currentIds.length !== orderedIds.length) {
      return NextResponse.json({ success: false, error: 'Mismatch in item count for reorder' }, { status: 400 });
    }

    // Ensure orderedIds contains exactly the same set
    const sameSet = new Set(currentIds).size === new Set(orderedIds).size && orderedIds.every((id: string) => currentIds.includes(id));
    if (!sameSet) {
      return NextResponse.json({ success: false, error: 'Ordered list does not match existing items' }, { status: 400 });
    }

    // Create a map of checklist _id to checklist object
    const checklistMap = new Map<string, any>();
    filteredChecklists.forEach((cl: any) => {
      if (cl._id) {
        checklistMap.set(cl._id.toString(), cl);
      }
    });

    // Create ordered list of checklists
    const orderedChecklists = orderedIds.map((id: string, index: number) => {
      const cl = checklistMap.get(id);
      if (!cl) return null;
      // Embedded subdocuments are already plain objects, just update order_index
      return { ...(cl.toObject ? cl.toObject() : cl), order_index: index };
    }).filter(Boolean);

    // Get the other checklists (not being reordered)
    const otherChecklists = checklists.filter((cl: any) => {
      if (kind === 'status') return cl.type !== 'status';
      if (kind === 'limitations') return cl.tab !== 'limitations';
      return false;
    });

    // Combine ordered checklists with other checklists
    section.checklists = [...orderedChecklists, ...otherChecklists] as any;
    await section.save();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('POST /api/information-sections/sections/reorder error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
