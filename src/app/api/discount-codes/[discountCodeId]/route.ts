import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import DiscountCode from '@/src/models/DiscountCode';
import { sanitizeDiscountCodePayload, withDiscountCodeRelations } from '@/lib/discount-code-utils';

interface RouteParams {
  params: Promise<{
    discountCodeId: string;
  }>;
}

async function getAuthorizedDiscountCode(discountCodeId: string, companyId?: mongoose.Types.ObjectId) {
  if (!companyId || !mongoose.Types.ObjectId.isValid(discountCodeId)) {
    return null;
  }

  const discountCode = await DiscountCode.findById(discountCodeId);
  if (!discountCode || !discountCode.company?.equals(companyId)) {
    return null;
  }

  return discountCode;
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { discountCodeId } = await context.params;
    const discountCode = await getAuthorizedDiscountCode(discountCodeId, currentUser.company);
    if (!discountCode) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const [hydrated] = await withDiscountCodeRelations([discountCode.toObject()]);

    return NextResponse.json({ discountCode: hydrated ?? discountCode.toObject() });
  } catch (error: any) {
    console.error('Get discount code error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch discount code' },
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

    const { discountCodeId } = await context.params;
    const discountCode = await getAuthorizedDiscountCode(discountCodeId, currentUser.company);
    if (!discountCode) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    const body = await request.json();
    const { data, error } = await sanitizeDiscountCodePayload(body, currentUser.company);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    if (data?.code !== undefined) {
      discountCode.code = data.code;
    }

    if (data?.type !== undefined) {
      discountCode.type = data.type;
    }

    if (data?.value !== undefined) {
      discountCode.value = data.value;
    }

    if (data?.description !== undefined) {
      discountCode.description = data.description;
    }

    if (data?.notes !== undefined) {
      discountCode.notes = data.notes;
    }

    if (data?.appliesToServices !== undefined) {
      discountCode.appliesToServices = data.appliesToServices;
    }

    if (data?.appliesToAddOns !== undefined) {
      discountCode.appliesToAddOns = data.appliesToAddOns;
    }

    if (data?.maxUses !== undefined) {
      discountCode.maxUses = data.maxUses ?? undefined;
    }

    if (data?.expirationDate !== undefined) {
      discountCode.expirationDate = data.expirationDate ?? undefined;
    }

    if (data?.active !== undefined) {
      discountCode.active = data.active;
    }

    const updated = await discountCode.save();

    return NextResponse.json({
      message: 'Discount code updated successfully',
      discountCode: updated.toObject(),
    });
  } catch (error: any) {
    console.error('Update discount code error:', error);
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: 'A discount code with this code already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to update discount code' },
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

    const { discountCodeId } = await context.params;
    const discountCode = await getAuthorizedDiscountCode(discountCodeId, currentUser.company);
    if (!discountCode) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    await discountCode.deleteOne();

    return NextResponse.json({ message: 'Discount code deleted successfully' });
  } catch (error: any) {
    console.error('Delete discount code error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete discount code' },
      { status: 500 }
    );
  }
}


