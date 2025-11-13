import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../../lib/db';
import { getCurrentUser } from '../../../../../../lib/auth-helpers';
import Service from '../../../../../../src/models/Service';
import { sanitizeAddOns, sanitizeModifiers, sanitizeTaxes } from '../../../../../../lib/modifier-utils';

interface RouteParams {
  params: Promise<{
    serviceId: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ error: 'No company associated with current user' }, { status: 400 });
    }

    const { serviceId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return NextResponse.json({ error: 'Invalid service id' }, { status: 400 });
    }

    const originalService = await Service.findOne({
      _id: serviceId,
      company: currentUser.company,
    }).lean();

    if (!originalService) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const lastService = await Service.findOne({ company: currentUser.company })
      .sort({ orderIndex: -1 })
      .select('orderIndex')
      .lean();

    const nextOrderIndex =
      typeof lastService?.orderIndex === 'number' && Number.isFinite(lastService.orderIndex)
        ? lastService.orderIndex + 1
        : 1;

    const { _id, createdAt, updatedAt, orderIndex, __v, name, ...rest } = originalService;
    const {
      modifiers: originalModifiers,
      addOns: originalAddOns,
      taxes: originalTaxes,
      ...baseFields
    } = rest as typeof rest & {
      modifiers?: unknown;
      addOns?: unknown;
      taxes?: unknown;
    };

    const modifiers = sanitizeModifiers(originalModifiers);
    const addOns = sanitizeAddOns(originalAddOns);
    const taxes = sanitizeTaxes(originalTaxes);

    const duplicatePayload = {
      ...baseFields,
      modifiers,
      addOns,
      taxes,
      name: `${name} copy`,
      orderIndex: nextOrderIndex,
      company: currentUser.company,
      createdBy: currentUser._id,
    };

    const duplicateService = await Service.create(duplicatePayload);

    return NextResponse.json({
      message: 'Service duplicated successfully',
      service: duplicateService.toObject(),
    });
  } catch (error: any) {
    console.error('Duplicate service error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to duplicate service' },
      { status: 500 }
    );
  }
}


