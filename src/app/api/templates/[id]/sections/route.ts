import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Template from '@/src/models/Template';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getAuthorizedTemplate(templateId: string, userCompanyId?: mongoose.Types.ObjectId) {
  if (!mongoose.Types.ObjectId.isValid(templateId)) {
    return null;
  }

  const template = await Template.findById(templateId).lean();

  if (!template) {
    return null;
  }

  if (userCompanyId && template.company.toString() !== userCompanyId.toString()) {
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

    const { id } = await context.params;
    const template = await getAuthorizedTemplate(id, currentUser.company);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ sections: template.sections || [] });
  } catch (error: any) {
    console.error('Get template sections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch template sections' },
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

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const template = await Template.findById(id);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (currentUser.company && template.company.toString() !== currentUser.company.toString()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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

    await Template.updateOne(
      { _id: id },
      { $push: { sections: newSection } }
    );

    // Fetch updated template to return the new section with _id
    const updatedTemplate = await Template.findById(id).lean();
    const addedSection = updatedTemplate?.sections?.[updatedTemplate.sections.length - 1];

    return NextResponse.json(
      { message: 'Section created successfully', section: addedSection },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create template section error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create template section' },
      { status: 500 }
    );
  }
}
