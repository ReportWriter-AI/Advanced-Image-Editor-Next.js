import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/auth-helpers';
import SampleReport from '../../../../src/models/SampleReport';
import Inspection from '../../../../src/models/Inspection';

const fetchHeaderImagesForInspections = async (inspectionIds: string[]) => {
  const validInspectionObjectIds = inspectionIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

  if (validInspectionObjectIds.length === 0) {
    return new Map<string, string>();
  }

  const inspectionDocs = await Inspection.find(
    { _id: { $in: validInspectionObjectIds.map((id) => new mongoose.Types.ObjectId(id)) } }
  )
    .select('headerImage')
    .lean();

  const headerMap = new Map<string, string>();
  inspectionDocs.forEach((doc) => {
    const headerImage =
      typeof doc.headerImage === 'string' && doc.headerImage.trim() ? doc.headerImage.trim() : undefined;
    if (headerImage) {
      headerMap.set(doc._id.toString(), headerImage);
    }
  });

  return headerMap;
};

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

    const inspectionIdSet = new Set(
      sampleReports
        .map((report) =>
          typeof report.inspectionId === 'string' ? report.inspectionId.trim() : ''
        )
        .filter((id): id is string => id.length > 0)
    );

    let sampleReportsWithHeader = sampleReports;

    if (inspectionIdSet.size > 0) {
      const headerMap = await fetchHeaderImagesForInspections(Array.from(inspectionIdSet));

      if (headerMap.size > 0) {
        sampleReportsWithHeader = sampleReports.map((report) => {
          const inspectionId =
            typeof report.inspectionId === 'string' ? report.inspectionId.trim() : '';

          if (!inspectionId) {
            return report;
          }
          const headerImage = headerMap.get(inspectionId) ?? report.headerImage;
          return headerImage ? { ...report, headerImage } : report;
        });
      }
    }

    return NextResponse.json({ sampleReports: sampleReportsWithHeader });
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

    let headerImage: string | undefined;
    if (inspectionId && mongoose.Types.ObjectId.isValid(inspectionId)) {
      const headerMap = await fetchHeaderImagesForInspections([inspectionId]);
      headerImage = headerMap.get(inspectionId);
    }

    const sampleReport = await SampleReport.create({
      company: currentUser.company,
      createdBy: currentUser._id,
      title,
      url,
      description: description || undefined,
      inspectionId: inspectionId || undefined,
      headerImage: headerImage || undefined,
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


