import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Template from '@/src/models/Template';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type SectionInput = {
  id?: unknown;
  order?: unknown;
};

type SectionUpdate = {
  id: string;
  order: number;
};

const hasSections = (value: unknown): value is { sections: unknown } =>
  Boolean(value) && typeof value === 'object' && value !== null && 'sections' in value;

export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ error: 'No company associated with current user' }, { status: 400 });
    }

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const template = await Template.findOne({
      _id: id,
      company: currentUser.company,
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const sections: unknown[] =
      hasSections(body) && Array.isArray(body.sections) ? body.sections : [];

    if (!sections.length) {
      return NextResponse.json({ error: 'Sections payload is required' }, { status: 400 });
    }

    const updates: SectionUpdate[] = sections
      .filter((item): item is SectionInput & { id: string; order: unknown } => {
        if (!item || typeof item !== 'object') {
          return false;
        }

        const { id, order } = item as SectionInput;

        if (typeof id !== 'string' || !id.trim()) {
          return false;
        }

        return Number.isFinite(Number(order));
      })
      .map((item) => ({
        id: item.id.trim(),
        order: Number(item.order),
      }));

    if (!updates.length) {
      return NextResponse.json({ error: 'No valid sections provided for reorder' }, { status: 400 });
    }

    // Validate that all section IDs exist in the template
    const existingSectionIds = (template.sections || []).map((s: any) => s._id.toString());
    const updateIds = updates.map((u) => u.id);

    const allIdsExist = updateIds.every((id) => existingSectionIds.includes(id));
    if (!allIdsExist || updateIds.length !== existingSectionIds.length) {
      return NextResponse.json({ error: 'One or more sections are invalid' }, { status: 400 });
    }

    // Update each section's orderIndex
    const sectionsArray = template.sections || [];
    updates.forEach((update) => {
      const section = sectionsArray.find(
        (s: any) => s._id.toString() === update.id
      );
      if (section) {
        section.orderIndex = update.order;
      }
    });

    template.updatedAt = new Date();
    await template.save();

    return NextResponse.json({ message: 'Template sections reordered' });
  } catch (error: any) {
    console.error('Reorder template sections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reorder template sections' },
      { status: 500 }
    );
  }
}
