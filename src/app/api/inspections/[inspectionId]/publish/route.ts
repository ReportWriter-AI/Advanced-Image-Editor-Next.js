import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Inspection from '@/src/models/Inspection';
import InspectionTemplate from '@/src/models/InspectionTemplate';
import { getCurrentUser } from '@/lib/auth-helpers';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{
    inspectionId: string;
  }>;
}

// POST /api/inspections/[inspectionId]/publish
// Publish the report by setting isReportPublished=true
export async function POST(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId } = await context.params;

    if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: 'Invalid inspection ID' },
        { status: 400 }
      );
    }

    // Check if inspection exists and user has access
    const inspection = await Inspection.findById(inspectionId);
    if (!inspection) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this inspection's company
    const inspectionCompanyId = (inspection as any).companyId?.toString();
    const userCompanyId = currentUser.company?.toString();

    if (inspectionCompanyId !== userCompanyId) {
      return NextResponse.json(
        { error: 'Unauthorized access to this inspection' },
        { status: 403 }
      );
    }

    // If already published, return success
    if ((inspection as any).isReportPublished === true) {
      return NextResponse.json(
        {
          message: 'Report is already published',
          inspection: inspection.toObject(),
        },
        { status: 200 }
      );
    }

    // Get all templates for this inspection to validate
    const inspectionTemplateIds = (inspection as any).inspectionTemplateIds || [];
    
    if (inspectionTemplateIds.length === 0) {
      return NextResponse.json(
        { error: 'No templates found for this inspection' },
        { status: 400 }
      );
    }

    // Validate all templates - all status checklists must be checked
    for (const templateId of inspectionTemplateIds) {
      const template = await InspectionTemplate.findById(templateId).lean();
      
      if (!template) continue;

      const sections = (template as any).sections || [];
      
      for (const section of sections) {
        if (section.deletedAt) continue;

        const subsections = section.subsections || [];
        
        for (const subsection of subsections) {
          if (subsection.deletedAt) continue;

          const checklists = subsection.checklists || [];
          
          for (const checklist of checklists) {
            // Check all status checklists
            if (checklist.type === 'status' && checklist.defaultChecked !== true) {
              return NextResponse.json(
                {
                  error: 'Cannot publish: Not all status checklists are completed',
                  details: {
                    templateId: (template as any)._id.toString(),
                    templateName: (template as any).name,
                    sectionName: section.name,
                    subsectionName: subsection.name,
                    checklistName: checklist.name,
                  },
                },
                { status: 400 }
              );
            }
          }
        }
      }
    }

    // All validation passed, publish the report
    inspection.isReportPublished = true;
    await inspection.save();

    return NextResponse.json(
      {
        message: 'Report published successfully',
        inspection: inspection.toObject(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error publishing report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to publish report' },
      { status: 500 }
    );
  }
}
