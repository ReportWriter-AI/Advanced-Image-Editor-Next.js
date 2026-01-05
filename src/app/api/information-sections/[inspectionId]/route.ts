import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import InspectionInformationBlock from '@/src/models/InspectionInformationBlock';
import InspectionSection from '@/src/models/InspectionSection';
import Inspection from '@/src/models/Inspection';
import { checkAllStatusFieldsComplete } from '@/lib/status-completion-check';
import { checkAndProcessTriggers } from '@/src/lib/automation-trigger-helper';

async function dbConnect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }

  if (!mongoose.models.InspectionSection) {
    mongoose.model('InspectionSection', InspectionSection.schema);
  }
}

// GET /api/information-sections/[inspectionId]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();
    const { inspectionId } = await params;
    
    if (!inspectionId || !mongoose.isValidObjectId(inspectionId)) {
      return NextResponse.json({ success: false, error: 'Invalid inspectionId' }, { status: 400 });
    }

    let blocks = await InspectionInformationBlock.find({ inspection_id: inspectionId })
      .populate('section_id')
      .sort({ created_at: 1 })
      .lean();

    // Manually resolve checklist objects from embedded checklists array
    blocks = Array.isArray(blocks) ? blocks.map((blk: any) => {
      if (blk?.section_id && Array.isArray(blk?.selected_checklist_ids)) {
        const section = blk.section_id;
        const checklists = section.checklists || [];
        
        // Create a map of checklist _id (as string) to checklist object
        const checklistMap = new Map<string, any>();
        checklists.forEach((cl: any) => {
          if (cl._id) {
            checklistMap.set(cl._id.toString(), cl);
          }
        });
        
        // Resolve selected_checklist_ids to full checklist objects
        const resolvedChecklists = blk.selected_checklist_ids
          .map((id: string) => checklistMap.get(id))
          .filter(Boolean);
        
        // Sort by order_index
        resolvedChecklists.sort((a: any, b: any) => {
          const ao = typeof a?.order_index === 'number' ? a.order_index : Number.POSITIVE_INFINITY;
          const bo = typeof b?.order_index === 'number' ? b.order_index : Number.POSITIVE_INFINITY;
          return ao - bo;
        });
        
        blk.selected_checklist_ids = resolvedChecklists;
      }
      return blk;
    }) : blocks;

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
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();
    const { inspectionId } = await params;
    
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

    // Validate checklist IDs (now strings, not ObjectIds)
    const cleanChecklistIds = Array.isArray(selected_checklist_ids)
      ? selected_checklist_ids.filter((id: any) => typeof id === 'string' && id.trim().length > 0)
      : [];

    // Validate and clean selected_answers
    const cleanSelectedAnswers = Array.isArray(selected_answers)
      ? selected_answers
          .filter((item: any) => 
            item && 
            typeof item.checklist_id === 'string' && 
            item.checklist_id.trim().length > 0 &&
            Array.isArray(item.selected_answers)
          )
          .map((item: any) => ({
            checklist_id: item.checklist_id.trim(),
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

    // Populate and resolve checklists before returning
    const populated = await InspectionInformationBlock.findById(doc._id)
      .populate('section_id')
      .lean();
    
    // Manually resolve checklist objects from embedded checklists array
    if (populated && populated.section_id && Array.isArray(populated.selected_checklist_ids)) {
      const section = populated.section_id as any;
      const checklists = section.checklists || [];
      const checklistMap = new Map<string, any>();
      checklists.forEach((cl: any) => {
        if (cl._id) {
          checklistMap.set(cl._id.toString(), cl);
        }
      });
      const resolvedChecklists = populated.selected_checklist_ids
        .map((id: string) => checklistMap.get(id))
        .filter(Boolean)
        .sort((a: any, b: any) => {
          const ao = typeof a?.order_index === 'number' ? a.order_index : Number.POSITIVE_INFINITY;
          const bo = typeof b?.order_index === 'number' ? b.order_index : Number.POSITIVE_INFINITY;
          return ao - bo;
        });
      populated.selected_checklist_ids = resolvedChecklists as any;
    }

    try {
      const inspection = await Inspection.findById(inspectionId).lean();
      if (inspection && !inspection.isReportPublished) {
        const allComplete = await checkAllStatusFieldsComplete(inspectionId);
        if (allComplete) {
          await Inspection.findByIdAndUpdate(
            inspectionId,
            { isReportPublished: true },
            { new: true }
          );
          
          // Trigger automation when report is published
          try {
            await checkAndProcessTriggers(inspectionId, 'ANY_REPORTS_PUBLISHED');
          } catch (triggerError) {
            // Log error but don't fail the request
            console.error('Error triggering ANY_REPORTS_PUBLISHED after POST:', triggerError);
          }
        }
      }
    } catch (completionError) {
      // Log error but don't fail the request
      console.error('Error checking status completion after POST:', completionError);
    }

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
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();
    const { inspectionId } = await params;
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

    // Validate checklist IDs (now strings, not ObjectIds)
    const cleanChecklistIds = Array.isArray(selected_checklist_ids)
      ? selected_checklist_ids.filter((id: any) => typeof id === 'string' && id.trim().length > 0)
      : [];

    // Validate and clean selected_answers
    const cleanSelectedAnswers = Array.isArray(selected_answers)
      ? selected_answers
          .filter((item: any) => 
            item && 
            typeof item.checklist_id === 'string' && 
            item.checklist_id.trim().length > 0 &&
            Array.isArray(item.selected_answers)
          )
          .map((item: any) => ({
            checklist_id: item.checklist_id.trim(),
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
      .lean();

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Block not found' }, { status: 404 });
    }
    
    // Manually resolve checklist objects from embedded checklists array
    if (updated.section_id && Array.isArray(updated.selected_checklist_ids)) {
      const section = updated.section_id as any;
      const checklists = section.checklists || [];
      const checklistMap = new Map<string, any>();
      checklists.forEach((cl: any) => {
        if (cl._id) {
          checklistMap.set(cl._id.toString(), cl);
        }
      });
      const resolvedChecklists = updated.selected_checklist_ids
        .map((id: string) => checklistMap.get(id))
        .filter(Boolean)
        .sort((a: any, b: any) => {
          const ao = typeof a?.order_index === 'number' ? a.order_index : Number.POSITIVE_INFINITY;
          const bo = typeof b?.order_index === 'number' ? b.order_index : Number.POSITIVE_INFINITY;
          return ao - bo;
        });
      updated.selected_checklist_ids = resolvedChecklists as any;
    }

    // Check if all status fields are complete and update isReportPublished if needed
    try {
      const inspection = await Inspection.findById(inspectionId).lean();
      // Only check and update if isReportPublished is not already true
      if (inspection && !inspection.isReportPublished) {
        const allComplete = await checkAllStatusFieldsComplete(inspectionId);
        if (allComplete) {
          await Inspection.findByIdAndUpdate(
            inspectionId,
            { isReportPublished: true },
            { new: true }
          );
          
          // Trigger automation when report is published
          try {
            await checkAndProcessTriggers(inspectionId, 'ANY_REPORTS_PUBLISHED');
          } catch (triggerError) {
            // Log error but don't fail the request
            console.error('Error triggering ANY_REPORTS_PUBLISHED after PUT:', triggerError);
          }
        }
      }
    } catch (completionError) {
      // Log error but don't fail the request
      console.error('Error checking status completion after PUT:', completionError);
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
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();
    const { inspectionId } = await params;
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
