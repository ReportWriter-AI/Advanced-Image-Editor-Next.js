import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/auth-helpers';
import Template from '../../../../../src/models/Template';

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

    const templates = await Template.find({ 
      company: currentUser.company,
      deletedAt: { $ne: null },
    })
      .sort({ deletedAt: -1 })
      .lean();

    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error('Get deleted templates error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deleted templates' },
      { status: 500 }
    );
  }
}
