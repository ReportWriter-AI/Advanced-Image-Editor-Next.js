import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/auth-helpers';
import Template from '../../../../../src/models/Template';
import { getAuthorizedTemplate } from '../../../../../lib/template-helpers';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ error: 'No company associated with current user' }, { status: 400 });
    }

    const { id } = await context.params;
    const template = await getAuthorizedTemplate(id, currentUser.company, true);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('Get template error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch template' },
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

    if (!currentUser.company) {
      return NextResponse.json({ error: 'No company associated with current user' }, { status: 400 });
    }

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const template = await getAuthorizedTemplate(id, currentUser.company);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const body = await request.json();
    const { reportDescription } = body;

    const updateData: Record<string, any> = {};
    if (reportDescription !== undefined) {
      updateData.reportDescription = typeof reportDescription === 'string' ? reportDescription.trim() : undefined;
    }

    const updatedTemplate = await Template.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedTemplate) {
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Template updated successfully',
      template: updatedTemplate,
    });
  } catch (error: any) {
    console.error('Update template error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
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

    if (!currentUser.company) {
      return NextResponse.json({ error: 'No company associated with current user' }, { status: 400 });
    }

    const { id } = await context.params;
    const template = await getAuthorizedTemplate(id, currentUser.company);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await Template.updateOne(
      { _id: id, company: currentUser.company },
      { $set: { deletedAt: new Date() } }
    );

    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch (error: any) {
    console.error('Delete template error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}
