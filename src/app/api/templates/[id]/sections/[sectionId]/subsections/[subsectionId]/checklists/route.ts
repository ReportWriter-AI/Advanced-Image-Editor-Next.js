import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Template from '@/src/models/Template';
import { getAuthorizedTemplate } from '@/lib/template-helpers';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string; sectionId: string; subsectionId: string }>;
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, sectionId, subsectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(sectionId) || !mongoose.Types.ObjectId.isValid(subsectionId)) {
      return NextResponse.json({ error: 'Invalid template, section, or subsection ID' }, { status: 400 });
    }

    const template = await getAuthorizedTemplate(id, currentUser.company, true);

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
    console.error('Get template checklists error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch template checklists' },
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

    const { id, sectionId, subsectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(sectionId) || !mongoose.Types.ObjectId.isValid(subsectionId)) {
      return NextResponse.json({ error: 'Invalid template, section, or subsection ID' }, { status: 400 });
    }

    const template = await Template.findById(id);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (currentUser.company && template.company.toString() !== currentUser.company.toString()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
    await Template.updateOne(
      { _id: id, 'sections._id': new mongoose.Types.ObjectId(sectionId) },
      { $push: { 'sections.$[section].subsections.$[subsection].checklists': newChecklist } },
      {
        arrayFilters: [
          { 'section._id': new mongoose.Types.ObjectId(sectionId) },
          { 'subsection._id': new mongoose.Types.ObjectId(subsectionId) },
        ],
      }
    );

    // Fetch updated template to return the new checklist with _id
    const updatedTemplate = await Template.findById(id).lean();
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
    console.error('Create template checklist error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create template checklist' },
      { status: 500 }
    );
  }
}
