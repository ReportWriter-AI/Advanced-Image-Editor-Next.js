import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import InspectionSection from '@/src/models/InspectionSection';

type SectionInput = {
  id?: unknown;
  order_index?: unknown;
};

type SectionUpdate = {
  id: string;
  order_index: number;
};

const hasSections = (value: unknown): value is { sections: unknown } =>
  Boolean(value) && typeof value === 'object' && value !== null && 'sections' in value;

export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ error: 'No company associated with current user' }, { status: 400 });
    }

    const body = (await request.json()) as unknown;
    const sections: unknown[] =
      hasSections(body) && Array.isArray(body.sections) ? body.sections : [];

    if (!sections.length) {
      return NextResponse.json({ error: 'Sections payload is required' }, { status: 400 });
    }

    const updates: SectionUpdate[] = sections
      .filter((item): item is SectionInput & { id: string; order_index: unknown } => {
        if (!item || typeof item !== 'object') {
          return false;
        }

        const { id, order_index } = item as SectionInput;

        if (typeof id !== 'string' || !id.trim()) {
          return false;
        }

        return Number.isFinite(Number(order_index));
      })
      .map((item) => ({
        id: item.id.trim(),
        order_index: Number(item.order_index),
      }));

    if (!updates.length) {
      return NextResponse.json({ error: 'No valid sections provided for reorder' }, { status: 400 });
    }

    const ids = updates.map((u) => u.id);
    const existing = await InspectionSection.find({
      _id: { $in: ids },
      company: currentUser.company,
    })
      .select('_id')
      .lean();

    if (existing.length !== updates.length) {
      return NextResponse.json({ error: 'One or more sections are invalid' }, { status: 400 });
    }

    const now = new Date();
    const bulkOps = updates.map((u) => ({
      updateOne: {
        filter: { _id: u.id, company: currentUser.company },
        update: { $set: { order_index: u.order_index, updatedAt: now } },
      },
    }));

    await InspectionSection.bulkWrite(bulkOps);

    return NextResponse.json({ message: 'Sections reordered' });
  } catch (error: any) {
    console.error('Reorder sections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reorder sections' },
      { status: 500 }
    );
  }
}

