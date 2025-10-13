import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import SectionChecklist from '@/src/models/SectionChecklist';

async function dbConnect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
}

// POST /api/checklists - Create new checklist
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const body = await req.json();
    const { section_id, text, comment, type, tab, order_index, answer_choices } = body || {};

    if (!section_id || !mongoose.isValidObjectId(section_id)) {
      return NextResponse.json({ success: false, error: 'Valid section_id is required' }, { status: 400 });
    }

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ success: false, error: 'text is required' }, { status: 400 });
    }

    if (!type || !['status', 'information'].includes(type)) {
      return NextResponse.json({ success: false, error: 'type must be status or information' }, { status: 400 });
    }

    // Get the highest order_index for this section
    let maxOrder = 0;
    if (order_index === undefined) {
      const maxDoc = await SectionChecklist.findOne({ section_id })
        .sort({ order_index: -1 })
        .select('order_index')
        .lean();
      maxOrder = maxDoc?.order_index ?? -1;
    }

    const checklist = await SectionChecklist.create({
      section_id,
      text: text.trim(),
      comment: comment ? comment.trim() : undefined,
      type,
      tab: tab || 'information', // Add tab field with default
      order_index: order_index ?? maxOrder + 1,
      answer_choices: Array.isArray(answer_choices) && answer_choices.length > 0 ? answer_choices : undefined,
    });

    return NextResponse.json({ success: true, data: checklist }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/checklists error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
