import { NextRequest, NextResponse } from 'next/server';

import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Person from '@/src/models/Person';
import Category from '@/src/models/Category';

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

    // Get all unique category IDs from people
    const people = await Person.find({ company: currentUser.company })
      .select('categories')
      .lean();

    const categoryIds = new Set<string>();
    people.forEach((person) => {
      if (person.categories && Array.isArray(person.categories)) {
        person.categories.forEach((categoryId: any) => {
          const id = typeof categoryId === 'string' ? categoryId : categoryId.toString();
          categoryIds.add(id);
        });
      }
    });

    // Get category details
    const categories = await Category.find({
      _id: { $in: Array.from(categoryIds) },
      company: currentUser.company,
    })
      .select('_id name color')
      .sort({ name: 1 })
      .lean();

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error('Get people categories error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

