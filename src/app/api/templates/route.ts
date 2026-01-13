import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/auth-helpers';
import Template from '../../../../src/models/Template';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ templates: [] });
    }

    const templates = await Template.find({ company: currentUser.company })
      .sort({ orderIndex: 1, createdAt: -1 })
      .lean();

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
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
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    const newTemplate = await Template.create({
      name: name.trim(),
      company: currentUser.company,
      createdBy: currentUser._id,
    });

    return NextResponse.json(
      { message: 'Template created successfully', template: newTemplate.toObject() },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create template error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    );
  }
}
