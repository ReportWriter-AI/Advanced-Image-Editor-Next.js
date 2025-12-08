import { NextRequest, NextResponse } from "next/server";
import { createInspection, getAllInspections } from "@/lib/inspection";
import { getCurrentUser } from "@/lib/auth-helpers";
import dbConnect from "@/lib/db";
import Event from "@/src/models/Event";
import OrderIdCounter from "@/src/models/OrderIdCounter";
import Inspection from "@/src/models/Inspection";
import mongoose from "mongoose";
import { createOrUpdateClient, createOrUpdateAgent } from "@/lib/client-agent-utils";
import { generateSecureToken } from "@/src/lib/token-utils";

const mapInspectionResponse = (inspection: any) => {
  if (!inspection) return null;
  return {
    ...inspection,
    id: inspection.id ?? inspection._id ?? inspection.id,
  };
};

// POST /api/inspections → create inspection
export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json(
        { error: "User is not associated with a company" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const status = body.status ?? "Pending";
    const date = body.date ?? body.dateTime;
    const inspector = body.inspector;
    const companyOwnerRequested = body.companyOwnerRequested ?? false;
    const services = body.services || [];
    const discountCode = body.discountCode;
    const location = body.location;
    const clients = body.clients || [];
    const events = body.events || [];
    const requirePaymentToReleaseReports = body.requirePaymentToReleaseReports ?? true;
    const paymentNotes = body.paymentNotes;
    const agents = body.agents || [];
    const listingAgents = body.listingAgents || [];
    const referralSource = body.referralSource;
    const confirmedInspection = body.confirmedInspection ?? true;
    const disableAutomatedNotifications = body.disableAutomatedNotifications ?? false;
    const internalNotes = body.internalNotes;
    const customData = body.customData || {};

    // Generate Order ID using OrderIdCounter
    let orderId: number | undefined = undefined;
    try {
      const counter = await OrderIdCounter.findOneAndUpdate(
        { company: currentUser.company },
        { $inc: { lastOrderId: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      orderId = counter.lastOrderId; // This will be 1001 for first inspection (1000 + 1)
    } catch (error) {
      console.error('Error generating Order ID:', error);
      // Continue without orderId if generation fails
    }

    // Generate unique token for client view access
    let token: string | undefined = undefined;
    let tokenGenerationAttempts = 0;
    const maxTokenAttempts = 5;
    
    while (tokenGenerationAttempts < maxTokenAttempts) {
      try {
        const generatedToken = generateSecureToken();
        // Check if token already exists
        const existingInspection = await Inspection.findOne({ token: generatedToken });
        if (!existingInspection) {
          token = generatedToken;
          break;
        }
        tokenGenerationAttempts++;
      } catch (error) {
        console.error('Error generating token:', error);
        tokenGenerationAttempts++;
      }
    }
    
    if (!token) {
      console.error('Failed to generate unique token after multiple attempts');
      // Continue without token - token is optional
    }

    const inspection = await createInspection({
      status,
      date,
      companyId: currentUser.company.toString(),
      createdBy: currentUser._id?.toString(),
      inspector,
      companyOwnerRequested,
      services,
      discountCode,
      location,
      requirePaymentToReleaseReports,
      paymentNotes,
      orderId,
      referralSource: referralSource?.trim() || undefined,
      confirmedInspection,
      disableAutomatedNotifications,
      internalNotes: internalNotes?.trim() || undefined,
      token,
      customData,
    });

    // Handle clients creation/update
    const clientIds: mongoose.Types.ObjectId[] = [];
    
    if (clients.length > 0) {
      for (const clientData of clients) {
        const clientId = await createOrUpdateClient(
          clientData,
          currentUser.company as mongoose.Types.ObjectId,
          currentUser._id as mongoose.Types.ObjectId
        );

        if (clientId) {
          clientIds.push(clientId);
        }
      }

      // Update inspection with all client IDs
      if (inspection?._id && clientIds.length > 0) {
        await Inspection.findByIdAndUpdate(inspection._id, {
          clients: clientIds,
        });
      }
    }

    // Handle events creation
    if (events.length > 0 && inspection?._id) {
      const inspectionId = inspection._id || inspection.id;
      if (inspectionId) {
        const eventsToCreate = events.map((eventData: any) => ({
          inspectionId: new mongoose.Types.ObjectId(inspectionId),
          name: eventData.name?.trim() || '',
          description: eventData.description?.trim() || undefined,
          inspector: eventData.inspector && mongoose.Types.ObjectId.isValid(eventData.inspector)
            ? new mongoose.Types.ObjectId(eventData.inspector)
            : undefined,
          startDate: eventData.startDate ? new Date(eventData.startDate) : undefined,
          endDate: eventData.endDate ? new Date(eventData.endDate) : undefined,
        })).filter((event: any) => event.name && event.startDate && event.endDate);

        if (eventsToCreate.length > 0) {
          await Event.insertMany(eventsToCreate);
        }
      }
    }

    // Handle agents creation/update
    const agentIds: mongoose.Types.ObjectId[] = [];
    
    if (agents.length > 0) {
      for (const agentData of agents) {
        const agentId = await createOrUpdateAgent(
          agentData,
          currentUser.company as mongoose.Types.ObjectId,
          currentUser._id as mongoose.Types.ObjectId
        );

        if (agentId) {
          agentIds.push(agentId);
        }
      }

      // Update inspection with all agent IDs
      if (inspection?._id && agentIds.length > 0) {
        await Inspection.findByIdAndUpdate(inspection._id, {
          agents: agentIds,
        });
      }
    }

    // Handle listing agents creation/update
    const listingAgentIds: mongoose.Types.ObjectId[] = [];
    
    if (listingAgents.length > 0) {
      for (const agentData of listingAgents) {
        const agentId = await createOrUpdateAgent(
          agentData,
          currentUser.company as mongoose.Types.ObjectId,
          currentUser._id as mongoose.Types.ObjectId
        );

        if (agentId) {
          listingAgentIds.push(agentId);
        }
      }

      // Update inspection with all listing agent IDs
      if (inspection?._id && listingAgentIds.length > 0) {
        await Inspection.findByIdAndUpdate(inspection._id, {
          listingAgent: listingAgentIds,
        });
      }
    }

    return NextResponse.json(mapInspectionResponse(inspection), { status: 201 });
  } catch (error: any) {
    console.log("error", error);
    return NextResponse.json(
      { error: error.message || "Failed to create inspection" },
      { status: 500 }
    );
  }
}

// GET /api/inspections → list all with filters and search
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json([], { status: 200 });
    }

    // Get query parameters
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') as 'all' | 'today' | 'tomorrow' | 'pending' | 'in-progress' | 'trash' || 'all';
    const search = searchParams.get('search') || '';

    const inspections = await getAllInspections(currentUser.company.toString(), {
      filter,
      search,
    });
    
    return NextResponse.json(
      inspections.map((inspection: any) => mapInspectionResponse(inspection))
    );
  } catch (error: any) {
    console.log(error);
    return NextResponse.json(
      { error: error.message || "Failed to load inspections" },
      { status: 500 }
    );
  }
}
