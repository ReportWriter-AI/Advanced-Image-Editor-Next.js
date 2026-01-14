import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/auth-helpers';
import Template from '../../../../../src/models/Template';
import { getAuthorizedTemplate } from '../../../../../lib/template-helpers';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
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
