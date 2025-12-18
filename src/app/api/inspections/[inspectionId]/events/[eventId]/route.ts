import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Event from '@/src/models/Event';
import Inspection from '@/src/models/Inspection';
import { getCurrentUser } from '@/lib/auth-helpers';
import mongoose from 'mongoose';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string; eventId: string }> }
) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId, eventId } = await params;
    
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return NextResponse.json(
        { error: 'Invalid event ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, description, inspector, startDate, endDate } = body;

    // Build update object
    const updateData: any = {};

    if (name !== undefined) {
      if (!name.trim()) {
        return NextResponse.json(
          { error: 'Event name cannot be empty' },
          { status: 400 }
        );
      }
      updateData.name = name.trim();
    }

    if (description !== undefined) {
      updateData.description = description.trim() || undefined;
    }

    if (inspector !== undefined) {
      updateData.inspector = inspector && mongoose.Types.ObjectId.isValid(inspector)
        ? new mongoose.Types.ObjectId(inspector)
        : undefined;
    }

    if (startDate !== undefined) {
      updateData.startDate = new Date(startDate);
    }

    if (endDate !== undefined) {
      updateData.endDate = new Date(endDate);
    }

    // Update the event
    const result = await Event.updateOne(
      {
        _id: new mongoose.Types.ObjectId(eventId),
        inspectionId: new mongoose.Types.ObjectId(inspectionId),
      },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Fetch updated event
    const updatedEvent = await Event.findById(eventId)
      .populate('inspector', 'firstName lastName profileImageUrl')
      .lean();

    if (!updatedEvent) {
      return NextResponse.json(
        { error: 'Failed to fetch updated event' },
        { status: 500 }
      );
    }

    const formattedEvent = {
      _id: updatedEvent._id.toString(),
      inspectionId: updatedEvent.inspectionId.toString(),
      name: updatedEvent.name,
      description: updatedEvent.description || '',
      inspector: updatedEvent.inspector && typeof updatedEvent.inspector === 'object'
        ? {
            _id: (updatedEvent.inspector as any)._id.toString(),
            firstName: (updatedEvent.inspector as any).firstName || '',
            lastName: (updatedEvent.inspector as any).lastName || '',
            profileImageUrl: (updatedEvent.inspector as any).profileImageUrl || '',
          }
        : null,
      startDate: updatedEvent.startDate ? new Date(updatedEvent.startDate).toISOString() : null,
      endDate: updatedEvent.endDate ? new Date(updatedEvent.endDate).toISOString() : null,
      createdAt: updatedEvent.createdAt ? new Date(updatedEvent.createdAt).toISOString() : null,
      updatedAt: updatedEvent.updatedAt ? new Date(updatedEvent.updatedAt).toISOString() : null,
    };

    // Check if inspection is confirmed before triggering automation
    const inspection = await Inspection.findById(inspectionId).lean();
    if (inspection?.confirmedInspection) {
      const { checkAndProcessTriggers } = await import('@/lib/automation-trigger-helper');
      await checkAndProcessTriggers(inspectionId, 'INSPECTION_EVENT_UPDATED');
    }

    return NextResponse.json(
      { message: 'Event updated successfully', event: formattedEvent },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update event' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string; eventId: string }> }
) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId, eventId } = await params;
    
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return NextResponse.json(
        { error: 'Invalid event ID' },
        { status: 400 }
      );
    }

    // Delete the event
    const result = await Event.deleteOne({
      _id: new mongoose.Types.ObjectId(eventId),
      inspectionId: new mongoose.Types.ObjectId(inspectionId),
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Check if inspection is confirmed before triggering automation
    const inspection = await Inspection.findById(inspectionId).lean();
    if (inspection?.confirmedInspection) {
      const { checkAndProcessTriggers } = await import('@/lib/automation-trigger-helper');
      await checkAndProcessTriggers(inspectionId, 'INSPECTION_EVENT_DELETED');
    }

    return NextResponse.json(
      { message: 'Event deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete event' },
      { status: 500 }
    );
  }
}

