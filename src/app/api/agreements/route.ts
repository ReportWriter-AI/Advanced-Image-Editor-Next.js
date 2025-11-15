import { NextRequest, NextResponse } from 'next/server';

import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Agreement from '@/src/models/Agreement';

function extractPlainText(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ agreements: [] });
    }

    const agreements = await Agreement.find({ company: currentUser.company })
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({ agreements });
  } catch (error: any) {
    console.error('Get agreements error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch agreements' },
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
      return NextResponse.json({ error: 'No company associated with user' }, { status: 400 });
    }

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const content = typeof body.content === 'string' ? body.content : '';

    if (!name) {
      return NextResponse.json({ error: 'Agreement name is required' }, { status: 400 });
    }

    const plainText = extractPlainText(content);
    if (!plainText) {
      return NextResponse.json({ error: 'Agreement content cannot be empty' }, { status: 400 });
    }

    const agreement = await Agreement.create({
      name,
      content,
      company: currentUser.company,
      createdBy: currentUser._id,
      updatedBy: currentUser._id,
    });

    return NextResponse.json(
      { message: 'Agreement created successfully', agreement: agreement.toObject() },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create agreement error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create agreement' },
      { status: 500 }
    );
  }
}


