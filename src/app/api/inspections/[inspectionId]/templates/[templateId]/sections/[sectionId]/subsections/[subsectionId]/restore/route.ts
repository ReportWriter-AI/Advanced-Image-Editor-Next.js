import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Inspection from '@/src/models/Inspection';
import InspectionTemplate from '@/src/models/InspectionTemplate';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ inspectionId: string; templateId: string; sectionId: string; subsectionId: string }>;
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

  const inspection = await Inspection.findById(inspectionId).lean();
  if (!inspection) {
    return null;
  }

  const inspectionCompanyId = (inspection as any).companyId?.toString();
  if (companyId && inspectionCompanyId !== companyId) {
    return null;
  }

  const inspectionTemplateIds = (inspection as any).inspectionTemplateIds || [];
  if (!inspectionTemplateIds.some((id: any) => id.toString() === templateId)) {
    return null;
  }

  const template = await InspectionTemplate.findById(templateId).lean();
  if (!template) {
    return null;
  }

  return template;
}

export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ error: 'No company associated with current user' }, { status: 400 });
    }

    const { inspectionId, templateId, sectionId, subsectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(inspectionId) || !mongoose.Types.ObjectId.isValid(templateId) || !mongoose.Types.ObjectId.isValid(sectionId) || !mongoose.Types.ObjectId.isValid(subsectionId)) {
      return NextResponse.json({ error: 'Invalid inspection, template, section, or subsection ID' }, { status: 400 });
    }

    // Check if subsection exists and is deleted
    const template = await getAuthorizedInspectionTemplate(
      inspectionId,
      templateId,
      currentUser.company.toString(),
      true
    );
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const section = template.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const subsection = section.subsections?.find(
      (s: any) => s._id && s._id.toString() === subsectionId && s.deletedAt
    );

    if (!subsection) {
      return NextResponse.json({ error: 'Subsection not found or not deleted' }, { status: 404 });
    }

    // Restore the subsection by setting deletedAt to null using arrayFilters
    const result = await InspectionTemplate.updateOne(
      {
        _id: templateId,
        'sections._id': new mongoose.Types.ObjectId(sectionId),
      },
      {
        $set: {
          'sections.$[section].subsections.$[subsection].deletedAt': null,
        },
      },
      {
        arrayFilters: [
          { 'section._id': new mongoose.Types.ObjectId(sectionId) },
          { 'subsection._id': new mongoose.Types.ObjectId(subsectionId) },
        ],
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Subsection not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Subsection restored successfully',
      modifiedCount: result.modifiedCount,
    });
  } catch (error: any) {
    console.error('Restore inspection template subsection error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to restore inspection template subsection' },
      { status: 500 }
    );
  }
}
