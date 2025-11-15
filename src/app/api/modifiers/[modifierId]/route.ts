import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import ModifierField from '@/src/models/ModifierField';
import Service from '@/src/models/Service';

const isValidObjectId = (value: string) => mongoose.Types.ObjectId.isValid(value);

export async function DELETE(
  request: NextRequest,
  { params }: { params: { modifierId: string } }
) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ error: 'No company associated with current user' }, { status: 400 });
    }

    const modifierId = params?.modifierId;
    if (!modifierId || !isValidObjectId(modifierId)) {
      return NextResponse.json({ error: 'Invalid modifier identifier' }, { status: 400 });
    }

    const modifier = await ModifierField.findOne({
      _id: modifierId,
      company: currentUser.company,
    });

    if (!modifier) {
      return NextResponse.json({ error: 'Modifier not found' }, { status: 404 });
    }

    const modifierKey = modifier.key;

    const isInUse = await Service.exists({
      company: currentUser.company,
      $or: [
        { 'modifiers.field': modifierKey },
        { 'addOns.modifiers.field': modifierKey },
      ],
    });

    if (isInUse) {
      return NextResponse.json(
        { error: 'This modifier is being used. Remove it from services first.' },
        { status: 400 }
      );
    }

    await ModifierField.deleteOne({ _id: modifierId, company: currentUser.company });

    return NextResponse.json({ message: 'Modifier deleted' });
  } catch (error: any) {
    console.error('Delete modifier error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete modifier' }, { status: 500 });
  }
}


