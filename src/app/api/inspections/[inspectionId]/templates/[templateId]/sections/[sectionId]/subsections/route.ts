import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Inspection from '@/src/models/Inspection';
import InspectionTemplate from '@/src/models/InspectionTemplate';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ inspectionId: string; templateId: string; sectionId: string }>;
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

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId, templateId, sectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(inspectionId) || !mongoose.Types.ObjectId.isValid(templateId) || !mongoose.Types.ObjectId.isValid(sectionId)) {
      return NextResponse.json({ error: 'Invalid inspection, template or section ID' }, { status: 400 });
    }

    const template = await getAuthorizedInspectionTemplate(
      inspectionId,
      templateId,
      currentUser.company?.toString(),
      true
    );

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Find the section
    const section = template.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Filter out soft-deleted subsections
    const subsections = (section.subsections || []).filter((subsection: any) => !subsection.deletedAt);

    return NextResponse.json({ subsections });
  } catch (error: any) {
    console.error('Get inspection template subsections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inspection template subsections' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId, templateId, sectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(inspectionId) || !mongoose.Types.ObjectId.isValid(templateId) || !mongoose.Types.ObjectId.isValid(sectionId)) {
      return NextResponse.json({ error: 'Invalid inspection, template or section ID' }, { status: 400 });
    }

    const template = await getAuthorizedInspectionTemplate(
      inspectionId,
      templateId,
      currentUser.company?.toString()
    );

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if section exists
    const section = template.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      informationalOnly = false,
      includeInEveryReport = true,
      inspectorNotes,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Subsection name is required' }, { status: 400 });
    }

    // Calculate orderIndex (max existing + 1)
    const existingSubsections = section.subsections || [];
    const maxOrderIndex = existingSubsections.length > 0
      ? Math.max(...existingSubsections.map((s: any) => s.orderIndex || 0))
      : -1;
    const orderIndex = maxOrderIndex + 1;

    const newSubsection = {
      name: name.trim(),
      informationalOnly,
      includeInEveryReport,
      inspectorNotes: inspectorNotes || undefined,
      orderIndex,
    };

    // Update the section with the new subsection
    await InspectionTemplate.updateOne(
      {
        _id: templateId,
        'sections._id': new mongoose.Types.ObjectId(sectionId),
      },
      {
        $push: { 'sections.$.subsections': newSubsection },
      }
    );

    // Fetch updated template to return the new subsection with _id
    const updatedTemplate = await InspectionTemplate.findById(templateId).lean();
    const updatedSection = updatedTemplate?.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );
    const addedSubsection = updatedSection?.subsections?.[updatedSection.subsections.length - 1];

    return NextResponse.json(
      { message: 'Subsection created successfully', subsection: addedSubsection },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create inspection template subsection error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create inspection template subsection' },
      { status: 500 }
    );
  }
}
