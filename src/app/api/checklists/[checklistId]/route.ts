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
  { params }: { params: { checklistId: string } }
) {
  try {
    await dbConnect();
    const { checklistId } = params;

    if (!checklistId || !mongoose.isValidObjectId(checklistId)) {
      return NextResponse.json({ success: false, error: 'Invalid checklistId' }, { status: 400 });
    }

    const body = await req.json();
    const { text, comment, type, answer_choices } = body || {};

    const updateData: any = {};
    if (text !== undefined) updateData.text = typeof text === 'string' ? text.trim() : text;
    if (comment !== undefined) updateData.comment = comment ? comment.trim() : undefined;
    if (type !== undefined && ['status', 'information'].includes(type)) updateData.type = type;
    if (answer_choices !== undefined) {
      updateData.answer_choices = Array.isArray(answer_choices) && answer_choices.length > 0 ? answer_choices : undefined;
    }

    const updated = await SectionChecklist.findByIdAndUpdate(
      checklistId,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Checklist not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    console.error('PUT /api/checklists/[checklistId] error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/checklists/[checklistId] - Delete checklist
export async function DELETE(
  req: NextRequest,
  { params }: { params: { checklistId: string } }
) {
  try {
    await dbConnect();
    const { checklistId } = params;

    if (!checklistId || !mongoose.isValidObjectId(checklistId)) {
      return NextResponse.json({ success: false, error: 'Invalid checklistId' }, { status: 400 });
    }

    const deleted = await SectionChecklist.findByIdAndDelete(checklistId);

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Checklist not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: { _id: checklistId } });
  } catch (err: any) {
    console.error('DELETE /api/checklists/[checklistId] error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
