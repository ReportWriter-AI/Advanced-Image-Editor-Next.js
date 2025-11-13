import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import SectionChecklist from '@/src/models/SectionChecklist';

async function dbConnect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
}

// PUT /api/checklists/[checklistId] - Update checklist
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ checklistId: string }> }
) {
  try {
    await dbConnect();
    const { checklistId } = await params;

    if (!checklistId || !mongoose.isValidObjectId(checklistId)) {
      return NextResponse.json({ success: false, error: 'Invalid checklistId' }, { status: 400 });
    }

  const body = await req.json();
  const { text, comment, type, tab, answer_choices, default_checked, default_selected_answers } = body || {};

    const updateData: any = {};
    const unsetData: any = {};
    
    if (text !== undefined) updateData.text = typeof text === 'string' ? text.trim() : text;
    
    // Handle comment: if empty, remove it from database using $unset
    if (comment !== undefined) {
      const trimmedComment = typeof comment === 'string' ? comment.trim() : comment;
      if (trimmedComment && trimmedComment.length > 0) {
        updateData.comment = trimmedComment;
      } else {
        // Comment is empty - remove it from database
        unsetData.comment = '';
      }
    }
    
    if (type !== undefined && ['status', 'information'].includes(type)) updateData.type = type;
    if (tab !== undefined && ['information', 'limitations'].includes(tab)) updateData.tab = tab;
    if (answer_choices !== undefined) {
      // If answer_choices provided as a non-empty array, set it.
      // If provided as an empty array, UNSET the field to fully remove previous options.
      if (Array.isArray(answer_choices)) {
        if (answer_choices.length > 0) {
          updateData.answer_choices = answer_choices;
        } else {
          unsetData.answer_choices = '';
        }
      }
    }
    if (default_checked !== undefined) {
      updateData.default_checked = Boolean(default_checked);
    }
    if (default_selected_answers !== undefined) {
      if (Array.isArray(default_selected_answers)) {
        if (default_selected_answers.length > 0) {
          updateData.default_selected_answers = default_selected_answers;
        } else {
          unsetData.default_selected_answers = '';
        }
      }
    }

    // Build the update object with both $set and $unset operations
    const updateOperation: any = {};
    if (Object.keys(updateData).length > 0) {
      updateOperation.$set = updateData;
    }
    if (Object.keys(unsetData).length > 0) {
      updateOperation.$unset = unsetData;
    }

    const updated = await SectionChecklist.findByIdAndUpdate(
      checklistId,
      updateOperation,
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Checklist not found' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: updated },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    console.error('PUT /api/checklists/[checklistId] error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/checklists/[checklistId] - Delete checklist
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ checklistId: string }> }
) {
  try {
    await dbConnect();
    const { checklistId } = await params;

    if (!checklistId || !mongoose.isValidObjectId(checklistId)) {
      return NextResponse.json({ success: false, error: 'Invalid checklistId' }, { status: 400 });
    }

    const deleted = await SectionChecklist.findByIdAndDelete(checklistId);

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Checklist not found' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: { _id: checklistId } },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    console.error('DELETE /api/checklists/[checklistId] error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Force this route to be dynamic and bypass any caching at the framework level
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
