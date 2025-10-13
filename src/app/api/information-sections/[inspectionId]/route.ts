import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import InspectionInformationBlock from '@/src/models/InspectionInformationBlock';
// Import Section and SectionChecklist models to ensure they're registered before populate
import Section from '@/src/models/Section';
import SectionChecklist from '@/src/models/SectionChecklist';

async function dbConnect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
  // Ensure models are registered (this forces them to be loaded)
  if (!mongoose.models.Section) {
    mongoose.model('Section', Section.schema);
  }
  if (!mongoose.models.SectionChecklist) {
    mongoose.model('SectionChecklist', SectionChecklist.schema);
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
      .sort({ created_at: 1 })
      .lean();

    return NextResponse.json(
      { success: true, data: blocks },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
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
      selected_answers = [],
      custom_text = '',
      images = [],
    } = body || {};

    console.log('📥 POST - Received data:', {
      section_id,
      selected_checklist_ids,
      selected_answers,
      custom_text,
      images,
      imageCount: images.length
    });

    if (!section_id || !mongoose.isValidObjectId(section_id)) {
      return NextResponse.json({ success: false, error: 'section_id is required and must be valid' }, { status: 400 });
    }

    // Validate checklist IDs
    const cleanChecklistIds = Array.isArray(selected_checklist_ids)
      ? selected_checklist_ids.filter((id: string) => mongoose.isValidObjectId(id))
      : [];

    // Validate and clean selected_answers
    const cleanSelectedAnswers = Array.isArray(selected_answers)
      ? selected_answers
          .filter((item: any) => 
            item && 
            typeof item.checklist_id === 'string' && 
            mongoose.isValidObjectId(item.checklist_id) &&
            Array.isArray(item.selected_answers)
          )
          .map((item: any) => ({
            checklist_id: item.checklist_id,
            selected_answers: item.selected_answers.filter((ans: any) => typeof ans === 'string')
          }))
      : [];

    // Validate images array
    const cleanImages = Array.isArray(images)
      ? images
          .map((img: any) => ({
            url: typeof img?.url === 'string' ? img.url : '',
            annotations: typeof img?.annotations === 'string' ? img.annotations : undefined,
            checklist_id: typeof img?.checklist_id === 'string' ? img.checklist_id : undefined,
            location: typeof img?.location === 'string' ? img.location : undefined,
            isThreeSixty: typeof img?.isThreeSixty === 'boolean' ? img.isThreeSixty : false, // Include 360° flag
          }))
          .filter(i => i.url)
      : [];

    console.log('✅ POST - Clean images after validation:', cleanImages);
    console.log('🔍 POST - Images with 360° flag:', cleanImages.filter((img: any) => img.isThreeSixty));

    // Create information block
    const doc = await InspectionInformationBlock.create({
      inspection_id: inspectionId,
      section_id,
      selected_checklist_ids: cleanChecklistIds,
      selected_answers: cleanSelectedAnswers,
      custom_text: typeof custom_text === 'string' ? custom_text : '',
      images: cleanImages,
    });

    // Populate before returning
    const populated = await InspectionInformationBlock.findById(doc._id)
      .populate('section_id')
      .populate('selected_checklist_ids')
      .lean();

    return NextResponse.json(
      { success: true, data: populated },
      {
        status: 201,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
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

// PUT /api/information-sections/[inspectionId]?blockId=xxx
export async function PUT(
  req: NextRequest,
  { params }: { params: { inspectionId: string } }
) {
  try {
    await dbConnect();
    const { inspectionId } = params;
    const { searchParams } = new URL(req.url);
    const blockId = searchParams.get('blockId');
    
    if (!inspectionId || !mongoose.isValidObjectId(inspectionId)) {
      return NextResponse.json({ success: false, error: 'Invalid inspectionId' }, { status: 400 });
    }
    
    if (!blockId || !mongoose.isValidObjectId(blockId)) {
      return NextResponse.json({ success: false, error: 'Invalid blockId' }, { status: 400 });
    }

    const body = await req.json();
    const {
      selected_checklist_ids = [],
      selected_answers = [],
      custom_text = '',
      images = [],
    } = body || {};

    console.log('📥 PUT - Received data:', {
      blockId,
      selected_checklist_ids,
      selected_answers,
      custom_text,
      images,
      imageCount: images.length
    });

    // Validate checklist IDs
    const cleanChecklistIds = Array.isArray(selected_checklist_ids)
      ? selected_checklist_ids.filter((id: string) => mongoose.isValidObjectId(id))
      : [];

    // Validate and clean selected_answers
    const cleanSelectedAnswers = Array.isArray(selected_answers)
      ? selected_answers
          .filter((item: any) => 
            item && 
            typeof item.checklist_id === 'string' && 
            mongoose.isValidObjectId(item.checklist_id) &&
            Array.isArray(item.selected_answers)
          )
          .map((item: any) => ({
            checklist_id: item.checklist_id,
            selected_answers: item.selected_answers.filter((ans: any) => typeof ans === 'string')
          }))
      : [];

    // Validate images array
    const cleanImages = Array.isArray(images)
      ? images
          .map((img: any) => ({
            url: typeof img?.url === 'string' ? img.url : '',
            annotations: typeof img?.annotations === 'string' ? img.annotations : undefined,
            checklist_id: typeof img?.checklist_id === 'string' ? img.checklist_id : undefined,
            location: typeof img?.location === 'string' ? img.location : undefined,
            isThreeSixty: typeof img?.isThreeSixty === 'boolean' ? img.isThreeSixty : false, // Include 360° flag
          }))
          .filter(i => i.url)
      : [];

    console.log('✅ PUT - Clean images after validation:', cleanImages);
    console.log('🔍 PUT - Images with 360° flag:', cleanImages.filter((img: any) => img.isThreeSixty));

    // Update information block
    const updated = await InspectionInformationBlock.findOneAndUpdate(
      { _id: blockId, inspection_id: inspectionId },
      {
        selected_checklist_ids: cleanChecklistIds,
        selected_answers: cleanSelectedAnswers,
        custom_text: typeof custom_text === 'string' ? custom_text : '',
        images: cleanImages,
      },
      { new: true }
    )
      .populate('section_id')
      .populate('selected_checklist_ids')
      .lean();

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Block not found' }, { status: 404 });
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
    console.error('PUT /api/information-sections/[inspectionId] error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE /api/information-sections/[inspectionId]?blockId=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: { inspectionId: string } }
) {
  try {
    await dbConnect();
    const { inspectionId } = params;
    const { searchParams } = new URL(req.url);
    const blockId = searchParams.get('blockId');
    
    if (!inspectionId || !mongoose.isValidObjectId(inspectionId)) {
      return NextResponse.json({ success: false, error: 'Invalid inspectionId' }, { status: 400 });
    }
    
    if (!blockId || !mongoose.isValidObjectId(blockId)) {
      return NextResponse.json({ success: false, error: 'Invalid blockId' }, { status: 400 });
    }

    const deleted = await InspectionInformationBlock.findOneAndDelete({
      _id: blockId,
      inspection_id: inspectionId,
    });

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Block not found' }, { status: 404 });
    }

    return NextResponse.json(
      { success: true, data: { _id: blockId } },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    console.error('DELETE /api/information-sections/[inspectionId] error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// Force this route to be dynamic and bypass any caching at the framework level
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
