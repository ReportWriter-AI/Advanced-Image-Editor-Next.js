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

    // Filter to only deleted sections
    const deletedSections = (template.sections || []).filter(
      (section: any) => section.deletedAt
    );

    return NextResponse.json({ sections: deletedSections });
  } catch (error: any) {
    console.error('Get deleted inspection template sections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deleted inspection template sections' },
      { status: 500 }
    );
  }
}
