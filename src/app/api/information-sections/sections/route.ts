import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Section from '@/src/models/Section';
import SectionChecklist from '@/src/models/SectionChecklist';
import SectionComment from '@/src/models/SectionComment';

async function dbConnect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
}

export async function GET() {
  try {
    await dbConnect();

    // Fetch all sections sorted by order_index
    const sections = await Section.find({}).sort({ order_index: 1 }).lean();
    
    if (!sections.length) {
      return NextResponse.json({ success: true, data: [] });
    }

    const sectionIds = sections.map(s => s._id);

    // Fetch all checklists and comments for these sections
    const [checklists, comments] = await Promise.all([
      SectionChecklist.find({ section_id: { $in: sectionIds } }).lean(),
      SectionComment.find({ section_id: { $in: sectionIds } }).lean(),
    ]);

    // Group checklists and comments by section_id
    const checklistMap: Record<string, any[]> = {};
    for (const cl of checklists) {
      const key = cl.section_id.toString();
      if (!checklistMap[key]) checklistMap[key] = [];
      checklistMap[key].push(cl);
    }
    
    const commentMap: Record<string, any[]> = {};
    for (const cm of comments) {
      const key = cm.section_id.toString();
      if (!commentMap[key]) commentMap[key] = [];
      commentMap[key].push(cm);
    }

    // Combine sections with their nested data
    const result = sections.map(section => ({
      ...section,
      checklists: (checklistMap[section._id.toString()] || []).sort((a, b) => a.order_index - b.order_index),
      comments: (commentMap[section._id.toString()] || []).sort((a, b) => a.order_index - b.order_index),
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('GET /api/information-sections/sections error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
