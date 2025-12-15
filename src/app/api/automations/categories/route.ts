import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import AutomationCategory from '@/src/models/AutomationCategory';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ categories: [] });
    }

    const categories = await AutomationCategory.find({ company: currentUser.company })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(categories);
  } catch (error: any) {
    console.error('Get automation categories error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch categories' },
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
    const { name, automationType } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const validAutomationTypes = [
      'Scheduling',
      'Rescheduling',
      'Publishing',
      'Informational - Pre-Inspection',
      'Upsell - Pre-Inspection',
      'Informational - Post-Inspection',
      'Upsell - Post-Inspection',
      'Inspector',
      'Staff',
      '3rd Party',
      'Other',
    ];

    if (automationType && !validAutomationTypes.includes(automationType)) {
      return NextResponse.json(
        { error: 'Invalid automation type' },
        { status: 400 }
      );
    }

    const newCategory = await AutomationCategory.create({
      name: name.trim(),
      automationType: automationType || undefined,
      company: currentUser.company,
      createdBy: currentUser._id,
    });

    return NextResponse.json(
      { message: 'Category created successfully', category: newCategory.toObject() },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create automation category error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}

