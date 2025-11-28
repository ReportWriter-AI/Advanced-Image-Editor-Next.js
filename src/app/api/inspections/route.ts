import { NextRequest, NextResponse } from "next/server";
import { createInspection, getAllInspections } from "@/lib/inspection";
import { getCurrentUser } from "@/lib/auth-helpers";
import dbConnect from "@/lib/db";
import Client from "@/src/models/Client";
import Category from "@/src/models/Category";
import Event from "@/src/models/Event";
import Agent from "@/src/models/Agent";
import Agency from "@/src/models/Agency";
import OrderIdCounter from "@/src/models/OrderIdCounter";
import Inspection from "@/src/models/Inspection";
import mongoose from "mongoose";
import { getOrCreateCategories } from "@/lib/category-utils";

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
      customData,
    });

    // Handle clients creation/update
    const clientIds: mongoose.Types.ObjectId[] = [];
    
    if (clients.length > 0) {
      for (const clientData of clients) {
        if (!clientData.email || !clientData.email.trim()) {
          continue;
        }

        const email = clientData.email.trim().toLowerCase();
        const categoryNames = clientData.categories || [];
        
        // Create or get categories using utility function
        const categoryIds = await getOrCreateCategories(
          categoryNames,
          currentUser.company as mongoose.Types.ObjectId,
          currentUser._id as mongoose.Types.ObjectId
        );

        // Check if client exists by email
        const existingClient = await Client.findOne({
          email,
          company: currentUser.company,
        });

        const isCompany = Boolean(clientData.isCompany);
        let clientId: mongoose.Types.ObjectId;
        
        if (existingClient) {
          // Update existing client
          const updateData: any = {
            isCompany,
            ccEmail: clientData.ccEmail?.trim() || existingClient.ccEmail,
            phone: clientData.phone?.trim() || existingClient.phone,
            categories: categoryIds.length > 0 ? categoryIds : existingClient.categories,
            internalNotes: clientData.notes?.trim() || existingClient.internalNotes,
            internalAdminNotes: clientData.privateNotes?.trim() || existingClient.internalAdminNotes,
            updatedBy: currentUser._id,
          };

          if (isCompany) {
            updateData.companyName = clientData.companyName?.trim() || existingClient.companyName;
            updateData.firstName = undefined;
            updateData.lastName = undefined;
          } else {
            updateData.firstName = clientData.firstName?.trim() || existingClient.firstName;
            updateData.lastName = clientData.lastName?.trim() || existingClient.lastName;
            updateData.companyName = undefined;
          }

          await Client.findByIdAndUpdate(existingClient._id, updateData);
          clientId = existingClient._id as mongoose.Types.ObjectId;
        } else {
          // Create new client
          const createData: any = {
            isCompany,
            email,
            ccEmail: clientData.ccEmail?.trim(),
            phone: clientData.phone?.trim(),
            categories: categoryIds,
            internalNotes: clientData.notes?.trim(),
            internalAdminNotes: clientData.privateNotes?.trim(),
            company: currentUser.company,
            createdBy: currentUser._id,
            updatedBy: currentUser._id,
          };

          if (isCompany) {
            createData.companyName = clientData.companyName?.trim();
          } else {
            createData.firstName = clientData.firstName?.trim();
            createData.lastName = clientData.lastName?.trim();
          }

          const newClient = await Client.create(createData);
          clientId = newClient._id as mongoose.Types.ObjectId;
        }

        clientIds.push(clientId);
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
        if (!agentData.email || !agentData.email.trim()) {
          continue;
        }

        const agentEmail = agentData.email.trim().toLowerCase();
        const categoryNames = agentData.categories || [];
        
        // Create or get categories using utility function
        const categoryIds = await getOrCreateCategories(
          categoryNames,
          currentUser.company as mongoose.Types.ObjectId,
          currentUser._id as mongoose.Types.ObjectId
        );

        // Handle agency
        let agencyId: mongoose.Types.ObjectId | undefined = undefined;
        if (agentData.agency) {
          if (mongoose.Types.ObjectId.isValid(agentData.agency)) {
            // Existing agency ID
            const existingAgency = await Agency.findOne({
              _id: agentData.agency,
              company: currentUser.company,
            });
            if (existingAgency) {
              agencyId = existingAgency._id as mongoose.Types.ObjectId;
            }
          } else {
            // Create new agency
            const newAgency = await Agency.create({
              name: String(agentData.agency).trim(),
              company: currentUser.company,
              createdBy: currentUser._id,
              updatedBy: currentUser._id,
            });
            agencyId = newAgency._id as mongoose.Types.ObjectId;
          }
        }

        // Check if agent exists by email
        const existingAgent = await Agent.findOne({
          email: agentEmail,
          company: currentUser.company,
        });

        let agentId: mongoose.Types.ObjectId;

        if (existingAgent) {
          // Update existing agent
          const updateData: any = {
            firstName: agentData.firstName?.trim() || existingAgent.firstName,
            lastName: agentData.lastName?.trim() || existingAgent.lastName,
            ccEmail: agentData.ccEmail?.trim() || existingAgent.ccEmail,
            phone: agentData.phone?.trim() || existingAgent.phone,
            categories: categoryIds.length > 0 ? categoryIds : existingAgent.categories,
            internalNotes: agentData.notes?.trim() || existingAgent.internalNotes,
            internalAdminNotes: agentData.privateNotes?.trim() || existingAgent.internalAdminNotes,
            updatedBy: currentUser._id,
          };

          if (agentData.photoUrl !== undefined) {
            updateData.photoUrl = agentData.photoUrl?.trim() || null;
          }

          if (agencyId !== undefined) {
            updateData.agency = agencyId;
          }

          await Agent.findByIdAndUpdate(existingAgent._id, updateData);
          agentId = existingAgent._id as mongoose.Types.ObjectId;
        } else {
          // Create new agent
          const createData: any = {
            firstName: agentData.firstName?.trim() || '',
            lastName: agentData.lastName?.trim(),
            email: agentEmail,
            ccEmail: agentData.ccEmail?.trim(),
            phone: agentData.phone?.trim(),
            photoUrl: agentData.photoUrl?.trim() || undefined,
            categories: categoryIds,
            internalNotes: agentData.notes?.trim(),
            internalAdminNotes: agentData.privateNotes?.trim(),
            company: currentUser.company,
            createdBy: currentUser._id,
            updatedBy: currentUser._id,
          };

          if (agencyId) {
            createData.agency = agencyId;
          }

          const newAgent = await Agent.create(createData);
          agentId = newAgent._id as mongoose.Types.ObjectId;
        }

        agentIds.push(agentId);
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
        if (!agentData.email || !agentData.email.trim()) {
          continue;
        }

        const agentEmail = agentData.email.trim().toLowerCase();
        const categoryNames = agentData.categories || [];
        
        // Create or get categories using utility function
        const categoryIds = await getOrCreateCategories(
          categoryNames,
          currentUser.company as mongoose.Types.ObjectId,
          currentUser._id as mongoose.Types.ObjectId
        );

        // Handle agency
        let agencyId: mongoose.Types.ObjectId | undefined = undefined;
        if (agentData.agency) {
          if (mongoose.Types.ObjectId.isValid(agentData.agency)) {
            // Existing agency ID
            const existingAgency = await Agency.findOne({
              _id: agentData.agency,
              company: currentUser.company,
            });
            if (existingAgency) {
              agencyId = existingAgency._id as mongoose.Types.ObjectId;
            }
          } else {
            // Create new agency
            const newAgency = await Agency.create({
              name: String(agentData.agency).trim(),
              company: currentUser.company,
              createdBy: currentUser._id,
              updatedBy: currentUser._id,
            });
            agencyId = newAgency._id as mongoose.Types.ObjectId;
          }
        }

        // Check if agent exists by email
        const existingAgent = await Agent.findOne({
          email: agentEmail,
          company: currentUser.company,
        });

        let agentId: mongoose.Types.ObjectId;

        if (existingAgent) {
          // Update existing agent
          const updateData: any = {
            firstName: agentData.firstName?.trim() || existingAgent.firstName,
            lastName: agentData.lastName?.trim() || existingAgent.lastName,
            ccEmail: agentData.ccEmail?.trim() || existingAgent.ccEmail,
            phone: agentData.phone?.trim() || existingAgent.phone,
            categories: categoryIds.length > 0 ? categoryIds : existingAgent.categories,
            internalNotes: agentData.notes?.trim() || existingAgent.internalNotes,
            internalAdminNotes: agentData.privateNotes?.trim() || existingAgent.internalAdminNotes,
            updatedBy: currentUser._id,
          };

          if (agentData.photoUrl !== undefined) {
            updateData.photoUrl = agentData.photoUrl?.trim() || null;
          }

          if (agencyId !== undefined) {
            updateData.agency = agencyId;
          }

          await Agent.findByIdAndUpdate(existingAgent._id, updateData);
          agentId = existingAgent._id as mongoose.Types.ObjectId;
        } else {
          // Create new agent
          const createData: any = {
            firstName: agentData.firstName?.trim() || '',
            lastName: agentData.lastName?.trim(),
            email: agentEmail,
            ccEmail: agentData.ccEmail?.trim(),
            phone: agentData.phone?.trim(),
            photoUrl: agentData.photoUrl?.trim() || undefined,
            categories: categoryIds,
            internalNotes: agentData.notes?.trim(),
            internalAdminNotes: agentData.privateNotes?.trim(),
            company: currentUser.company,
            createdBy: currentUser._id,
            updatedBy: currentUser._id,
          };

          if (agencyId) {
            createData.agency = agencyId;
          }

          const newAgent = await Agent.create(createData);
          agentId = newAgent._id as mongoose.Types.ObjectId;
        }

        listingAgentIds.push(agentId);
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
