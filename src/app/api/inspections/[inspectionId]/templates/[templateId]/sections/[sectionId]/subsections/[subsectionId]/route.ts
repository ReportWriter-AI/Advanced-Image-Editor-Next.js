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

export async function PUT(request: NextRequest, context: RouteParams) {
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
    await InspectionTemplate.updateOne(
      {
        _id: templateId,
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
    const updatedTemplate = await InspectionTemplate.findById(templateId).lean();
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
    console.error('Update inspection template subsection error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update inspection template subsection' },
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

    const { inspectionId, templateId, sectionId, subsectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(inspectionId) || !mongoose.Types.ObjectId.isValid(templateId) || !mongoose.Types.ObjectId.isValid(sectionId) || !mongoose.Types.ObjectId.isValid(subsectionId)) {
      return NextResponse.json({ error: 'Invalid inspection, template, section, or subsection ID' }, { status: 400 });
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

    // Check if subsection exists
    const subsectionExists = section.subsections?.some(
      (s: any) => s._id && s._id.toString() === subsectionId && !s.deletedAt
    );

    if (!subsectionExists) {
      return NextResponse.json({ error: 'Subsection not found' }, { status: 404 });
    }

    // Soft delete: set deletedAt field using arrayFilters
    await InspectionTemplate.updateOne(
      {
        _id: templateId,
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
    console.error('Delete inspection template subsection error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete inspection template subsection' },
      { status: 500 }
    );
  }
}
