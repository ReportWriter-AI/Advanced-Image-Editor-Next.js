import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import InspectionInformationBlock from '@/src/models/InspectionInformationBlock';

async function dbConnect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
}

// GET /api/information-sections/[inspectionId]
export async function GET(
  _req: NextRequest,
  { params }: { params: { inspectionId: string } }
) {
  try {
    await dbConnect();
    const { inspectionId } = params;
    
    if (!inspectionId || !mongoose.isValidObjectId(inspectionId)) {
      return NextResponse.json({ success: false, error: 'Invalid inspectionId' }, { status: 400 });
    }

    const blocks = await InspectionInformationBlock.find({ inspection_id: inspectionId })
      .populate('section_id')
      .populate('selected_checklist_ids')
      .populate('selected_comment_ids')
      .sort({ created_at: 1 })
      .lean();

    return NextResponse.json({ success: true, data: blocks });
  } catch (err: any) {
    console.error('GET /api/information-sections/[inspectionId] error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// POST /api/information-sections/[inspectionId]
export async function POST(
  req: NextRequest,
  { params }: { params: { inspectionId: string } }
) {
  try {
    await dbConnect();
    const { inspectionId } = params;
    
    if (!inspectionId || !mongoose.isValidObjectId(inspectionId)) {
      return NextResponse.json({ success: false, error: 'Invalid inspectionId' }, { status: 400 });
    }

    const body = await req.json();
    const {
      section_id,
      selected_checklist_ids = [],
      selected_comment_ids = [],
      custom_text = '',
      images = [],
    } = body || {};

    if (!section_id || !mongoose.isValidObjectId(section_id)) {
      return NextResponse.json({ success: false, error: 'section_id is required and must be valid' }, { status: 400 });
    }

    // Validate checklist and comment IDs
    const cleanChecklistIds = Array.isArray(selected_checklist_ids)
      ? selected_checklist_ids.filter((id: string) => mongoose.isValidObjectId(id))
      : [];
    
    const cleanCommentIds = Array.isArray(selected_comment_ids)
      ? selected_comment_ids.filter((id: string) => mongoose.isValidObjectId(id))
      : [];

    // Validate images array
    const cleanImages = Array.isArray(images)
      ? images
          .map((img: any) => ({
            url: typeof img?.url === 'string' ? img.url : '',
            annotations: typeof img?.annotations === 'string' ? img.annotations : undefined,
          }))
          .filter(i => i.url)
      : [];

    // Create information block
    const doc = await InspectionInformationBlock.create({
      inspection_id: inspectionId,
      section_id,
      selected_checklist_ids: cleanChecklistIds,
      selected_comment_ids: cleanCommentIds,
      custom_text: typeof custom_text === 'string' ? custom_text : '',
      images: cleanImages,
    });

    // Populate before returning
    const populated = await InspectionInformationBlock.findById(doc._id)
      .populate('section_id')
      .populate('selected_checklist_ids')
      .populate('selected_comment_ids')
      .lean();

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (err: any) {
    console.error('POST /api/information-sections/[inspectionId] error:', err);
    
    // Handle duplicate constraint (inspection_id + section_id unique)
    if (err?.code === 11000) {
      return NextResponse.json(
        { success: false, error: 'Information block for this inspection and section already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
