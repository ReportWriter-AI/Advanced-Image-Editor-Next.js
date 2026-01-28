import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Inspection from '@/src/models/Inspection';
import { getCurrentUser } from '@/lib/auth-helpers';
import { getCompletionStatus } from '@/lib/report-completion';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{
    inspectionId: string;
    templateId: string;
  }>;
}

// GET /api/inspections/[inspectionId]/templates/[templateId]/validate-publish
// Can publish when all sections complete (checklist + no flagged defects)
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

    const isAlreadyPublished = (inspection as any).isReportPublished === true;
    const completionStatus = await getCompletionStatus(inspectionId, templateId);

    // Can publish when not already published and every section is complete
    let allSectionsComplete = true;
    let totalStatusChecklists = 0;
    let checkedStatusChecklists = 0;

    for (const sectionId of Object.keys(completionStatus.sections)) {
      const section = completionStatus.sections[sectionId];
      if (!section.isComplete) allSectionsComplete = false;
      for (const subsectionId of Object.keys(section.subsections)) {
        const sub = section.subsections[subsectionId];
        totalStatusChecklists += sub.totalStatusChecklists;
        checkedStatusChecklists += sub.completedStatusChecklists;
      }
    }

    const canPublish = !isAlreadyPublished && allSectionsComplete;

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
