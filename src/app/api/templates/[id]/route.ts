import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/auth-helpers';
import Template from '../../../../../src/models/Template';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getAuthorizedTemplate(templateId: string, userCompanyId?: mongoose.Types.ObjectId) {
  if (!mongoose.Types.ObjectId.isValid(templateId)) {
    return null;
  }

  const template = await Template.findOne({
    _id: templateId,
    company: userCompanyId,
  });

  return template;
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

    await template.deleteOne();

    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch (error: any) {
    console.error('Delete template error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}
