import { NextRequest, NextResponse } from 'next/server';

import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Company from '@/src/models/Company';

type AvailabilityViewMode = 'openSchedule' | 'timeSlots';

function isValidMode(value: unknown): value is AvailabilityViewMode {
  return value === 'openSchedule' || value === 'timeSlots';
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ viewMode: 'openSchedule' satisfies AvailabilityViewMode });
    }

    const company = await Company.findById(currentUser.company).select('availabilityViewMode');
    return NextResponse.json({
      viewMode: (company?.availabilityViewMode ?? 'openSchedule') as AvailabilityViewMode,
    });
  } catch (error: any) {
    console.error('Get availability view mode error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch view mode' },
      { status: 500 },
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
    const viewMode = body?.viewMode;

    if (!isValidMode(viewMode)) {
      return NextResponse.json({ error: 'Invalid view mode' }, { status: 400 });
    }

    await Company.findByIdAndUpdate(currentUser.company, {
      availabilityViewMode: viewMode,
    });

    return NextResponse.json({ message: 'View mode updated', viewMode });
  } catch (error: any) {
    console.error('Update availability view mode error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update view mode' },
      { status: 500 },
    );
  }
}


