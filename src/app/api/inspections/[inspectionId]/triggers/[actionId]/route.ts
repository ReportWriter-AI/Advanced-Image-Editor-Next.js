import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Inspection from '@/src/models/Inspection';

interface RouteParams {
  params: Promise<{
    inspectionId: string;
    actionId: string;
  }>;
}

export async function PATCH(
  request: NextRequest,
  context: RouteParams
) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId, actionId } = await context.params;
    const body = await request.json();
    const { isDisabled } = body;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: 'Invalid inspection ID' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(actionId)) {
      return NextResponse.json(
        { error: 'Invalid action ID' },
        { status: 400 }
      );
    }

    if (typeof isDisabled !== 'boolean') {
      return NextResponse.json(
        { error: 'isDisabled must be a boolean' },
        { status: 400 }
      );
    }

    // Find the inspection
    const inspection = await Inspection.findById(inspectionId);

    if (!inspection) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
    }

    // Verify the inspection belongs to the user's company
    if (inspection.companyId.toString() !== currentUser.company?.toString()) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Find and update the trigger
    const actionObjectId = new mongoose.Types.ObjectId(actionId);
    const triggers = inspection.triggers || [];
    const triggerIndex = triggers.findIndex(
      (t: any) => t.actionId && t.actionId.toString() === actionId
    );

    if (triggerIndex === -1) {
      return NextResponse.json(
        { error: 'Trigger not found' },
        { status: 404 }
      );
    }

    // Update the trigger's isDisabled status
    triggers[triggerIndex].isDisabled = isDisabled;

    // Update the inspection
    await Inspection.findByIdAndUpdate(inspectionId, {
      triggers: triggers,
    });

    return NextResponse.json(
      { message: 'Trigger updated successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating trigger:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update trigger' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteParams
) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId, actionId } = await context.params;

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: 'Invalid inspection ID' },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(actionId)) {
      return NextResponse.json(
        { error: 'Invalid action ID' },
        { status: 400 }
      );
    }

    // Find the inspection
    const inspection = await Inspection.findById(inspectionId);

    if (!inspection) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
    }

    // Verify the inspection belongs to the user's company
    if (inspection.companyId.toString() !== currentUser.company?.toString()) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Remove the trigger from the array
    const triggers = inspection.triggers || [];
    const filteredTriggers = triggers.filter(
      (t: any) => !t.actionId || t.actionId.toString() !== actionId
    );

    // Update the inspection
    await Inspection.findByIdAndUpdate(inspectionId, {
      triggers: filteredTriggers,
    });

    return NextResponse.json(
      { message: 'Trigger deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting trigger:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete trigger' },
      { status: 500 }
    );
  }
}

