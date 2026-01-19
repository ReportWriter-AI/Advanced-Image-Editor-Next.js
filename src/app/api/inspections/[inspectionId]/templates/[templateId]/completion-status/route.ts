import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Inspection from '@/src/models/Inspection';
import InspectionTemplate from '@/src/models/InspectionTemplate';
import { getCurrentUser } from '@/lib/auth-helpers';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{
    inspectionId: string;
    templateId: string;
  }>;
}

// GET /api/inspections/[inspectionId]/templates/[templateId]/completion-status
// Get completion status for all sections and subsections
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId, templateId } = await context.params;

    if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: 'Invalid inspection ID' },
        { status: 400 }
      );
    }

    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    // Check if inspection exists and user has access
    const inspection = await Inspection.findById(inspectionId).lean();
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

    // Verify template belongs to this inspection
    const inspectionTemplateIds = (inspection as any).inspectionTemplateIds || [];
    if (!inspectionTemplateIds.some((id: any) => id.toString() === templateId)) {
      return NextResponse.json(
        { error: 'Template does not belong to this inspection' },
        { status: 403 }
      );
    }

    // Fetch template
    const template = await InspectionTemplate.findById(templateId).lean();

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Build completion status map
    const completionStatus: {
      sections: {
        [sectionId: string]: {
          isComplete: boolean;
          subsections: {
            [subsectionId: string]: {
              isComplete: boolean;
              totalStatusChecklists: number;
              completedStatusChecklists: number;
            };
          };
        };
      };
    } = { sections: {} };

    const sections = (template as any).sections || [];
    
    for (const section of sections) {
      // Skip deleted sections
      if (section.deletedAt) continue;

      const sectionId = section._id.toString();
      completionStatus.sections[sectionId] = {
        isComplete: false,
        subsections: {},
      };

      const subsections = section.subsections || [];
      let completedSubsectionsCount = 0;
      let totalSubsectionsCount = 0;
      
      for (const subsection of subsections) {
        // Skip deleted subsections
        if (subsection.deletedAt) continue;

        totalSubsectionsCount++;
        const subsectionId = subsection._id.toString();
        
        const checklists = subsection.checklists || [];
        let totalStatusChecklists = 0;
        let completedStatusChecklists = 0;
        
        for (const checklist of checklists) {
          // Only count 'status' type checklists
          if (checklist.type === 'status') {
            totalStatusChecklists++;
            if (checklist.defaultChecked === true) {
              completedStatusChecklists++;
            }
          }
        }

        // Subsection is complete if it has status checklists and all are checked
        const isSubsectionComplete = totalStatusChecklists > 0 && 
                                     completedStatusChecklists === totalStatusChecklists;

        completionStatus.sections[sectionId].subsections[subsectionId] = {
          isComplete: isSubsectionComplete,
          totalStatusChecklists,
          completedStatusChecklists,
        };

        if (isSubsectionComplete) {
          completedSubsectionsCount++;
        }
      }

      // Section is complete if all its subsections are complete
      completionStatus.sections[sectionId].isComplete = 
        totalSubsectionsCount > 0 && completedSubsectionsCount === totalSubsectionsCount;
    }

    return NextResponse.json(completionStatus, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching completion status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch completion status' },
      { status: 500 }
    );
  }
}
