import { NextRequest, NextResponse } from 'next/server';

import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Agent from '@/src/models/Agent';
import '@/src/models/Agency';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ agents: [] });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Build query
    const query: any = { company: currentUser.company };

    // Add search filter (name or email search)
    if (search.trim()) {
      query.$or = [
        { firstName: { $regex: search.trim(), $options: 'i' } },
        { lastName: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const agents = await Agent.find(query)
      .select('firstName lastName email ccEmail phone photoUrl agency categories internalNotes internalAdminNotes')
      .populate('agency', 'name')
      .populate('categories', 'name')
      .limit(limit)
      .sort({ firstName: 1, lastName: 1 })
      .lean();

    return NextResponse.json({ agents });
  } catch (error: any) {
    console.error('Search agents error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search agents' },
      { status: 500 }
    );
  }
}

