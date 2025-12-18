/**
 * API endpoint to manually trigger or test automation execution
 */

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Inspection from '@/src/models/Inspection';
import { processTrigger } from '@/src/lib/automation-trigger-service';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { inspectionId, triggerIndex, triggerEvent } = body;

    if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json({ error: 'Invalid inspection ID' }, { status: 400 });
    }

    if (typeof triggerIndex !== 'number' || triggerIndex < 0) {
      return NextResponse.json({ error: 'Invalid trigger index' }, { status: 400 });
    }

    if (!triggerEvent || typeof triggerEvent !== 'string') {
      return NextResponse.json({ error: 'Invalid trigger event' }, { status: 400 });
    }

    // Fetch inspection and verify ownership
    const inspection = await Inspection.findById(inspectionId).lean();
    if (!inspection) {
      return NextResponse.json({ error: 'Inspection not found' }, { status: 404 });
    }

    if (inspection.companyId.toString() !== currentUser.company?.toString()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get trigger config
    if (!inspection.triggers || !inspection.triggers[triggerIndex]) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }

    const triggerData = inspection.triggers[triggerIndex];

    // Process the trigger
    const result = await processTrigger(
      inspectionId,
      triggerIndex,
      triggerData as any,
      triggerEvent
    );

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || 'Failed to execute trigger',
          queued: result.queued,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      queued: result.queued,
      message: result.queued ? 'Trigger queued for later execution' : 'Trigger executed successfully',
    });
  } catch (error: any) {
    console.error('Error executing trigger:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to execute trigger' },
      { status: 500 }
    );
  }
}

