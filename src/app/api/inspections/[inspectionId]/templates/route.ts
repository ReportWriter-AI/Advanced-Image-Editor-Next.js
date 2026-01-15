import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Inspection from '@/src/models/Inspection';
import InspectionTemplate from '@/src/models/InspectionTemplate';
import { getCurrentUser } from '@/lib/auth-helpers';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{
    inspectionId: string;
  }>;
}

// GET /api/inspections/[inspectionId]/templates - Get all templates for an inspection
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId } = await context.params;

    if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: 'Invalid inspection ID' },
        { status: 400 }
      );
    }

    // Check if inspection exists and user has access
    const inspection = await Inspection.findById(inspectionId).lean();
    if (!inspection) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
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

    // Get inspection template IDs
    const inspectionTemplateIds = (inspection as any).inspectionTemplateIds || [];

    if (inspectionTemplateIds.length === 0) {
      return NextResponse.json({ templates: [] }, { status: 200 });
    }

    // Fetch all templates
    const templates = await InspectionTemplate.find({
      _id: { $in: inspectionTemplateIds },
    }).lean();

    return NextResponse.json(
      { templates },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching inspection templates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// PUT /api/inspections/[inspectionId]/templates/[templateId] - Update a template
// Note: This will be handled by [templateId]/route.ts, but we can add a bulk update here if needed
export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId } = await context.params;

    if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: 'Invalid inspection ID' },
        { status: 400 }
      );
    }

    // Check if inspection exists and user has access
    const inspection = await Inspection.findById(inspectionId).lean();
    if (!inspection) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
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

    const body = await request.json();
    const { templateId, templateData } = body;

    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
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

    // Update template
    const updatedTemplate = await InspectionTemplate.findByIdAndUpdate(
      templateId,
      {
        $set: templateData,
      },
      { new: true }
    ).lean();

    if (!updatedTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: 'Template updated successfully',
        template: updatedTemplate,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE /api/inspections/[inspectionId]/templates/[templateId] - Delete a template
// Note: This will be handled by [templateId]/route.ts, but we can add a bulk delete here if needed
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId } = await context.params;

    if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: 'Invalid inspection ID' },
        { status: 400 }
      );
    }

    // Check if inspection exists and user has access
    const inspection = await Inspection.findById(inspectionId).lean();
    if (!inspection) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
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

    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
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

    // Delete template
    await InspectionTemplate.findByIdAndDelete(templateId);

    // Remove template ID from inspection
    await Inspection.findByIdAndUpdate(
      inspectionId,
      {
        $pull: {
          inspectionTemplateIds: new mongoose.Types.ObjectId(templateId),
        },
      }
    );

    return NextResponse.json(
      { message: 'Template deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}
