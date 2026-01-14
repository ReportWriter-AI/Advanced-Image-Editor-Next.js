import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Template from '@/src/models/Template';
import { getAuthorizedTemplate } from '@/lib/template-helpers';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string; sectionId: string; subsectionId: string }>;
}

export async function PUT(request: NextRequest, context: RouteParams) {
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

    const template = await getAuthorizedTemplate(id, currentUser.company);

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
    const subsectionExists = section.subsections?.some(
      (s: any) => s._id && s._id.toString() === subsectionId
    );

    if (!subsectionExists) {
      return NextResponse.json({ error: 'Subsection not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      informationalOnly,
      includeInEveryReport,
      inspectorNotes,
      orderIndex,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Subsection name is required' }, { status: 400 });
    }

    // Find the existing subsection to preserve _id and orderIndex
    const existingSubsection = section.subsections?.find(
      (s: any) => s._id && s._id.toString() === subsectionId
    );

    const updatedSubsection = {
      _id: existingSubsection?._id || new mongoose.Types.ObjectId(subsectionId),
      name: name.trim(),
      informationalOnly: informationalOnly ?? false,
      includeInEveryReport: includeInEveryReport ?? true,
      inspectorNotes: inspectorNotes || undefined,
      orderIndex: orderIndex !== undefined ? orderIndex : (existingSubsection?.orderIndex ?? 0),
    };

    // Update the subsection using positional operator and arrayFilters
    await Template.updateOne(
      {
        _id: id,
        'sections._id': new mongoose.Types.ObjectId(sectionId),
      },
      {
        $set: {
          'sections.$.subsections.$[subsection]': updatedSubsection,
        },
      },
      {
        arrayFilters: [
          { 'subsection._id': new mongoose.Types.ObjectId(subsectionId) },
        ],
      }
    );

    // Fetch updated template to return the updated subsection
    const updatedTemplate = await Template.findById(id).lean();
    const updatedSection = updatedTemplate?.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );
    const updatedSubsectionData = updatedSection?.subsections?.find(
      (s: any) => s._id && s._id.toString() === subsectionId
    );

    return NextResponse.json(
      { message: 'Subsection updated successfully', subsection: updatedSubsectionData },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Update template subsection error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update template subsection' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
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

    const template = await getAuthorizedTemplate(id, currentUser.company);

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
    const subsectionExists = section.subsections?.some(
      (s: any) => s._id && s._id.toString() === subsectionId && !s.deletedAt
    );

    if (!subsectionExists) {
      return NextResponse.json({ error: 'Subsection not found' }, { status: 404 });
    }

    // Soft delete: set deletedAt field using arrayFilters
    await Template.updateOne(
      {
        _id: id,
        'sections._id': new mongoose.Types.ObjectId(sectionId),
      },
      {
        $set: {
          'sections.$[section].subsections.$[subsection].deletedAt': new Date(),
        },
      },
      {
        arrayFilters: [
          { 'section._id': new mongoose.Types.ObjectId(sectionId) },
          { 'subsection._id': new mongoose.Types.ObjectId(subsectionId) },
        ],
      }
    );

    return NextResponse.json(
      { message: 'Subsection deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete template subsection error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete template subsection' },
      { status: 500 }
    );
  }
}
