import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/auth-helpers';
import SampleReport from '../../../../../src/models/SampleReport';
import Inspection from '../../../../../src/models/Inspection';

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Sample report id is required' }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.title === 'string') {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
      }
      updates.title = title;
    }

    if (typeof body.url === 'string') {
      const url = body.url.trim();
      if (!url) {
        return NextResponse.json({ error: 'URL cannot be empty' }, { status: 400 });
      }
      updates.url = url;
    }

    if (typeof body.description === 'string') {
      updates.description = body.description.trim() || undefined;
    }

    let inspectionIdForHeader: string | undefined;

    if (typeof body.inspectionId === 'string') {
      const trimmed = body.inspectionId.trim();
      updates.inspectionId = trimmed || undefined;
      inspectionIdForHeader = trimmed || undefined;
    }

    if (typeof body.headerImage === 'string') {
      const headerImage = body.headerImage.trim();
      updates.headerImage = headerImage || undefined;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    if (inspectionIdForHeader !== undefined) {
      if (inspectionIdForHeader && mongoose.Types.ObjectId.isValid(inspectionIdForHeader)) {
        const inspectionDoc = await Inspection.findById(
          new mongoose.Types.ObjectId(inspectionIdForHeader)
        )
          .select('headerImage')
          .lean();

        const headerImage =
          typeof inspectionDoc?.headerImage === 'string' && inspectionDoc.headerImage.trim()
            ? inspectionDoc.headerImage.trim()
            : undefined;

        updates.headerImage = headerImage;
      } else {
        updates.headerImage = undefined;
      }
    }

    const sampleReport = await SampleReport.findOneAndUpdate(
      { _id: id, company: currentUser.company },
      { $set: updates },
      { new: true }
    ).lean();

    if (!sampleReport) {
      return NextResponse.json({ error: 'Sample report not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Sample report updated', sampleReport });
  } catch (error: any) {
    console.error('Update sample report error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update sample report' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Sample report id is required' }, { status: 400 });
    }

    const sampleReport = await SampleReport.findOne({ _id: id, company: currentUser.company }).lean();
    if (!sampleReport) {
      return NextResponse.json({ error: 'Sample report not found' }, { status: 404 });
    }

    await SampleReport.deleteOne({ _id: id, company: currentUser.company });

    await SampleReport.updateMany(
      {
        company: currentUser.company,
        order: { $gt: sampleReport.order },
      },
      { $inc: { order: -1 } }
    );

    return NextResponse.json({ message: 'Sample report deleted' });
  } catch (error: any) {
    console.error('Delete sample report error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete sample report' },
      { status: 500 }
    );
  }
}


