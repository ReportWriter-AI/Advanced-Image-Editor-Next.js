import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/auth-helpers';
import SampleReport from '../../../../../src/models/SampleReport';

type ReportInput = {
  id?: unknown;
  order?: unknown;
};

type ReportUpdate = {
  id: string;
  order: number;
};

const hasReports = (value: unknown): value is { reports: unknown } =>
  Boolean(value) && typeof value === 'object' && value !== null && 'reports' in value;

export async function PATCH(request: NextRequest) {
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

    const body = (await request.json()) as unknown;
    const reports: unknown[] =
      hasReports(body) && Array.isArray(body.reports) ? body.reports : [];

    if (!reports.length) {
      return NextResponse.json({ error: 'Reports payload is required' }, { status: 400 });
    }

    const updates: ReportUpdate[] = reports
      .filter((item): item is ReportInput & { id: string; order: unknown } => {
        if (!item || typeof item !== 'object') {
          return false;
        }

        const { id, order } = item as ReportInput;

        if (typeof id !== 'string' || !id.trim()) {
          return false;
        }

        return Number.isFinite(Number(order));
      })
      .map((item) => ({
        id: item.id.trim(),
        order: Number(item.order),
      }));

    if (!updates.length) {
      return NextResponse.json({ error: 'No valid reports provided for reorder' }, { status: 400 });
    }

    const ids = updates.map((u) => u.id);
    const existing = await SampleReport.find({
      _id: { $in: ids },
      company: currentUser.company,
    })
      .select('_id')
      .lean();

    if (existing.length !== updates.length) {
      return NextResponse.json({ error: 'One or more reports are invalid' }, { status: 400 });
    }

    const bulkOps = updates.map((u) => ({
      updateOne: {
        filter: { _id: u.id, company: currentUser.company },
        update: { $set: { order: u.order } },
      },
    }));

    await SampleReport.bulkWrite(bulkOps);

    return NextResponse.json({ message: 'Sample reports reordered' });
  } catch (error: any) {
    console.error('Reorder sample reports error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reorder sample reports' },
      { status: 500 }
    );
  }
}


