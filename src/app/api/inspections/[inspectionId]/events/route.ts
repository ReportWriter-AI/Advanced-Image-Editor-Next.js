import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import Event from '@/src/models/Event';
import Inspection from '@/src/models/Inspection';
import { getCurrentUser } from '@/lib/auth-helpers';
import mongoose from 'mongoose';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId } = await params;
    
    if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: 'Invalid inspection ID' },
        { status: 400 }
      );
    }

    // Fetch all events for this inspection
    const events = await Event.find({
      inspectionId: new mongoose.Types.ObjectId(inspectionId),
    })
      .populate('inspector', 'firstName lastName profileImageUrl')
      .sort({ startDate: 1 })
      .lean();

    // Format events
    const formattedEvents = events.map((event) => ({
      _id: event._id.toString(),
      inspectionId: event.inspectionId.toString(),
      name: event.name,
      description: event.description || '',
      inspector: event.inspector && typeof event.inspector === 'object'
        ? {
            _id: (event.inspector as any)._id.toString(),
            firstName: (event.inspector as any).firstName || '',
            lastName: (event.inspector as any).lastName || '',
            profileImageUrl: (event.inspector as any).profileImageUrl || '',
          }
        : null,
      startDate: event.startDate ? new Date(event.startDate).toISOString() : null,
      endDate: event.endDate ? new Date(event.endDate).toISOString() : null,
      createdAt: event.createdAt ? new Date(event.createdAt).toISOString() : null,
      updatedAt: event.updatedAt ? new Date(event.updatedAt).toISOString() : null,
    }));

    return NextResponse.json({ events: formattedEvents }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId } = await params;
    
    if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: 'Invalid inspection ID' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, description, inspector, startDate, endDate } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Event name is required' },
        { status: 400 }
      );
    }

    if (!startDate) {
      return NextResponse.json(
        { error: 'Start date is required' },
        { status: 400 }
      );
    }

    if (!endDate) {
      return NextResponse.json(
        { error: 'End date is required' },
        { status: 400 }
      );
    }

    // Create the event
    const event = await Event.create({
      inspectionId: new mongoose.Types.ObjectId(inspectionId),
      name: name.trim(),
      description: description?.trim() || undefined,
      inspector: inspector && mongoose.Types.ObjectId.isValid(inspector)
        ? new mongoose.Types.ObjectId(inspector)
        : undefined,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    // Populate the created event
    const populatedEvent = await Event.findById(event._id)
      .populate('inspector', 'firstName lastName profileImageUrl')
      .lean();

    if (!populatedEvent) {
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      );
    }

    // Check if inspection is confirmed before triggering automation
    const inspection = await Inspection.findById(inspectionId).lean();
    if (inspection?.confirmedInspection) {
      const { checkAndProcessTriggers } = await import('@/lib/automation-trigger-helper');
      await checkAndProcessTriggers(inspectionId, 'INSPECTION_EVENT_CREATED');
    }

    const formattedEvent = {
      _id: populatedEvent._id.toString(),
      inspectionId: populatedEvent.inspectionId.toString(),
      name: populatedEvent.name,
      description: populatedEvent.description || '',
      inspector: populatedEvent.inspector && typeof populatedEvent.inspector === 'object'
        ? {
            _id: (populatedEvent.inspector as any)._id.toString(),
            firstName: (populatedEvent.inspector as any).firstName || '',
            lastName: (populatedEvent.inspector as any).lastName || '',
            profileImageUrl: (populatedEvent.inspector as any).profileImageUrl || '',
          }
        : null,
      startDate: populatedEvent.startDate ? new Date(populatedEvent.startDate).toISOString() : null,
      endDate: populatedEvent.endDate ? new Date(populatedEvent.endDate).toISOString() : null,
      createdAt: populatedEvent.createdAt ? new Date(populatedEvent.createdAt).toISOString() : null,
      updatedAt: populatedEvent.updatedAt ? new Date(populatedEvent.updatedAt).toISOString() : null,
    };

    return NextResponse.json(
      { message: 'Event created successfully', event: formattedEvent },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating event:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create event' },
      { status: 500 }
    );
  }
}

