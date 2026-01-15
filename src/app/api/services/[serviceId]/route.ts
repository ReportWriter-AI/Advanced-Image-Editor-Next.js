import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/auth-helpers';
import Service from '../../../../../src/models/Service';
import { sanitizeAddOns, sanitizeModifiers, sanitizeTaxes } from '../../../../../lib/modifier-utils';

interface RouteParams {
  params: Promise<{
    serviceId: string;
  }>;
}

async function getAuthorizedService(serviceId: string, userCompanyId?: mongoose.Types.ObjectId) {
  if (!mongoose.Types.ObjectId.isValid(serviceId)) {
    return null;
  }

  if (!userCompanyId) {
    return null;
  }

  const service = await Service.findById(serviceId);
  if (!service) {
    return null;
  }

  if (!service.company || !service.company.equals(userCompanyId)) {
    return null;
  }

  return service;
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serviceId } = await context.params;
    const service = await getAuthorizedService(serviceId, currentUser.company);
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json({ service: service.toObject() });
  } catch (error: any) {
    console.error('Get service error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch service' },
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

    const { serviceId } = await context.params;
    const service = await getAuthorizedService(serviceId, currentUser.company);
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      serviceCategory,
      description,
      hiddenFromScheduler,
      baseCost,
      baseDurationHours,
      defaultInspectionEvents,
      organizationServiceId,
      agreementIds,
      templateIds,
      modifiers,
    } = body;

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json(
          { error: 'Service name is required' },
          { status: 400 }
        );
      }
      service.name = name.trim();
    }

    if (serviceCategory !== undefined) {
      if (!serviceCategory || !serviceCategory.trim()) {
        return NextResponse.json(
          { error: 'Service category is required' },
          { status: 400 }
        );
      }
      service.serviceCategory = serviceCategory.trim();
    }

    if (description !== undefined) {
      service.description = description?.trim() || undefined;
    }

    if (hiddenFromScheduler !== undefined) {
      service.hiddenFromScheduler = Boolean(hiddenFromScheduler);
    }

    if (baseCost !== undefined) {
      const parsedBaseCost =
        baseCost === ''
          ? 0
          : typeof baseCost === 'string'
            ? parseFloat(baseCost)
            : baseCost;
      if (typeof parsedBaseCost !== 'number' || Number.isNaN(parsedBaseCost) || parsedBaseCost < 0) {
        return NextResponse.json(
          { error: 'Base cost must be a non-negative number' },
          { status: 400 }
        );
      }
      service.baseCost = parsedBaseCost;
    }

    if (baseDurationHours !== undefined) {
      const parsedBaseDuration =
        baseDurationHours === ''
          ? 0
          : typeof baseDurationHours === 'string'
            ? parseFloat(baseDurationHours)
            : baseDurationHours;
      if (
        typeof parsedBaseDuration !== 'number' ||
        Number.isNaN(parsedBaseDuration) ||
        parsedBaseDuration < 0
      ) {
        return NextResponse.json(
          { error: 'Base duration must be a non-negative number' },
          { status: 400 }
        );
      }
      service.baseDurationHours = parsedBaseDuration;
    }

    if (defaultInspectionEvents !== undefined) {
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
      service.defaultInspectionEvents = events;
    }

    if (organizationServiceId !== undefined) {
      service.organizationServiceId = organizationServiceId?.trim() || undefined;
    }

    if (agreementIds !== undefined) {
      if (Array.isArray(agreementIds)) {
        service.agreementIds = agreementIds
          .filter((id: any) => mongoose.Types.ObjectId.isValid(id))
          .map((id: any) => new mongoose.Types.ObjectId(id));
      } else {
        service.agreementIds = [];
      }
      service.markModified('agreementIds');
    }

    if (templateIds !== undefined) {
      if (Array.isArray(templateIds)) {
        service.templateIds = templateIds
          .filter((id: any) => mongoose.Types.ObjectId.isValid(id))
          .map((id: any) => new mongoose.Types.ObjectId(id));
      } else {
        service.templateIds = [];
      }
      service.markModified('templateIds');
    }

    if (modifiers !== undefined) {
      service.modifiers = sanitizeModifiers(modifiers);
      service.markModified('modifiers');
    }

    if (body.addOns !== undefined) {
      service.addOns = sanitizeAddOns(body.addOns);
      service.markModified('addOns');
    }

    if (body.taxes !== undefined) {
      service.taxes = sanitizeTaxes(body.taxes);
      service.markModified('taxes');
    }

    const updatedService = await service.save();

    return NextResponse.json({ message: 'Service updated successfully', service: updatedService.toObject() });
  } catch (error: any) {
    console.error('Update service error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update service' },
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

    const { serviceId } = await context.params;
    const service = await getAuthorizedService(serviceId, currentUser.company);
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    await service.deleteOne();

    return NextResponse.json({ message: 'Service deleted successfully' });
  } catch (error: any) {
    console.error('Delete service error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete service' },
      { status: 500 }
    );
  }
}


