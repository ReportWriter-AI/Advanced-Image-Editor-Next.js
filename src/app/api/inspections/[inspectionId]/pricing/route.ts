import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Inspection from '@/src/models/Inspection';
import { getCurrentUser } from '@/lib/auth-helpers';
import mongoose from 'mongoose';
import { checkAndProcessTriggers, detectPricingChanges, detectFeeChanges } from '@/src/lib/automation-trigger-helper';
import { recalculateAndUpdateIsPaid } from '../payment-history/route';

interface RouteParams {
  params: Promise<{
    inspectionId: string;
  }>;
}

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId } = await context.params;

    if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: 'Invalid inspection ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: 'Items must be an array' },
        { status: 400 }
      );
    }

    // Validate items structure
    for (const item of items) {
      if (!item.type || !['service', 'addon', 'additional'].includes(item.type)) {
        return NextResponse.json(
          { error: 'Each item must have a valid type (service, addon, or additional)' },
          { status: 400 }
        );
      }

      if (!item.name || typeof item.name !== 'string' || !item.name.trim()) {
        return NextResponse.json(
          { error: 'Each item must have a non-empty name' },
          { status: 400 }
        );
      }

      if (typeof item.price !== 'number' || item.price < 0) {
        return NextResponse.json(
          { error: 'Each item must have a valid non-negative price' },
          { status: 400 }
        );
      }

      // Validate serviceId for service and addon types
      if ((item.type === 'service' || item.type === 'addon') && item.serviceId) {
        if (!mongoose.Types.ObjectId.isValid(item.serviceId)) {
          return NextResponse.json(
            { error: 'Invalid serviceId format' },
            { status: 400 }
          );
        }
      }

      // Validate addonName for addon type
      if (item.type === 'addon' && !item.addonName) {
        return NextResponse.json(
          { error: 'Addon items must have an addonName' },
          { status: 400 }
        );
      }
    }

    // Check if inspection exists and user has access
    // Get inspection before update for comparison
    const inspectionBefore = await Inspection.findById(inspectionId).lean();
    if (!inspectionBefore) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this inspection's company
    const inspectionCompanyId = (inspectionBefore as any).companyId?.toString();
    const userCompanyId = currentUser.company?.toString();

    if (inspectionCompanyId !== userCompanyId) {
      return NextResponse.json(
        { error: 'Unauthorized access to this inspection' },
        { status: 403 }
      );
    }

    // Process items: convert serviceId to ObjectId, preserve originalPrice
    const processedItems = items.map((item: any) => {
      const processedItem: any = {
        type: item.type,
        name: item.name.trim(),
        price: Number(item.price),
      };

      if (item.serviceId && mongoose.Types.ObjectId.isValid(item.serviceId)) {
        processedItem.serviceId = new mongoose.Types.ObjectId(item.serviceId);
      }

      if (item.addonName) {
        processedItem.addonName = item.addonName.trim();
      }

      if (typeof item.originalPrice === 'number' && item.originalPrice >= 0) {
        processedItem.originalPrice = item.originalPrice;
      }

      if (typeof item.hours === 'number' && item.hours >= 0) {
        processedItem.hours = item.hours;
      }

      return processedItem;
    });

    // Update inspection with pricing
    const result = await Inspection.findByIdAndUpdate(
      new mongoose.Types.ObjectId(inspectionId),
      {
        $set: {
          pricing: {
            items: processedItems,
          },
        },
      },
      { new: true }
    );

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to update inspection pricing' },
        { status: 500 }
      );
    }

    // Get updated inspection for comparison
    const inspectionAfter = await Inspection.findById(inspectionId).lean();

    // Check for pricing changes and trigger if inspection is confirmed
    if (inspectionAfter && inspectionAfter.confirmedInspection) {
      // const pricingChanges = detectPricingChanges(
      //   inspectionBefore.pricing,
      //   inspectionAfter.pricing
      // );

      // if (pricingChanges.servicesOrAddonsAdded) {
      //   await checkAndProcessTriggers(inspectionId, 'SERVICE_OR_ADDON_ADDED_AFTER_CONFIRMATION');
      // }

      // if (pricingChanges.servicesOrAddonsRemoved) {
      //   await checkAndProcessTriggers(inspectionId, 'SERVICE_OR_ADDON_REMOVED_AFTER_CONFIRMATION');
      // }

      // Check for fee changes (additional items)
      const feeChanges = detectFeeChanges(
        inspectionBefore.pricing,
        inspectionAfter.pricing
      );

      if (feeChanges.feesAdded) {
        await checkAndProcessTriggers(inspectionId, 'FEE_ADDED_AFTER_CONFIRMATION');
      }

      if (feeChanges.feesRemoved) {
        await checkAndProcessTriggers(inspectionId, 'FEE_REMOVED_AFTER_CONFIRMATION');
      }
    }

    // Recalculate and update isPaid status after pricing changes
    await recalculateAndUpdateIsPaid(inspectionId);

    return NextResponse.json(
      {
        message: 'Pricing updated successfully',
        pricing: {
          items: processedItems,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating pricing:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update pricing' },
      { status: 500 }
    );
  }
}

