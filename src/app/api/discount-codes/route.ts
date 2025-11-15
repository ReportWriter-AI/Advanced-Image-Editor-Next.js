import { NextRequest, NextResponse } from 'next/server';

import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import DiscountCode from '@/src/models/DiscountCode';
import { sanitizeDiscountCodePayload, withDiscountCodeRelations } from '@/lib/discount-code-utils';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ discountCodes: [] });
    }

    const discountCodes = await DiscountCode.find({ company: currentUser.company })
      .sort({ createdAt: -1 })
      .lean();

    const hydrated = await withDiscountCodeRelations(discountCodes);

    return NextResponse.json({ discountCodes: hydrated });
  } catch (error: any) {
    console.error('Get discount codes error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch discount codes' },
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
      return NextResponse.json(
        { error: 'No company associated with current user' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { data, error } = await sanitizeDiscountCodePayload(body, currentUser.company, {
      requireCode: true,
      requireType: true,
      requireValue: true,
    });

    if (error || !data?.code || !data.type || data.value === undefined) {
      return NextResponse.json({ error: error || 'Invalid discount data' }, { status: 400 });
    }

    const newDiscountCode = await DiscountCode.create({
      code: data.code,
      type: data.type,
      value: data.value,
      description: data.description,
      notes: data.notes,
      appliesToServices: data.appliesToServices ?? [],
      appliesToAddOns: data.appliesToAddOns ?? [],
      maxUses: data.maxUses ?? undefined,
      expirationDate: data.expirationDate ?? undefined,
      active: data.active ?? true,
      company: currentUser.company,
      createdBy: currentUser._id,
    });

    return NextResponse.json(
      {
        message: 'Discount code created successfully',
        discountCode: newDiscountCode.toObject(),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create discount code error:', error);
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: 'A discount code with this code already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create discount code' },
      { status: 500 }
    );
  }
}


