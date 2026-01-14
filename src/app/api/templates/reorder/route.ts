import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/auth-helpers';
import Template from '../../../../../src/models/Template';

type TemplateInput = {
  id?: unknown;
  order?: unknown;
};

type TemplateUpdate = {
  id: string;
  order: number;
};

const hasTemplates = (value: unknown): value is { templates: unknown } =>
  Boolean(value) && typeof value === 'object' && value !== null && 'templates' in value;

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
    const templates: unknown[] =
      hasTemplates(body) && Array.isArray(body.templates) ? body.templates : [];

    if (!templates.length) {
      return NextResponse.json({ error: 'Templates payload is required' }, { status: 400 });
    }

    const updates: TemplateUpdate[] = templates
      .filter((item): item is TemplateInput & { id: string; order: unknown } => {
        if (!item || typeof item !== 'object') {
          return false;
        }

        const { id, order } = item as TemplateInput;

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
      return NextResponse.json({ error: 'No valid templates provided for reorder' }, { status: 400 });
    }

    const ids = updates.map((u) => u.id);
    const existing = await Template.find({
      _id: { $in: ids },
      company: currentUser.company,
      deletedAt: null,
    })
      .select('_id')
      .lean();

    if (existing.length !== updates.length) {
      return NextResponse.json({ error: 'One or more templates are invalid' }, { status: 400 });
    }

    const now = new Date();
    const bulkOps = updates.map((u) => ({
      updateOne: {
        filter: { _id: u.id, company: currentUser.company },
        update: { $set: { orderIndex: u.order, updatedAt: now } },
      },
    }));

    await Template.bulkWrite(bulkOps);

    return NextResponse.json({ message: 'Templates reordered' });
  } catch (error: any) {
    console.error('Reorder templates error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reorder templates' },
      { status: 500 }
    );
  }
}
