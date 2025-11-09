import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/auth-helpers';
import SampleReport from '../../../../src/models/SampleReport';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ sampleReports: [] }, { status: 200 });
    }

    const sampleReports = await SampleReport.find({ company: currentUser.company })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    return NextResponse.json({ sampleReports });
  } catch (error: any) {
    console.error('Get sample reports error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sample reports' },
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
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    const inspectionId =
      typeof body.inspectionId === 'string' ? body.inspectionId.trim() : '';

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const maxOrderDoc = await SampleReport.findOne({ company: currentUser.company })
      .sort({ order: -1 })
      .select('order')
      .lean();

    const nextOrder = typeof maxOrderDoc?.order === 'number' ? maxOrderDoc.order + 1 : 1;

    const sampleReport = await SampleReport.create({
      company: currentUser.company,
      createdBy: currentUser._id,
      title,
      url,
      description: description || undefined,
      inspectionId: inspectionId || undefined,
      order: nextOrder,
    });

    return NextResponse.json(
      { message: 'Sample report created', sampleReport: sampleReport.toObject() },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create sample report error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create sample report' },
      { status: 500 }
    );
  }
}


