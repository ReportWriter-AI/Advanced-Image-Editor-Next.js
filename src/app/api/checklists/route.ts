import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import InspectionSection from '@/src/models/InspectionSection';

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
    const { section_id, text, comment, type, order_index, answer_choices, default_checked, default_selected_answers } = body || {};

    if (!section_id || !mongoose.isValidObjectId(section_id)) {
      return NextResponse.json({ success: false, error: 'Valid section_id is required' }, { status: 400 });
    }

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ success: false, error: 'text is required' }, { status: 400 });
    }

    if (!type || !['status', 'information'].includes(type)) {
      return NextResponse.json({ success: false, error: 'type must be status or information' }, { status: 400 });
    }

    // Find the section
    const section = await InspectionSection.findById(section_id);
    if (!section) {
      return NextResponse.json({ success: false, error: 'Section not found' }, { status: 404 });
    }

    // Get the highest order_index for this section's checklists
    let maxOrder = -1;
    if (order_index === undefined) {
      const checklists = section.checklists || [];
      if (checklists.length > 0) {
        maxOrder = Math.max(...checklists.map((cl: any) => cl.order_index || -1));
      }
    }

    // Create new checklist object
    const newChecklist: any = {
      text: text.trim(),
      comment: comment ? comment.trim() : undefined,
      type,
      order_index: order_index ?? maxOrder + 1,
      answer_choices: Array.isArray(answer_choices) && answer_choices.length > 0 ? answer_choices : undefined,
      default_checked: typeof default_checked === 'boolean' ? default_checked : false,
      default_selected_answers: Array.isArray(default_selected_answers) && default_selected_answers.length > 0 ? default_selected_answers : undefined,
    };

    // Add to embedded checklists array
    section.checklists.push(newChecklist as any);
    await section.save();

    // Get the newly created checklist (last one in array)
    const createdChecklist = section.checklists[section.checklists.length - 1];

    return NextResponse.json({ success: true, data: createdChecklist }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/checklists error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
