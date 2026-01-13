import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Template from '@/src/models/Template';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string; sectionId: string; subsectionId: string }>;
}

type ChecklistInput = {
  id?: unknown;
  order?: unknown;
};

type ChecklistUpdate = {
  id: string;
  order: number;
};

const hasChecklists = (value: unknown): value is { checklists: unknown } =>
  Boolean(value) && typeof value === 'object' && value !== null && 'checklists' in value;

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

    const { id, sectionId, subsectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(sectionId) || !mongoose.Types.ObjectId.isValid(subsectionId)) {
      return NextResponse.json({ error: 'Invalid template, section, or subsection ID' }, { status: 400 });
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

    // Check if subsection exists
    const subsection = section.subsections?.find(
      (s: any) => s._id && s._id.toString() === subsectionId
    );

    if (!subsection) {
      return NextResponse.json({ error: 'Subsection not found' }, { status: 404 });
    }

    const body = (await request.json()) as unknown;
    const checklists: unknown[] =
      hasChecklists(body) && Array.isArray(body.checklists) ? body.checklists : [];

    if (!checklists.length) {
      return NextResponse.json({ error: 'Checklists payload is required' }, { status: 400 });
    }

    const updates: ChecklistUpdate[] = checklists
      .filter((item): item is ChecklistInput & { id: string; order: unknown } => {
        if (!item || typeof item !== 'object') {
          return false;
        }

        const { id, order } = item as ChecklistInput;

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
      return NextResponse.json({ error: 'No valid checklists provided for reorder' }, { status: 400 });
    }

    // Validate that all checklist IDs exist in the subsection
    const existingChecklistIds = (subsection.checklists || []).map((c: any) => c._id.toString());
    const updateIds = updates.map((u) => u.id);

    const allIdsExist = updateIds.every((id) => existingChecklistIds.includes(id));
    if (!allIdsExist || updateIds.length !== existingChecklistIds.length) {
      return NextResponse.json({ error: 'One or more checklists are invalid' }, { status: 400 });
    }

    // Update each checklist's orderIndex
    const checklistsArray = subsection.checklists || [];
    updates.forEach((update) => {
      const checklist = checklistsArray.find(
        (c: any) => c._id.toString() === update.id
      );
      if (checklist) {
        checklist.orderIndex = update.order;
      }
    });

    template.updatedAt = new Date();
    await template.save();

    return NextResponse.json({ message: 'Template checklists reordered' });
  } catch (error: any) {
    console.error('Reorder template checklists error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reorder template checklists' },
      { status: 500 }
    );
  }
}
