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

    // Filter out soft-deleted sections
    const sections = (template.sections || []).filter((section: any) => !section.deletedAt);

    return NextResponse.json({ sections });
  } catch (error: any) {
    console.error('Get inspection template sections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inspection template sections' },
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

    const { inspectionId, templateId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(inspectionId) || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json({ error: 'Invalid inspection or template ID' }, { status: 400 });
    }

    const template = await getAuthorizedInspectionTemplate(
      inspectionId,
      templateId,
      currentUser.company?.toString()
    );

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      excludeFromSummaryView = false,
      includeInEveryReport = false,
      startSectionOnNewPage = false,
      sectionIcon,
      inspectionGuidelines,
      inspectorNotes,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Section name is required' }, { status: 400 });
    }

    // Calculate orderIndex (max existing + 1)
    const existingSections = template.sections || [];
    const maxOrderIndex = existingSections.length > 0
      ? Math.max(...existingSections.map((s: any) => s.orderIndex || 0))
      : -1;
    const orderIndex = maxOrderIndex + 1;

    const newSection = {
      name: name.trim(),
      excludeFromSummaryView,
      includeInEveryReport,
      startSectionOnNewPage,
      sectionIcon: sectionIcon?.trim() || 'Home',
      inspectionGuidelines: inspectionGuidelines || undefined,
      inspectorNotes: inspectorNotes || undefined,
      orderIndex,
    };

    await InspectionTemplate.updateOne(
      { _id: templateId },
      { $push: { sections: newSection } }
    );

    // Fetch updated template to return the new section with _id
    const updatedTemplate = await InspectionTemplate.findById(templateId).lean();
    const addedSection = updatedTemplate?.sections?.[updatedTemplate.sections.length - 1];

    return NextResponse.json(
      { message: 'Section created successfully', section: addedSection },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create inspection template section error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create inspection template section' },
      { status: 500 }
    );
  }
}
