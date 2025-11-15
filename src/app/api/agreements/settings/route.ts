import { NextRequest, NextResponse } from 'next/server';

import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Company from '@/src/models/Company';

const DEFAULT_INSTRUCTIONS = 'Please read through and sign:';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({
        signatureType: 'checkbox',
        clientInstructions: DEFAULT_INSTRUCTIONS,
      });
    }

    const company = await Company.findById(currentUser.company).select(
      'agreementSignatureType agreementClientInstructions'
    );

    return NextResponse.json({
      signatureType: company?.agreementSignatureType ?? 'checkbox',
      clientInstructions: company?.agreementClientInstructions ?? DEFAULT_INSTRUCTIONS,
    });
  } catch (error: any) {
    console.error('Get agreement settings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const signatureType = body.signatureType === 'written' ? 'written' : 'checkbox';
    const instructions =
      typeof body.clientInstructions === 'string' && body.clientInstructions.trim().length > 0
        ? body.clientInstructions
        : DEFAULT_INSTRUCTIONS;

    await Company.findByIdAndUpdate(currentUser.company, {
      agreementSignatureType: signatureType,
      agreementClientInstructions: instructions,
    });

    return NextResponse.json({
      message: 'Agreement settings updated',
      signatureType,
      clientInstructions: instructions,
    });
  } catch (error: any) {
    console.error('Update agreement settings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}


