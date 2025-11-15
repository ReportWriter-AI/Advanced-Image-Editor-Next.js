import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import ModifierField from '@/src/models/ModifierField';
import { ensureDefaultModifiersForCompany } from '@/lib/modifier-service';

const normalizeKey = (key?: string, fallbackLabel?: string) => {
  const source = key?.trim() || fallbackLabel?.trim() || '';
  return source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 64);
};

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ modifiers: [] });
    }

    //@ts-ignore
    await ensureDefaultModifiersForCompany(currentUser.company, currentUser._id);

    const modifiers = await ModifierField.find({ company: currentUser.company })
      .sort({ orderIndex: 1, createdAt: 1 })
      .lean();

    return NextResponse.json({ modifiers });
  } catch (error: any) {
    console.error('Get modifiers error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch modifiers' }, { status: 500 });
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
      return NextResponse.json({ error: 'No company associated with current user' }, { status: 400 });
    }

    const body = await request.json();
    const {
      label,
      key,
      supportsType = false,
      hasEqualsField = false,
      requiresRange = false,
      group,
      description,
    } = body;

    if (!label || !label.trim()) {
      return NextResponse.json({ error: 'Label is required' }, { status: 400 });
    }

    const normalizedKey = normalizeKey(key, label);
    if (!normalizedKey) {
      return NextResponse.json({ error: 'Identifier could not be generated' }, { status: 400 });
    }

    const last = await ModifierField.findOne({ company: currentUser.company })
      .sort({ orderIndex: -1 })
      .select('orderIndex')
      .lean();

    const modifier = await ModifierField.create({
      key: normalizedKey,
      label: label.trim(),
      supportsType: Boolean(supportsType),
      hasEqualsField: Boolean(hasEqualsField),
      requiresRange: Boolean(requiresRange),
      group: group === 'custom' ? 'custom' : undefined,
      description: description?.trim() || undefined,
      orderIndex:
        typeof last?.orderIndex === 'number' && Number.isFinite(last.orderIndex) ? last.orderIndex + 1 : 1,
      company: currentUser.company,
      createdBy: currentUser._id,
    });

    return NextResponse.json({ message: 'Modifier created', modifier: modifier.toObject() }, { status: 201 });
  } catch (error: any) {
    console.error('Create modifier error:', error);
    if (error?.code === 11000) {
      return NextResponse.json({ error: 'Identifier already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Failed to create modifier' }, { status: 500 });
  }
}


