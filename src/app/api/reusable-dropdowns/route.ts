import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import ReusableDropdown from '@/src/models/ReusableDropdown';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser || !currentUser.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dropdown = await ReusableDropdown.findOne({
      company: currentUser.company,
    }).lean();

    if (!dropdown) {
      return NextResponse.json({
        foundation: '',
        role: '',
        referralSources: '',
        location: [],
        serviceCategory: '',
      });
    }

    // Handle backward compatibility: convert string location to array of objects
    let locationArray: Array<{ id: string; value: string }> = [];
    if (dropdown.location) {
      // Type assertion for backward compatibility - database may have old string format
      const locationData = dropdown.location as string | Array<{ id: string; value: string }>;
      if (typeof locationData === 'string') {
        // Convert comma-separated string to array of objects with IDs
        const locationValues = locationData.split(',').map((item: string) => item.trim()).filter((item: string) => item.length > 0);
        locationArray = locationValues.map((value: string) => ({
          id: crypto.randomUUID(),
          value,
        }));
      } else if (Array.isArray(locationData)) {
        locationArray = locationData;
      }
    }

    return NextResponse.json({
      foundation: dropdown.foundation || '',
      role: dropdown.role || '',
      referralSources: dropdown.referralSources || '',
      location: locationArray,
      serviceCategory: dropdown.serviceCategory || '',
    });
  } catch (error: any) {
    console.error('ReusableDropdown GET error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to fetch reusable dropdowns' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser || !currentUser.company) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { foundation, role, referralSources, location, serviceCategory } = body;

    // Validate that all fields are strings
    if (foundation !== undefined && typeof foundation !== 'string') {
      return NextResponse.json({ error: 'Foundation must be a string' }, { status: 400 });
    }
    if (role !== undefined && typeof role !== 'string') {
      return NextResponse.json({ error: 'Role must be a string' }, { status: 400 });
    }
    if (referralSources !== undefined && typeof referralSources !== 'string') {
      return NextResponse.json({ error: 'ReferralSources must be a string' }, { status: 400 });
    }
    if (location !== undefined) {
      if (!Array.isArray(location)) {
        return NextResponse.json({ error: 'Location must be an array' }, { status: 400 });
      }
      // Validate that each location item has id and value
      for (const item of location) {
        if (typeof item !== 'object' || item === null || !item.id || !item.value) {
          return NextResponse.json({ error: 'Each location item must have id and value properties' }, { status: 400 });
        }
        if (typeof item.id !== 'string' || typeof item.value !== 'string') {
          return NextResponse.json({ error: 'Location id and value must be strings' }, { status: 400 });
        }
      }
    }
    if (serviceCategory !== undefined && typeof serviceCategory !== 'string') {
      return NextResponse.json({ error: 'ServiceCategory must be a string' }, { status: 400 });
    }

    // Get existing dropdown to preserve values for fields not being updated
    const existing = await ReusableDropdown.findOne({
      company: currentUser.company,
    });

    // Build update object, preserving existing values if field is not provided
    const updateData: any = {
      company: currentUser.company,
      updatedBy: currentUser._id,
    };

    if (foundation !== undefined) {
      updateData.foundation = foundation;
    } else if (existing) {
      updateData.foundation = existing.foundation;
    } else {
      updateData.foundation = '';
    }

    if (role !== undefined) {
      updateData.role = role;
    } else if (existing) {
      updateData.role = existing.role;
    } else {
      updateData.role = '';
    }

    if (referralSources !== undefined) {
      updateData.referralSources = referralSources;
    } else if (existing) {
      updateData.referralSources = existing.referralSources;
    } else {
      updateData.referralSources = '';
    }

    if (location !== undefined) {
      updateData.location = location;
    } else if (existing) {
      // Handle backward compatibility: convert string to array of objects if needed
      // Type assertion for backward compatibility - database may have old string format
      const existingLocation = existing.location as string | Array<{ id: string; value: string }> | undefined;
      if (typeof existingLocation === 'string' && existingLocation) {
        const locationValues = existingLocation.split(',').map((item: string) => item.trim()).filter((item: string) => item.length > 0);
        updateData.location = locationValues.map((value: string) => ({
          id: crypto.randomUUID(),
          value,
        }));
      } else {
        updateData.location = (existingLocation as Array<{ id: string; value: string }>) || [];
      }
    } else {
      updateData.location = [];
    }

    if (serviceCategory !== undefined) {
      updateData.serviceCategory = serviceCategory;
    } else if (existing) {
      updateData.serviceCategory = existing.serviceCategory;
    } else {
      updateData.serviceCategory = '';
    }

    // Set createdBy only on creation
    if (!existing) {
      updateData.createdBy = currentUser._id;
    }

    // Save exactly as received, no transformation
    const dropdown = await ReusableDropdown.findOneAndUpdate(
      {
        company: currentUser.company,
      },
      updateData,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    if (!dropdown) {
      throw new Error('Failed to update reusable dropdowns');
    }

    // Handle backward compatibility for location in response
    let locationArray: Array<{ id: string; value: string }> = [];
    if (dropdown.location) {
      // Type assertion for backward compatibility - database may have old string format
      const locationData = dropdown.location as string | Array<{ id: string; value: string }>;
      if (typeof locationData === 'string') {
        const locationValues = locationData.split(',').map((item: string) => item.trim()).filter((item: string) => item.length > 0);
        locationArray = locationValues.map((value: string) => ({
          id: crypto.randomUUID(),
          value,
        }));
      } else if (Array.isArray(locationData)) {
        locationArray = locationData;
      }
    }

    return NextResponse.json({
      foundation: dropdown.foundation || '',
      role: dropdown.role || '',
      referralSources: dropdown.referralSources || '',
      location: locationArray,
      serviceCategory: dropdown.serviceCategory || '',
    });
  } catch (error: any) {
    console.error('ReusableDropdown PUT error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update reusable dropdowns' },
      { status: 400 }
    );
  }
}

