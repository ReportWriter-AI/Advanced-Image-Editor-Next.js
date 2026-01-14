import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Template from '@/src/models/Template';
import { getAuthorizedTemplate } from '@/lib/template-helpers';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string; sectionId: string }>;
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, sectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(sectionId)) {
      return NextResponse.json({ error: 'Invalid template or section ID' }, { status: 400 });
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

    // Filter out soft-deleted subsections
    const subsections = (section.subsections || []).filter((subsection: any) => !subsection.deletedAt);

    return NextResponse.json({ subsections });
  } catch (error: any) {
    console.error('Get template subsections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch template subsections' },
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

    const { id, sectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(sectionId)) {
      return NextResponse.json({ error: 'Invalid template or section ID' }, { status: 400 });
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
    await Template.updateOne(
      { _id: id, 'sections._id': new mongoose.Types.ObjectId(sectionId) },
      { $push: { 'sections.$.subsections': newSubsection } }
    );

    // Fetch updated template to return the new subsection with _id
    const updatedTemplate = await Template.findById(id).lean();
    const updatedSection = updatedTemplate?.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );
    const addedSubsection = updatedSection?.subsections?.[updatedSection.subsections.length - 1];

    return NextResponse.json(
      { message: 'Subsection created successfully', subsection: addedSubsection },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create template subsection error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create template subsection' },
      { status: 500 }
    );
  }
}
