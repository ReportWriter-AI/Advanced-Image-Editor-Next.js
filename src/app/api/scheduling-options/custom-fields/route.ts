import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/db';
import { getCurrentUser } from '../../../../../lib/auth-helpers';
import SchedulingOptions from '../../../../../src/models/SchedulingOptions';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ customFields: [] });
    }

    const optionsDoc = await SchedulingOptions.findOne({ company: currentUser.company });

    return NextResponse.json({
      customFields: optionsDoc?.customFields || [],
    });
  } catch (error: any) {
    console.error('Custom Fields GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load custom fields' },
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
        { error: 'Company not found. Please complete your profile first.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Generate unique field key
    const generateFieldKey = (name: string): string => {
      const baseKey = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      const timestamp = Date.now().toString(36);
      return `${baseKey}_${timestamp}`;
    };

    // Get existing fields to determine orderIndex
    const existingDoc = await SchedulingOptions.findOne({ company: currentUser.company });
    const existingFields = existingDoc?.customFields || [];
    const maxOrderIndex = existingFields.length > 0
      ? Math.max(...existingFields.map((f: any) => f.orderIndex || 0))
      : -1;

    const newField = {
      _id: new mongoose.Types.ObjectId(),
      name: body.name?.trim() || '',
      fieldKey: generateFieldKey(body.name?.trim() || 'field'),
      fieldType: body.fieldType,
      requiredForOnlineScheduler: Boolean(body.requiredForOnlineScheduler),
      displayOnSpectoraApp: body.displayOnSpectoraApp !== undefined ? Boolean(body.displayOnSpectoraApp) : true,
      showInOnlineSchedulerOrGetQuote: Boolean(body.showInOnlineSchedulerOrGetQuote),
      orderIndex: maxOrderIndex + 1,
      ...(body.calendarIcon && { calendarIcon: body.calendarIcon.trim() }),
      ...(body.dropdownOptions && Array.isArray(body.dropdownOptions) && {
        dropdownOptions: body.dropdownOptions.map((opt: string) => opt.trim()).filter((opt: string) => opt.length > 0),
      }),
    };

    if (!newField.name) {
      return NextResponse.json(
        { error: 'Field name is required' },
        { status: 400 }
      );
    }

    if (!newField.fieldType) {
      return NextResponse.json(
        { error: 'Field type is required' },
        { status: 400 }
      );
    }

    const optionsDoc = await SchedulingOptions.findOneAndUpdate(
      { company: currentUser.company },
      {
        $push: { customFields: newField },
      },
      {
        new: true,
        runValidators: true,
        upsert: true,
      }
    );

    if (!optionsDoc) {
      return NextResponse.json(
        { error: 'Failed to create custom field' },
        { status: 500 }
      );
    }

    const createdField = optionsDoc.customFields?.[optionsDoc.customFields.length - 1];

    return NextResponse.json({
      message: 'Custom field created successfully',
      customField: createdField,
    });
  } catch (error: any) {
    console.error('Custom Fields POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create custom field' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json(
        { error: 'Company not found. Please complete your profile first.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (!body._id) {
      return NextResponse.json(
        { error: 'Field ID is required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {
      'customFields.$.name': body.name?.trim() || '',
      'customFields.$.requiredForOnlineScheduler': Boolean(body.requiredForOnlineScheduler),
      'customFields.$.displayOnSpectoraApp': body.displayOnSpectoraApp !== undefined ? Boolean(body.displayOnSpectoraApp) : true,
      'customFields.$.showInOnlineSchedulerOrGetQuote': Boolean(body.showInOnlineSchedulerOrGetQuote),
    };

    if (body.calendarIcon !== undefined) {
      updateData['customFields.$.calendarIcon'] = body.calendarIcon ? body.calendarIcon.trim() : undefined;
    }

    if (body.dropdownOptions !== undefined) {
      updateData['customFields.$.dropdownOptions'] = Array.isArray(body.dropdownOptions)
        ? body.dropdownOptions.map((opt: string) => opt.trim()).filter((opt: string) => opt.length > 0)
        : [];
    }

    const optionsDoc = await SchedulingOptions.findOneAndUpdate(
      {
        company: currentUser.company,
        'customFields._id': new mongoose.Types.ObjectId(body._id),
      },
      {
        $set: updateData,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!optionsDoc) {
      return NextResponse.json(
        { error: 'Custom field not found' },
        { status: 404 }
      );
    }

    const updatedField = optionsDoc.customFields?.find(
      (field) => String(field._id) === String(body._id)
    );

    return NextResponse.json({
      message: 'Custom field updated successfully',
      customField: updatedField,
    });
  } catch (error: any) {
    console.error('Custom Fields PUT error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update custom field' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json(
        { error: 'Company not found. Please complete your profile first.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fieldId = searchParams.get('id');

    if (!fieldId) {
      return NextResponse.json(
        { error: 'Field ID is required' },
        { status: 400 }
      );
    }

    const optionsDoc = await SchedulingOptions.findOneAndUpdate(
      { company: currentUser.company },
      {
        $pull: { customFields: { _id: new mongoose.Types.ObjectId(fieldId) } },
      },
      {
        new: true,
      }
    );

    if (!optionsDoc) {
      return NextResponse.json(
        { error: 'Custom field not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Custom field deleted successfully',
    });
  } catch (error: any) {
    console.error('Custom Fields DELETE error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete custom field' },
      { status: 500 }
    );
  }
}

