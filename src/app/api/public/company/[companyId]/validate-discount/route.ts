import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import DiscountCode from '@/src/models/DiscountCode';

interface RouteParams {
  params: Promise<{
    companyId: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const { companyId } = await context.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return NextResponse.json(
        { error: 'Invalid company ID' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code || !code.trim()) {
      return NextResponse.json(
        { error: 'Discount code is required' },
        { status: 400 }
      );
    }

    // Find the discount code
    const discountCode = await DiscountCode.findOne({
      company: companyId,
      code: code.trim(),
      active: true,
    }).lean();

    if (!discountCode) {
      return NextResponse.json(
        { error: 'Invalid discount code' },
        { status: 404 }
      );
    }

    // Check if expired
    if (discountCode.expirationDate && new Date(discountCode.expirationDate) < new Date()) {
      return NextResponse.json(
        { error: 'Discount code has expired' },
        { status: 400 }
      );
    }

    // Check if max uses exceeded
    if (discountCode.maxUses && discountCode.usageCount >= discountCode.maxUses) {
      return NextResponse.json(
        { error: 'Discount code has reached maximum uses' },
        { status: 400 }
      );
    }

    // Return discount code details
    return NextResponse.json({
      discountCode: {
        code: discountCode.code,
        type: discountCode.type,
        value: discountCode.value,
        description: discountCode.description,
      },
    });
  } catch (error: any) {
    console.error('Validate discount code error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to validate discount code' },
      { status: 500 }
    );
  }
}

