import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Template from '@/src/models/Template';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string; sectionId: string }>;
}

type SubsectionInput = {
  id?: unknown;
  order?: unknown;
};

type SubsectionUpdate = {
  id: string;
  order: number;
};

const hasSubsections = (value: unknown): value is { subsections: unknown } =>
  Boolean(value) && typeof value === 'object' && value !== null && 'subsections' in value;

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

    const { id, sectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(sectionId)) {
      return NextResponse.json({ error: 'Invalid template or section ID' }, { status: 400 });
    }

    const template = await Template.findOne({
      _id: id,
      company: currentUser.company,
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if section exists
    const section = template.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const subsections: unknown[] =
      hasSubsections(body) && Array.isArray(body.subsections) ? body.subsections : [];

    if (!subsections.length) {
      return NextResponse.json({ error: 'Subsections payload is required' }, { status: 400 });
    }

    const updates: SubsectionUpdate[] = subsections
      .filter((item): item is SubsectionInput & { id: string; order: unknown } => {
        if (!item || typeof item !== 'object') {
          return false;
        }

        const { id, order } = item as SubsectionInput;

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
      return NextResponse.json({ error: 'No valid subsections provided for reorder' }, { status: 400 });
    }

    // Validate that all subsection IDs exist in the section
    const existingSubsectionIds = (section.subsections || []).map((s: any) => s._id.toString());
    const updateIds = updates.map((u) => u.id);

    const allIdsExist = updateIds.every((id) => existingSubsectionIds.includes(id));
    if (!allIdsExist || updateIds.length !== existingSubsectionIds.length) {
      return NextResponse.json({ error: 'One or more subsections are invalid' }, { status: 400 });
    }

    // Update each subsection's orderIndex
    const subsectionsArray = section.subsections || [];
    updates.forEach((update) => {
      const subsection = subsectionsArray.find(
        (s: any) => s._id.toString() === update.id
      );
      if (subsection) {
        subsection.orderIndex = update.order;
      }
    });

    template.updatedAt = new Date();
    await template.save();

    return NextResponse.json({ message: 'Template subsections reordered' });
  } catch (error: any) {
    console.error('Reorder template subsections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reorder template subsections' },
      { status: 500 }
    );
  }
}
