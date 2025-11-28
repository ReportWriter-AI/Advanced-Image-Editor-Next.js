import { NextRequest, NextResponse } from 'next/server';

import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Category from '@/src/models/Category';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ 
        categories: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        }
      });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    const total = await Category.countDocuments({ company: currentUser.company });
    const totalPages = Math.ceil(total / limit);

    const categories = await Category.find({ company: currentUser.company })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json({ 
      categories,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      }
    });
  } catch (error: any) {
    console.error('Get categories error:', error);
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
      return NextResponse.json({ error: 'No company associated with user' }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      color,
      autoCategorizing,
      autoCategoryPerson,
      rules,
      removeCategoryOnRuleFail,
    } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    if (!color || typeof color !== 'string') {
      return NextResponse.json({ error: 'Category color is required' }, { status: 400 });
    }

    // Validate color format (hex color)
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(color)) {
      return NextResponse.json({ error: 'Invalid color format. Use hex color (e.g., #3b82f6)' }, { status: 400 });
    }

    if (autoCategorizing && !autoCategoryPerson) {
      return NextResponse.json({ error: 'Auto Category Person is required when Auto Categorizing is enabled' }, { status: 400 });
    }

    if (autoCategorizing && (!rules || !Array.isArray(rules) || rules.length === 0)) {
      return NextResponse.json({ error: 'At least one rule is required when Auto Categorizing is enabled' }, { status: 400 });
    }

    // Validate rules
    if (rules && Array.isArray(rules)) {
      for (const rule of rules) {
        if (!rule.ruleType || !rule.condition || rule.count === undefined) {
          return NextResponse.json({ error: 'Each rule must have ruleType, condition, and count' }, { status: 400 });
        }
        if (rule.within && !rule.days) {
          return NextResponse.json({ error: 'Days is required when Within is selected' }, { status: 400 });
        }
      }
    }

    const category = await Category.create({
      name: name.trim(),
      color,
      autoCategorizing: Boolean(autoCategorizing),
      autoCategoryPerson: autoCategorizing ? autoCategoryPerson : undefined,
      rules: rules || [],
      removeCategoryOnRuleFail: Boolean(removeCategoryOnRuleFail),
      company: currentUser.company,
      createdBy: currentUser._id,
      updatedBy: currentUser._id,
    });

    return NextResponse.json(
      { message: 'Category created successfully', category: category.toObject() },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create category error:', error);
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to create category' },
      { status: 500 }
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
    const {
      _id,
      name,
      color,
      autoCategorizing,
      autoCategoryPerson,
      rules,
      removeCategoryOnRuleFail,
    } = body;

    if (!_id) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    if (!color || typeof color !== 'string') {
      return NextResponse.json({ error: 'Category color is required' }, { status: 400 });
    }

    // Validate color format
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(color)) {
      return NextResponse.json({ error: 'Invalid color format. Use hex color (e.g., #3b82f6)' }, { status: 400 });
    }

    if (autoCategorizing && !autoCategoryPerson) {
      return NextResponse.json({ error: 'Auto Category Person is required when Auto Categorizing is enabled' }, { status: 400 });
    }

    if (autoCategorizing && (!rules || !Array.isArray(rules) || rules.length === 0)) {
      return NextResponse.json({ error: 'At least one rule is required when Auto Categorizing is enabled' }, { status: 400 });
    }

    // Validate rules
    if (rules && Array.isArray(rules)) {
      for (const rule of rules) {
        if (!rule.ruleType || !rule.condition || rule.count === undefined) {
          return NextResponse.json({ error: 'Each rule must have ruleType, condition, and count' }, { status: 400 });
        }
        if (rule.within && !rule.days) {
          return NextResponse.json({ error: 'Days is required when Within is selected' }, { status: 400 });
        }
      }
    }

    const category = await Category.findOneAndUpdate(
      { _id, company: currentUser.company },
      {
        name: name.trim(),
        color,
        autoCategorizing: Boolean(autoCategorizing),
        autoCategoryPerson: autoCategorizing ? autoCategoryPerson : undefined,
        rules: rules || [],
        removeCategoryOnRuleFail: Boolean(removeCategoryOnRuleFail),
        updatedBy: currentUser._id,
      },
      { new: true }
    );

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json(
      { message: 'Category updated successfully', category: category.toObject() }
    );
  } catch (error: any) {
    console.error('Update category error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update category' },
      { status: 500 }
    );
  }
}

