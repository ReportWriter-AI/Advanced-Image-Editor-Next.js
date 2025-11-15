import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Agreement from '@/src/models/Agreement';

interface RouteParams {
  params: Promise<{
    agreementId: string;
  }>;
}

function extractPlainText(html: string) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

async function getAuthorizedAgreement(agreementId: string, companyId?: mongoose.Types.ObjectId) {
  if (!companyId || !mongoose.Types.ObjectId.isValid(agreementId)) {
    return null;
  }

  const agreement = await Agreement.findById(agreementId);
  if (!agreement || !agreement.company?.equals(companyId)) {
    return null;
  }

  return agreement;
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { agreementId } = await context.params;
    const agreement = await getAuthorizedAgreement(agreementId, currentUser.company);
    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
    }

    return NextResponse.json({ agreement: agreement.toObject() });
  } catch (error: any) {
    console.error('Get agreement error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch agreement' },
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

    const { agreementId } = await context.params;
    const agreement = await getAuthorizedAgreement(agreementId, currentUser.company);
    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
    }

    const body = await request.json();

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) {
        return NextResponse.json({ error: 'Agreement name is required' }, { status: 400 });
      }
      agreement.name = name;
    }

    if (body.content !== undefined) {
      const content = typeof body.content === 'string' ? body.content : '';
      if (!extractPlainText(content)) {
        return NextResponse.json({ error: 'Agreement content cannot be empty' }, { status: 400 });
      }
      agreement.content = content;
    }

    agreement.updatedBy = currentUser._id;

    const updated = await agreement.save();

    return NextResponse.json({
      message: 'Agreement updated successfully',
      agreement: updated.toObject(),
    });
  } catch (error: any) {
    console.error('Update agreement error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update agreement' },
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

    const { agreementId } = await context.params;
    const agreement = await getAuthorizedAgreement(agreementId, currentUser.company);
    if (!agreement) {
      return NextResponse.json({ error: 'Agreement not found' }, { status: 404 });
    }

    await agreement.deleteOne();

    return NextResponse.json({ message: 'Agreement deleted successfully' });
  } catch (error: any) {
    console.error('Delete agreement error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete agreement' },
      { status: 500 }
    );
  }
}


