import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/auth-helpers';
import Service from '../../../../../src/models/Service';

type ServiceInput = {
  id?: unknown;
  order?: unknown;
};

type ServiceUpdate = {
  id: string;
  order: number;
};

const hasServices = (value: unknown): value is { services: unknown } =>
  Boolean(value) && typeof value === 'object' && value !== null && 'services' in value;

export async function PATCH(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ error: 'No company associated with current user' }, { status: 400 });
    }

    const body = (await request.json()) as unknown;
    const services: unknown[] =
      hasServices(body) && Array.isArray(body.services) ? body.services : [];

    if (!services.length) {
      return NextResponse.json({ error: 'Services payload is required' }, { status: 400 });
    }

    const updates: ServiceUpdate[] = services
      .filter((item): item is ServiceInput & { id: string; order: unknown } => {
        if (!item || typeof item !== 'object') {
          return false;
        }

        const { id, order } = item as ServiceInput;

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
      return NextResponse.json({ error: 'No valid services provided for reorder' }, { status: 400 });
    }

    const ids = updates.map((u) => u.id);
    const existing = await Service.find({
      _id: { $in: ids },
      company: currentUser.company,
    })
      .select('_id')
      .lean();

    if (existing.length !== updates.length) {
      return NextResponse.json({ error: 'One or more services are invalid' }, { status: 400 });
    }

    const now = new Date();
    const bulkOps = updates.map((u) => ({
      updateOne: {
        filter: { _id: u.id, company: currentUser.company },
        update: { $set: { orderIndex: u.order, updatedAt: now } },
      },
    }));

    await Service.bulkWrite(bulkOps);

    return NextResponse.json({ message: 'Services reordered' });
  } catch (error: any) {
    console.error('Reorder services error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reorder services' },
      { status: 500 }
    );
  }
}


