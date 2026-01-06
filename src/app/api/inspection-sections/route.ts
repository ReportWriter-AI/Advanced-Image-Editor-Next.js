import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import InspectionSection from '@/src/models/InspectionSection';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ sections: [] });
    }

    const sections = await InspectionSection.find({ company: currentUser.company })
      .sort({ order_index: 1 })
      .lean();

    return NextResponse.json({ sections });
  } catch (error: any) {
    console.error('Get inspection sections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inspection sections' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json(
        { error: 'No company associated with current user' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { name, checklists = [] } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Section name is required' }, { status: 400 });
    }

    const lastSection = await InspectionSection.findOne({ company: currentUser.company })
      .sort({ order_index: -1 })
      .select('order_index')
      .lean();

    const orderIndex = lastSection ? lastSection.order_index + 1 : 0;

    const validatedChecklists = Array.isArray(checklists)
      ? checklists.map((item: any, index: number) => ({
          text: item.text || '',
          comment: item.comment || undefined,
          type: item.type === 'status' ? 'status' : 'information',
          answer_choices: Array.isArray(item.answer_choices) ? item.answer_choices : undefined,
          default_checked: Boolean(item.default_checked),
          default_selected_answers: Array.isArray(item.default_selected_answers)
            ? item.default_selected_answers
            : undefined,
          order_index: typeof item.order_index === 'number' ? item.order_index : index,
        }))
      : [];

    const newSection = await InspectionSection.create({
      company: currentUser.company,
      name: name.trim(),
      order_index: orderIndex,
      checklists: validatedChecklists,
    });

    return NextResponse.json(
      {
        message: 'Inspection section created successfully',
        section: newSection.toObject(),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create inspection section error:', error);
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: 'A section with this name already exists for your company' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create inspection section' },
      { status: 500 }
    );
  }
}

