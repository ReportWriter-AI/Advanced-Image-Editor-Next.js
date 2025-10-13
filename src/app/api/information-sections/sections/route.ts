import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Section from '@/src/models/Section';
import SectionChecklist from '@/src/models/SectionChecklist';

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

    // Fetch all checklists for these sections (comments are now embedded)
    const checklists = await SectionChecklist.find({ section_id: { $in: sectionIds } }).lean();

    // Group checklists by section_id
    const checklistMap: Record<string, any[]> = {};
    for (const cl of checklists) {
      const key = cl.section_id.toString();
      if (!checklistMap[key]) checklistMap[key] = [];
      checklistMap[key].push(cl);
    }

    // Combine sections with their nested data
    const result = sections.map(section => ({
      ...section,
      checklists: (checklistMap[section._id.toString()] || []).sort((a, b) => a.order_index - b.order_index),
    }));

    // Ensure no caching in production to always get fresh section/checklist data
    return NextResponse.json(
      { success: true, data: result },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    console.error('GET /api/information-sections/sections error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Force this route to be dynamic and bypass any caching at the framework level
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
