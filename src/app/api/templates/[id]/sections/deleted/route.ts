import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Template from '@/src/models/Template';
import { getAuthorizedTemplate } from '@/lib/template-helpers';

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

    const { id } = await context.params;
    const template = await getAuthorizedTemplate(id, currentUser.company, true);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Filter to only deleted sections
    const deletedSections = (template.sections || []).filter(
      (section: any) => section.deletedAt
    );

    return NextResponse.json({ sections: deletedSections });
  } catch (error: any) {
    console.error('Get deleted template sections error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deleted template sections' },
      { status: 500 }
    );
  }
}
