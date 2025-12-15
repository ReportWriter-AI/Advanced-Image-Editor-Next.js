import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import AutomationCategory from '@/src/models/AutomationCategory';

interface RouteParams {
  params: Promise<{
    categoryId: string;
  }>;
}

async function getAuthorizedCategory(categoryId: string, userCompanyId?: mongoose.Types.ObjectId) {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    return null;
  }

  if (!userCompanyId) {
    return null;
  }

  const category = await AutomationCategory.findById(categoryId);
  if (!category) {
    return null;
  }

  if (!category.company || !category.company.equals(userCompanyId)) {
    return null;
  }

  return category;
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { categoryId } = await context.params;
    const category = await getAuthorizedCategory(categoryId, currentUser.company);
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ category: category.toObject() });
  } catch (error: any) {
    console.error('Get automation category error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch category' },
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

    const { categoryId } = await context.params;
    const category = await getAuthorizedCategory(categoryId, currentUser.company);
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, automationType } = body;

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json(
          { error: 'Category name is required' },
          { status: 400 }
        );
      }
      category.name = name.trim();
    }

    if (automationType !== undefined) {
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

      category.automationType = automationType || undefined;
    }

    const updatedCategory = await category.save();

    return NextResponse.json({
      message: 'Category updated successfully',
      category: updatedCategory.toObject(),
    });
  } catch (error: any) {
    console.error('Update automation category error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update category' },
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

    const { categoryId } = await context.params;
    const category = await getAuthorizedCategory(categoryId, currentUser.company);
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    await category.deleteOne();

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('Delete automation category error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete category' },
      { status: 500 }
    );
  }
}

