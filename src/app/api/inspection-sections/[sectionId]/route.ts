import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import InspectionSection from '@/src/models/InspectionSection';

interface RouteParams {
  params: Promise<{
    sectionId: string;
  }>;
}

async function getAuthorizedSection(
  sectionId: string,
  companyId?: mongoose.Types.ObjectId
) {
  if (!companyId || !mongoose.Types.ObjectId.isValid(sectionId)) {
    return null;
  }

  const section = await InspectionSection.findById(sectionId);
  if (!section || !section.company?.equals(companyId)) {
    return null;
  }

  return section;
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sectionId } = await context.params;
    const section = await getAuthorizedSection(sectionId, currentUser.company);
    if (!section) {
      return NextResponse.json({ error: 'Inspection section not found' }, { status: 404 });
    }

    return NextResponse.json({ section: section.toObject() });
  } catch (error: any) {
    console.error('Get inspection section error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inspection section' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sectionId } = await context.params;
    const section = await getAuthorizedSection(sectionId, currentUser.company);
    if (!section) {
      return NextResponse.json({ error: 'Inspection section not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, checklists } = body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Section name is required' }, { status: 400 });
      }
      section.name = name.trim();
    }

    if (checklists !== undefined) {
      if (!Array.isArray(checklists)) {
        return NextResponse.json({ error: 'Checklists must be an array' }, { status: 400 });
      }

      const validatedChecklists = checklists.map((item: any, index: number) => ({
        text: item.text || '',
        comment: item.comment || undefined,
        type: (item.type === 'status' ? 'status' : 'information') as 'status' | 'information',
        tab: (item.tab === 'limitations' ? 'limitations' : 'information') as 'information' | 'limitations',
        answer_choices: Array.isArray(item.answer_choices) ? item.answer_choices : undefined,
        default_checked: Boolean(item.default_checked),
        default_selected_answers: Array.isArray(item.default_selected_answers)
          ? item.default_selected_answers
          : undefined,
        order_index: typeof item.order_index === 'number' ? item.order_index : index,
      }));

      section.checklists = validatedChecklists;
    }

    const updated = await section.save();

    return NextResponse.json({
      message: 'Inspection section updated successfully',
      section: updated.toObject(),
    });
  } catch (error: any) {
    console.error('Update inspection section error:', error);
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: 'A section with this name already exists for your company' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update inspection section' },
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

    const { sectionId } = await context.params;
    const section = await getAuthorizedSection(sectionId, currentUser.company);
    if (!section) {
      return NextResponse.json({ error: 'Inspection section not found' }, { status: 404 });
    }

    await section.deleteOne();

    return NextResponse.json({ message: 'Inspection section deleted successfully' });
  } catch (error: any) {
    console.error('Delete inspection section error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete inspection section' },
      { status: 500 }
    );
  }
}

