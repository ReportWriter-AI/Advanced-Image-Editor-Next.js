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

// GET /api/inspections/[inspectionId]/templates/[templateId]/validate-publish
// Check if all status checklists have defaultChecked=true
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

    // Check if report is already published
    const isAlreadyPublished = (inspection as any).isReportPublished === true;

    // Count status checklists and how many are checked
    let totalStatusChecklists = 0;
    let checkedStatusChecklists = 0;

    const sections = (template as any).sections || [];
    
    for (const section of sections) {
      // Skip deleted sections
      if (section.deletedAt) continue;

      const subsections = section.subsections || [];
      
      for (const subsection of subsections) {
        // Skip deleted subsections
        if (subsection.deletedAt) continue;

        const checklists = subsection.checklists || [];
        
        for (const checklist of checklists) {
          // Only count 'status' type checklists
          if (checklist.type === 'status') {
            totalStatusChecklists++;
            if (checklist.defaultChecked === true) {
              checkedStatusChecklists++;
            }
          }
        }
      }
    }

    // Can publish if all status checklists are checked
    const canPublish = totalStatusChecklists > 0 && checkedStatusChecklists === totalStatusChecklists;

    return NextResponse.json(
      {
        canPublish,
        totalStatusChecklists,
        checkedStatusChecklists,
        isAlreadyPublished,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error validating publish status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to validate publish status' },
      { status: 500 }
    );
  }
}
