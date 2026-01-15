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

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId, templateId, sectionId, subsectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(inspectionId) || !mongoose.Types.ObjectId.isValid(templateId) || !mongoose.Types.ObjectId.isValid(sectionId) || !mongoose.Types.ObjectId.isValid(subsectionId)) {
      return NextResponse.json({ error: 'Invalid inspection, template, section, or subsection ID' }, { status: 400 });
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

    // Find the subsection
    const subsection = section.subsections?.find(
      (s: any) => s._id && s._id.toString() === subsectionId
    );

    if (!subsection) {
      return NextResponse.json({ error: 'Subsection not found' }, { status: 404 });
    }

    return NextResponse.json({ checklists: subsection.checklists || [] });
  } catch (error: any) {
    console.error('Get inspection template checklists error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inspection template checklists' },
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

    const { inspectionId, templateId, sectionId, subsectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(inspectionId) || !mongoose.Types.ObjectId.isValid(templateId) || !mongoose.Types.ObjectId.isValid(sectionId) || !mongoose.Types.ObjectId.isValid(subsectionId)) {
      return NextResponse.json({ error: 'Invalid inspection, template, section, or subsection ID' }, { status: 400 });
    }

    // Check if inspection exists and user has access
    const inspection = await Inspection.findById(inspectionId).lean();
    if (!inspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
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

    const template = await InspectionTemplate.findById(templateId);
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

    // Check if subsection exists
    const subsection = section.subsections?.find(
      (s: any) => s._id && s._id.toString() === subsectionId
    );

    if (!subsection) {
      return NextResponse.json({ error: 'Subsection not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      type,
      name,
      field,
      location,
      comment,
      defaultChecked = false,
      answerChoices,
    } = body;

    if (!type || !['status', 'information', 'defects'].includes(type)) {
      return NextResponse.json({ error: 'Checklist type is required and must be status, information, or defects' }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Checklist name is required' }, { status: 400 });
    }

    // Validate field for status type
    if (type === 'status' && !field) {
      return NextResponse.json({ error: 'Field is required for status checklist items' }, { status: 400 });
    }

    if (type === 'status' && field && !['checkbox', 'multipleAnswers', 'date', 'number', 'numberRange', 'signature'].includes(field)) {
      return NextResponse.json({ error: 'Invalid field type' }, { status: 400 });
    }

    // Calculate orderIndex (max existing + 1 for the same type)
    const existingChecklists = subsection.checklists || [];
    const checklistsOfSameType = existingChecklists.filter((c: any) => c.type === type);
    const maxOrderIndex = checklistsOfSameType.length > 0
      ? Math.max(...checklistsOfSameType.map((c: any) => c.orderIndex || 0))
      : -1;
    const orderIndex = maxOrderIndex + 1;

    const newChecklist = {
      type,
      name: name.trim(),
      field: type === 'status' ? field : undefined,
      location: type === 'status' ? (location?.trim() || undefined) : undefined,
      comment: comment || undefined,
      defaultChecked: defaultChecked ?? false,
      answerChoices: answerChoices && Array.isArray(answerChoices) ? answerChoices : undefined,
      orderIndex,
    };

    // Update the subsection with the new checklist
    await InspectionTemplate.updateOne(
      { _id: templateId, 'sections._id': new mongoose.Types.ObjectId(sectionId) },
      { $push: { 'sections.$[section].subsections.$[subsection].checklists': newChecklist } },
      {
        arrayFilters: [
          { 'section._id': new mongoose.Types.ObjectId(sectionId) },
          { 'subsection._id': new mongoose.Types.ObjectId(subsectionId) },
        ],
      }
    );

    // Fetch updated template to return the new checklist with _id
    const updatedTemplate = await InspectionTemplate.findById(templateId).lean();
    const updatedSection = updatedTemplate?.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );
    const updatedSubsection = updatedSection?.subsections?.find(
      (s: any) => s._id && s._id.toString() === subsectionId
    );
    const addedChecklist = updatedSubsection?.checklists?.[updatedSubsection.checklists.length - 1];

    return NextResponse.json(
      { message: 'Checklist created successfully', checklist: addedChecklist },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create inspection template checklist error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create inspection template checklist' },
      { status: 500 }
    );
  }
}
