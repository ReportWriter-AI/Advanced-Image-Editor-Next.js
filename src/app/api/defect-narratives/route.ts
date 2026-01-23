import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import DefectNarrative from '@/src/models/DefectNarrative';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ 
        defectNarratives: [],
        pagination: {
          page: 1,
          limit: 100,
          total: 0,
          totalPages: 0,
        }
      });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const skip = (page - 1) * limit;

    const query = { company: currentUser.company };

    const total = await DefectNarrative.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const defectNarratives = await DefectNarrative.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json({ 
      defectNarratives,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      }
    });
  } catch (error: any) {
    console.error('Get defect narratives error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch defect narratives' },
      { status: 500 }
    );
  }
}
