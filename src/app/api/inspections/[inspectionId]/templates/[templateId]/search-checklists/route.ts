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
  companyId: string | undefined
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
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    // Validate query parameter
    if (!query || query.trim().length < 3) {
      return NextResponse.json(
        { error: 'Search query must be at least 3 characters' },
        { status: 400 }
      );
    }

    const template = await getAuthorizedInspectionTemplate(
      inspectionId,
      templateId,
      currentUser.company?.toString()
    );

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Create case-insensitive regex for partial matching
    const searchRegex = new RegExp(query.trim(), 'i');
    const results: Array<{
      sectionId: string;
      sectionName: string;
      subsectionId: string;
      subsectionName: string;
      checklistId: string;
      checklistName: string;
      matchedIn: 'name' | 'comment';
    }> = [];

    // Search through sections
    const sections = (template.sections || []).filter((section: any) => !section.deletedAt);

    for (const section of sections) {
      // Search through subsections
      const subsections = (section.subsections || []).filter((subsection: any) => !subsection.deletedAt);

      for (const subsection of subsections) {
        // Search through checklists
        const checklists = subsection.checklists || [];

        for (const checklist of checklists) {
          let matchedIn: 'name' | 'comment' | null = null;

          // Check if name matches
          if (checklist.name && searchRegex.test(checklist.name)) {
            matchedIn = 'name';
          }
          // Check if comment matches (only if name didn't match)
          else if (checklist.comment && searchRegex.test(checklist.comment)) {
            matchedIn = 'comment';
          }

          // If we found a match, add to results
          if (matchedIn) {
            results.push({
              sectionId: section._id.toString(),
              sectionName: section.name,
              subsectionId: subsection._id.toString(),
              subsectionName: subsection.name,
              checklistId: checklist._id.toString(),
              checklistName: checklist.name,
              matchedIn,
            });
          }
        }
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Search checklists error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search checklists' },
      { status: 500 }
    );
  }
}
