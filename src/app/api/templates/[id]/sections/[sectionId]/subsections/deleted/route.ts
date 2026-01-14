import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Template from '@/src/models/Template';
import { getAuthorizedTemplate } from '@/lib/template-helpers';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ id: string; sectionId: string }>;
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, sectionId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(sectionId)) {
      return NextResponse.json({ error: 'Invalid template or section ID' }, { status: 400 });
    }

    const template = await getAuthorizedTemplate(id, currentUser.company, true);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Find the section
    const section = template.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Filter to only deleted subsections
    const deletedSubsections = (section.subsections || []).filter(
      (subsection: any) => subsection.deletedAt
    );

    return NextResponse.json({ subsections: deletedSubsections });
  } catch (error: any) {
    console.error('Get deleted template subsections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deleted template subsections' },
      { status: 500 }
    );
  }
}
