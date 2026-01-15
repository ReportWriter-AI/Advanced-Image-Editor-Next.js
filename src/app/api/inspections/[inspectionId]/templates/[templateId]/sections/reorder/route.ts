import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Inspection from '@/src/models/Inspection';
import InspectionTemplate from '@/src/models/InspectionTemplate';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ inspectionId: string; templateId: string }>;
}

type SectionInput = {
  id?: unknown;
  order?: unknown;
};

type SectionUpdate = {
  id: string;
  order: number;
};

const hasSections = (value: unknown): value is { sections: unknown } =>
  Boolean(value) && typeof value === 'object' && value !== null && 'sections' in value;

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

    const { inspectionId, templateId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(inspectionId) || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json({ error: 'Invalid inspection or template ID' }, { status: 400 });
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

    const body = (await request.json()) as unknown;
    const sections: unknown[] =
      hasSections(body) && Array.isArray(body.sections) ? body.sections : [];

    if (!sections.length) {
      return NextResponse.json({ error: 'Sections payload is required' }, { status: 400 });
    }

    const updates: SectionUpdate[] = sections
      .filter((item): item is SectionInput & { id: string; order: unknown } => {
        if (!item || typeof item !== 'object') {
          return false;
        }

        const { id, order } = item as SectionInput;

        if (typeof id !== 'string' || !id.trim()) {
          return false;
        }

        return Number.isFinite(Number(order));
      })
      .map((item) => ({
        id: item.id.trim(),
        order: Number(item.order),
      }));

    if (!updates.length) {
      return NextResponse.json({ error: 'No valid sections provided for reorder' }, { status: 400 });
    }

    // Validate that all section IDs exist in the template
    const existingSectionIds = (template.sections || []).map((s: any) => s._id.toString());
    const updateIds = updates.map((u) => u.id);

    const allIdsExist = updateIds.every((id) => existingSectionIds.includes(id));
    if (!allIdsExist || updateIds.length !== existingSectionIds.length) {
      return NextResponse.json({ error: 'One or more sections are invalid' }, { status: 400 });
    }

    // Update each section's orderIndex
    const sectionsArray = template.sections || [];
    updates.forEach((update) => {
      const section = sectionsArray.find(
        (s: any) => s._id.toString() === update.id
      );
      if (section) {
        section.orderIndex = update.order;
      }
    });

    template.updatedAt = new Date();
    await template.save();

    return NextResponse.json({ message: 'Inspection template sections reordered' });
  } catch (error: any) {
    console.error('Reorder inspection template sections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reorder inspection template sections' },
      { status: 500 }
    );
  }
}
