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
      return NextResponse.json({ categories: [] });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    const categories = await Category.find({
      company: currentUser.company,
      name: { $regex: query, $options: 'i' },
    })
      .select('_id name color')
      .limit(20)
      .lean();

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error('Search categories error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search categories' },
      { status: 500 }
    );
  }
}

