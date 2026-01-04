import { NextRequest, NextResponse } from 'next/server';
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
        location: '',
        section: '',
        subsection: {},
      });
    }

    return NextResponse.json({
      foundation: dropdown.foundation || '',
      role: dropdown.role || '',
      referralSources: dropdown.referralSources || '',
      location: dropdown.location || '',
      section: dropdown.section || '',
      subsection: dropdown.subsection || {},
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
    const { foundation, role, referralSources, location, section, subsection } = body;

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
    if (location !== undefined && typeof location !== 'string') {
      return NextResponse.json({ error: 'Location must be a string' }, { status: 400 });
    }
    if (section !== undefined && typeof section !== 'string') {
      return NextResponse.json({ error: 'Section must be a string' }, { status: 400 });
    }
    if (subsection !== undefined && (typeof subsection !== 'object' || Array.isArray(subsection) || subsection === null)) {
      return NextResponse.json({ error: 'Subsection must be an object' }, { status: 400 });
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
      updateData.location = existing.location;
    } else {
      updateData.location = '';
    }

    if (section !== undefined) {
      updateData.section = section;
    } else if (existing) {
      updateData.section = existing.section;
    } else {
      updateData.section = '';
    }

    if (subsection !== undefined) {
      updateData.subsection = subsection;
    } else if (existing) {
      updateData.subsection = existing.subsection;
    } else {
      updateData.subsection = {};
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

    return NextResponse.json({
      foundation: dropdown.foundation || '',
      role: dropdown.role || '',
      referralSources: dropdown.referralSources || '',
      location: dropdown.location || '',
      section: dropdown.section || '',
      subsection: dropdown.subsection || {},
    });
  } catch (error: any) {
    console.error('ReusableDropdown PUT error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update reusable dropdowns' },
      { status: 400 }
    );
  }
}

