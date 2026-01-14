import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../../lib/db';
import { getCurrentUser } from '../../../../../../lib/auth-helpers';
import Template from '../../../../../../src/models/Template';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

    const { id } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const result = await Template.updateOne(
      { 
        _id: id, 
        company: currentUser.company,
        deletedAt: { $ne: null },
      },
      { 
        $set: { deletedAt: null } 
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Template not found or not deleted' }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Template restored successfully',
      modifiedCount: result.modifiedCount,
    });
  } catch (error: any) {
    console.error('Restore template error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to restore template' },
      { status: 500 }
    );
  }
}
