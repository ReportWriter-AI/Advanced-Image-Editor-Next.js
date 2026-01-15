import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/auth-helpers';
import Service from '../../../../src/models/Service';
import { sanitizeAddOns, sanitizeModifiers, sanitizeTaxes } from '../../../../lib/modifier-utils';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ services: [] });
    }

    const services = await Service.find({ company: currentUser.company })
      .sort({ orderIndex: 1, createdAt: 1 })
      .lean();

    return NextResponse.json({ services });
  } catch (error: any) {
    console.error('Get services error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch services' },
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

    const {
      name,
      serviceCategory,
      description,
      hiddenFromScheduler = false,
      baseCost,
      baseDurationHours,
      defaultInspectionEvents,
      organizationServiceId,
      agreementIds,
      templateIds,
      modifiers,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Service name is required' },
        { status: 400 }
      );
    }

    if (!serviceCategory || !serviceCategory.trim()) {
      return NextResponse.json(
        { error: 'Service category is required' },
        { status: 400 }
      );
    }

    const parsedBaseCost =
      baseCost === undefined || baseCost === null || baseCost === ''
        ? undefined
        : typeof baseCost === 'string'
          ? parseFloat(baseCost)
          : baseCost;

    if (parsedBaseCost !== undefined) {
      if (typeof parsedBaseCost !== 'number' || Number.isNaN(parsedBaseCost) || parsedBaseCost < 0) {
        return NextResponse.json(
          { error: 'Base cost must be a non-negative number' },
          { status: 400 }
        );
      }
    }

    const parsedBaseDuration =
      baseDurationHours === undefined || baseDurationHours === null || baseDurationHours === ''
        ? undefined
        : typeof baseDurationHours === 'string'
          ? parseFloat(baseDurationHours)
          : baseDurationHours;

    if (parsedBaseDuration !== undefined) {
      if (typeof parsedBaseDuration !== 'number' || Number.isNaN(parsedBaseDuration) || parsedBaseDuration < 0) {
        return NextResponse.json(
          { error: 'Base duration must be a non-negative number' },
          { status: 400 }
        );
      }
    }

    let events: string[] = [];
    if (Array.isArray(defaultInspectionEvents)) {
      events = defaultInspectionEvents
        .map((event) => (typeof event === 'string' ? event.trim() : ''))
        .filter((event) => event.length > 0);
    } else if (typeof defaultInspectionEvents === 'string') {
      events = defaultInspectionEvents
        .split(',')
        .map((event) => event.trim())
        .filter((event) => event.length > 0);
    }

    const sanitizedModifiers = sanitizeModifiers(modifiers);
    const sanitizedAddOns = sanitizeAddOns(body.addOns);
    const sanitizedTaxes = sanitizeTaxes(body.taxes);
    
    let agreementObjectIds: mongoose.Types.ObjectId[] = [];
    if (Array.isArray(agreementIds)) {
      agreementObjectIds = agreementIds
        .filter((id: any) => mongoose.Types.ObjectId.isValid(id))
        .map((id: any) => new mongoose.Types.ObjectId(id));
    }
    
    let templateObjectIds: mongoose.Types.ObjectId[] = [];
    if (Array.isArray(templateIds)) {
      templateObjectIds = templateIds
        .filter((id: any) => mongoose.Types.ObjectId.isValid(id))
        .map((id: any) => new mongoose.Types.ObjectId(id));
    }
    
    const lastService = await Service.findOne({ company: currentUser.company })
      .sort({ orderIndex: -1 })
      .select('orderIndex')
      .lean();
    const nextOrderIndex =
      typeof lastService?.orderIndex === 'number' && Number.isFinite(lastService.orderIndex)
        ? lastService.orderIndex + 1
        : 1;
    const newService = await Service.create({
      name: name.trim(),
      serviceCategory: serviceCategory.trim(),
      description: description?.trim() || undefined,
      hiddenFromScheduler: Boolean(hiddenFromScheduler),
      ...(parsedBaseCost !== undefined ? { baseCost: parsedBaseCost } : {}),
      ...(parsedBaseDuration !== undefined ? { baseDurationHours: parsedBaseDuration } : {}),
      defaultInspectionEvents: events,
      organizationServiceId: organizationServiceId?.trim() || undefined,
      agreementIds: agreementObjectIds,
      templateIds: templateObjectIds,
      orderIndex: nextOrderIndex,
      company: currentUser.company,
      createdBy: currentUser._id,
      modifiers: sanitizedModifiers,
      addOns: sanitizedAddOns,
      taxes: sanitizedTaxes,
    });

    return NextResponse.json(
      { message: 'Service created successfully', service: newService.toObject() },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create service error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create service' },
      { status: 500 }
    );
  }
}


