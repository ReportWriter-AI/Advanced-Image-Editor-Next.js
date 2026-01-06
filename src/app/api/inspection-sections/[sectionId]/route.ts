import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import InspectionSection from '@/src/models/InspectionSection';

interface RouteParams {
  params: Promise<{
    sectionId: string;
  }>;
}

async function getAuthorizedSection(
  sectionId: string,
  companyId?: mongoose.Types.ObjectId
) {
  if (!companyId || !mongoose.Types.ObjectId.isValid(sectionId)) {
    return null;
  }

  const section = await InspectionSection.findById(sectionId);
  if (!section || !section.company?.equals(companyId)) {
    return null;
  }

  return section;
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sectionId } = await context.params;
    const section = await getAuthorizedSection(sectionId, currentUser.company);
    if (!section) {
      return NextResponse.json({ error: 'Inspection section not found' }, { status: 404 });
    }

    return NextResponse.json({ section: section.toObject() });
  } catch (error: any) {
    console.error('Get inspection section error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inspection section' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sectionId } = await context.params;
    const section = await getAuthorizedSection(sectionId, currentUser.company);
    if (!section) {
      return NextResponse.json({ error: 'Inspection section not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, checklists } = body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Section name is required' }, { status: 400 });
      }
      section.name = name.trim();
    }

    if (checklists !== undefined) {
      if (!Array.isArray(checklists)) {
        return NextResponse.json({ error: 'Checklists must be an array' }, { status: 400 });
      }

      // Create a map of existing checklists by _id (as string) for efficient lookup
      const existingChecklistsMap = new Map<string, any>();
      section.checklists.forEach((cl: any) => {
        if (cl._id) {
          existingChecklistsMap.set(cl._id.toString(), cl);
        }
      });

      // Build the updated checklists array, preserving IDs where possible
      const updatedChecklists: any[] = [];
      const processedIds = new Set<string>();

      checklists.forEach((item: any, index: number) => {
        const checklistId = item._id ? String(item._id) : null;
        
        if (checklistId && existingChecklistsMap.has(checklistId)) {
          // Update existing checklist in-place to preserve its _id
          const existingChecklist = existingChecklistsMap.get(checklistId);
          existingChecklist.text = item.text || '';
          existingChecklist.comment = item.comment || undefined;
          existingChecklist.type = (item.type === 'status' ? 'status' : 'information') as 'status' | 'information';
          existingChecklist.answer_choices = Array.isArray(item.answer_choices) && item.answer_choices.length > 0 ? item.answer_choices : undefined;
          existingChecklist.default_checked = Boolean(item.default_checked);
          existingChecklist.default_selected_answers = Array.isArray(item.default_selected_answers) && item.default_selected_answers.length > 0 ? item.default_selected_answers : undefined;
          existingChecklist.order_index = typeof item.order_index === 'number' ? item.order_index : index;
          
          updatedChecklists.push(existingChecklist);
          processedIds.add(checklistId);
        } else {
          // Create new checklist (Mongoose will generate new _id)
          updatedChecklists.push({
            text: item.text || '',
            comment: item.comment || undefined,
            type: (item.type === 'status' ? 'status' : 'information') as 'status' | 'information',
            answer_choices: Array.isArray(item.answer_choices) && item.answer_choices.length > 0 ? item.answer_choices : undefined,
            default_checked: Boolean(item.default_checked),
            default_selected_answers: Array.isArray(item.default_selected_answers) && item.default_selected_answers.length > 0 ? item.default_selected_answers : undefined,
            order_index: typeof item.order_index === 'number' ? item.order_index : index,
          });
        }
      });

      // Replace the entire array (Mongoose will preserve _id for existing subdocuments)
      section.checklists = updatedChecklists;
    }

    const updated = await section.save();

    return NextResponse.json({
      message: 'Inspection section updated successfully',
      section: updated.toObject(),
    });
  } catch (error: any) {
    console.error('Update inspection section error:', error);
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: 'A section with this name already exists for your company' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update inspection section' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sectionId } = await context.params;
    const section = await getAuthorizedSection(sectionId, currentUser.company);
    if (!section) {
      return NextResponse.json({ error: 'Inspection section not found' }, { status: 404 });
    }

    await section.deleteOne();

    return NextResponse.json({ message: 'Inspection section deleted successfully' });
  } catch (error: any) {
    console.error('Delete inspection section error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete inspection section' },
      { status: 500 }
    );
  }
}

