import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../../lib/db';
import { getCurrentUser } from '../../../../../../lib/auth-helpers';
import SchedulingOptions from '../../../../../../src/models/SchedulingOptions';
import mongoose from 'mongoose';

export async function PATCH(request: NextRequest) {
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
    const { fieldIds } = body;

    if (!Array.isArray(fieldIds)) {
      return NextResponse.json(
        { error: 'fieldIds must be an array' },
        { status: 400 }
      );
    }

    const optionsDoc = await SchedulingOptions.findOne({ company: currentUser.company });

    if (!optionsDoc) {
      return NextResponse.json(
        { error: 'Scheduling options not found' },
        { status: 404 }
      );
    }

    const customFields = optionsDoc.customFields || [];
    
    // Create a map of fieldId to field object
    const fieldMap = new Map<string, any>();
    customFields.forEach((field: any) => {
      const fieldIdStr = String(field._id);
      fieldMap.set(fieldIdStr, field.toObject ? field.toObject() : field);
    });

    // Reorder fields based on fieldIds array and update orderIndex
    const reorderedFields = fieldIds.map((fieldId: string, index: number) => {
      const field = fieldMap.get(fieldId);
      if (!field) {
        throw new Error(`Field with ID ${fieldId} not found`);
      }
      return {
        ...field,
        orderIndex: index,
      };
    });

    // Add any fields that weren't in the reorder list (shouldn't happen, but safety check)
    fieldMap.forEach((field, fieldId) => {
      if (!fieldIds.includes(fieldId)) {
        reorderedFields.push({
          ...field,
          orderIndex: reorderedFields.length,
        });
      }
    });

    // Update the entire customFields array
    const updatedDoc = await SchedulingOptions.findOneAndUpdate(
      { company: currentUser.company },
      { $set: { customFields: reorderedFields } },
      { new: true, runValidators: true }
    );

    return NextResponse.json({
      message: 'Custom fields reordered successfully',
      customFields: updatedDoc?.customFields || [],
    });
  } catch (error: any) {
    console.error('Custom Fields Reorder error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to reorder custom fields' },
      { status: 500 }
    );
  }
}

