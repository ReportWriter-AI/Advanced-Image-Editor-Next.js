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

export async function PUT(request: NextRequest, context: RouteParams) {
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
    const sectionExists = template.sections?.some(
      (s: any) => s._id && s._id.toString() === sectionId
    );

    if (!sectionExists) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      excludeFromSummaryView,
      includeInEveryReport,
      startSectionOnNewPage,
      sectionIcon,
      inspectionGuidelines,
      inspectorNotes,
      orderIndex,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Section name is required' }, { status: 400 });
    }

    // Find the existing section to preserve _id and orderIndex
    const existingSection = template.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );

    const updatedSection = {
      _id: existingSection?._id || new mongoose.Types.ObjectId(sectionId),
      name: name.trim(),
      excludeFromSummaryView: excludeFromSummaryView ?? false,
      includeInEveryReport: includeInEveryReport ?? false,
      startSectionOnNewPage: startSectionOnNewPage ?? false,
      sectionIcon: sectionIcon?.trim() || 'Home',
      inspectionGuidelines: inspectionGuidelines || undefined,
      inspectorNotes: inspectorNotes || undefined,
      orderIndex: orderIndex !== undefined ? orderIndex : (existingSection?.orderIndex ?? 0),
    };

    // Update the section using positional operator
    await InspectionTemplate.updateOne(
      { _id: templateId, 'sections._id': new mongoose.Types.ObjectId(sectionId) },
      { $set: { 'sections.$': updatedSection } }
    );

    // Fetch updated template to return the updated section
    const updatedTemplate = await InspectionTemplate.findById(templateId).lean();
    const updatedSectionData = updatedTemplate?.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );

    return NextResponse.json(
      { message: 'Section updated successfully', section: updatedSectionData },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Update inspection template section error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update inspection template section' },
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
    const sectionExists = template.sections?.some(
      (s: any) => s._id && s._id.toString() === sectionId && !s.deletedAt
    );

    if (!sectionExists) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Soft delete: set deletedAt field using positional operator
    await InspectionTemplate.updateOne(
      { _id: templateId, 'sections._id': new mongoose.Types.ObjectId(sectionId) },
      { $set: { 'sections.$.deletedAt': new Date() } }
    );

    return NextResponse.json(
      { message: 'Section deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete inspection template section error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete inspection template section' },
      { status: 500 }
    );
  }
}
