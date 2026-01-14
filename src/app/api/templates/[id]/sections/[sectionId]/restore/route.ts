import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Template from '@/src/models/Template';
import { getAuthorizedTemplate } from '@/lib/template-helpers';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string; sectionId: string }>;
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

    const { id, sectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(sectionId)) {
      return NextResponse.json({ error: 'Invalid template or section ID' }, { status: 400 });
    }

    // Check if section exists and is deleted
    const template = await getAuthorizedTemplate(id, currentUser.company, true);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const section = template.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId && s.deletedAt
    );

    if (!section) {
      return NextResponse.json({ error: 'Section not found or not deleted' }, { status: 404 });
    }

    // Restore the section by setting deletedAt to null
    const result = await Template.updateOne(
      { _id: id, 'sections._id': new mongoose.Types.ObjectId(sectionId) },
      { $set: { 'sections.$.deletedAt': null } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Section restored successfully',
      modifiedCount: result.modifiedCount,
    });
  } catch (error: any) {
    console.error('Restore template section error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to restore template section' },
      { status: 500 }
    );
  }
}
