import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Inspection from '@/src/models/Inspection';
import InspectionTemplate from '@/src/models/InspectionTemplate';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ inspectionId: string; templateId: string }>;
}

async function getAuthorizedInspectionTemplate(
  inspectionId: string,
  templateId: string,
  companyId: string | undefined,
  includeDeleted: boolean = false
): Promise<any> {
  if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
    return null;
  }
  if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
    return null;
  }

  // Check if inspection exists and user has access
  const inspection = await Inspection.findById(inspectionId).lean();
  if (!inspection) {
    return null;
  }

  // Verify user has access to this inspection's company
  const inspectionCompanyId = (inspection as any).companyId?.toString();
  if (companyId && inspectionCompanyId !== companyId) {
    return null;
  }

  // Verify template belongs to this inspection
  const inspectionTemplateIds = (inspection as any).inspectionTemplateIds || [];
  if (!inspectionTemplateIds.some((id: any) => id.toString() === templateId)) {
    return null;
  }

  // Fetch template
  const template = await InspectionTemplate.findById(templateId).lean();
  if (!template) {
    return null;
  }

  return template;
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId, templateId } = await context.params;
    const template = await getAuthorizedInspectionTemplate(
      inspectionId,
      templateId,
      currentUser.company?.toString(),
      true
    );

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Filter out soft-deleted sections and extract only lightweight section/subsection data
    const sections = (template.sections || [])
      .filter((section: any) => !section.deletedAt)
      .map((section: any) => {
        // Extract only section fields (excluding checklists from subsections)
        const subsections = (section.subsections || [])
          .filter((subsection: any) => !subsection.deletedAt)
          .map((subsection: any) => ({
            _id: subsection._id,
            originalSubsectionId: subsection.originalSubsectionId,
            name: subsection.name,
            informationalOnly: subsection.informationalOnly,
            includeInEveryReport: subsection.includeInEveryReport,
            inspectorNotes: subsection.inspectorNotes,
            orderIndex: subsection.orderIndex,
            // Explicitly exclude checklists and other heavy data
          }));

        return {
          _id: section._id,
          originalSectionId: section.originalSectionId,
          name: section.name,
          excludeFromSummaryView: section.excludeFromSummaryView,
          includeInEveryReport: section.includeInEveryReport,
          startSectionOnNewPage: section.startSectionOnNewPage,
          sectionIcon: section.sectionIcon,
          inspectionGuidelines: section.inspectionGuidelines,
          inspectorNotes: section.inspectorNotes,
          orderIndex: section.orderIndex,
          subsections,
        };
      });

    return NextResponse.json({ sections });
  } catch (error: any) {
    console.error('Get inspection template sections and subsections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sections and subsections' },
      { status: 500 }
    );
  }
}
