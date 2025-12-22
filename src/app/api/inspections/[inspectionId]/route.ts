import { NextResponse, NextRequest } from "next/server";
import { deleteInspection, updateInspection, getInspection } from "@/lib/inspection";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import Defect from "@/src/models/Defect";
import InspectionInformationBlock from "@/src/models/InspectionInformationBlock";
import mongoose from "mongoose";
import { extractR2KeyFromUrl, deleteFromR2 } from "@/lib/r2";
import { checkAndProcessTriggers, queueTimeBasedTriggers, detectPricingChanges, detectAgreementChanges } from "@/src/lib/automation-trigger-helper";
import { getCurrentUser } from "@/lib/auth-helpers";
import { createOrUpdateClient, createOrUpdateAgent } from "@/lib/client-agent-utils";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();
    
    const { inspectionId } = await params;
    
    if (!inspectionId) {
      return NextResponse.json(
        { error: "Inspection ID is required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID format" },
        { status: 400 }
      );
    }

    const inspection = await getInspection(inspectionId);

    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(inspection);
  } catch (error: any) {
    console.error("Error fetching inspection:", error);
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch inspection" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();
    
    const { inspectionId } = await params;
    
    console.log('Updating inspection ID:', inspectionId);
    
    if (!inspectionId) {
      return NextResponse.json(
        { error: "Inspection ID is required" },
        { status: 400 }
      );
    }

    // Get current inspection state before update
    const inspectionBefore = await Inspection.findById(inspectionId).lean();
    
    const body = await req.json();
    
    // Handle confirmation with notifications enabled
    if (body.confirmWithNotifications === true) {
      body.confirmedInspection = true;
      body.disableAutomatedNotifications = false;
      body.status = 'Approved';
      delete body.confirmWithNotifications;
    }
    
    // Handle confirmation with notifications disabled
    if (body.confirmWithoutNotifications === true) {
      body.confirmedInspection = true;
      body.disableAutomatedNotifications = true;
      body.status = 'Approved';
      delete body.confirmWithoutNotifications;
    }
    
    // Handle reschedule action
    if (body.rescheduleDate && body.rescheduleTime) {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(body.rescheduleDate)) {
        return NextResponse.json(
          { error: "Invalid date format. Please use YYYY-MM-DD format" },
          { status: 400 }
        );
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(body.rescheduleTime)) {
        return NextResponse.json(
          { error: "Invalid time format. Please use HH:MM format (24-hour)" },
          { status: 400 }
        );
      }

      // Combine date and time into a single Date object
      const dateStr = body.rescheduleDate;
      const timeStr = body.rescheduleTime;
      const combinedDateTime = new Date(`${dateStr}T${timeStr}`);
      
      // Validate that the combined date/time is valid
      if (isNaN(combinedDateTime.getTime())) {
        return NextResponse.json(
          { error: "Invalid date and time combination" },
          { status: 400 }
        );
      }

      // Validate that the date is in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDate = new Date(dateStr + 'T00:00:00');
      if (selectedDate <= today) {
        return NextResponse.json(
          { error: "Reschedule date must be in the future" },
          { status: 400 }
        );
      }

      // Validate that the combined datetime is in the future
      const now = new Date();
      if (combinedDateTime <= now) {
        return NextResponse.json(
          { error: "Rescheduled date and time must be in the future" },
          { status: 400 }
        );
      }
      
      body.date = combinedDateTime;
      body.confirmedInspection = true;
      body.status = 'Approved';
      body.cancelInspection = false;
      delete body.rescheduleDate;
      delete body.rescheduleTime;
    }
    
    // Handle cancellation: when status is set to "Unconfirmed", also set other fields
    if (body.status === 'Unconfirmed') {
      body.confirmedInspection = false;
      body.disableAutomatedNotifications = true;
      body.cancelInspection = true;
      body.inspector = null; // Remove inspector when cancelling
      // cancellationReason is already in body if provided
    }
    
    // Handle clients, agents, and listingAgents - support both IDs and data objects
    const currentUser = await getCurrentUser(req);
    if (!currentUser || !currentUser.company) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Process clients if provided
    if (body.clients && Array.isArray(body.clients)) {
      const clientIds: string[] = [];
      for (const clientData of body.clients) {
        if (typeof clientData === 'string') {
          // It's an ID, use directly
          clientIds.push(clientData);
        } else if (typeof clientData === 'object' && clientData !== null) {
          // It's an object, create or update
          const clientId = await createOrUpdateClient(
            clientData,
            currentUser.company as mongoose.Types.ObjectId,
            currentUser._id as mongoose.Types.ObjectId
          );
          if (clientId) {
            clientIds.push(clientId.toString());
          }
        }
      }
      body.clients = clientIds; // Convert to IDs for updateInspection
    }

    // Process agents if provided
    if (body.agents && Array.isArray(body.agents)) {
      const agentIds: string[] = [];
      for (const agentData of body.agents) {
        if (typeof agentData === 'string') {
          // It's an ID, use directly
          agentIds.push(agentData);
        } else if (typeof agentData === 'object' && agentData !== null) {
          // It's an object, create or update
          const agentId = await createOrUpdateAgent(
            agentData,
            currentUser.company as mongoose.Types.ObjectId,
            currentUser._id as mongoose.Types.ObjectId
          );
          if (agentId) {
            agentIds.push(agentId.toString());
          }
        }
      }
      body.agents = agentIds; // Convert to IDs for updateInspection
    }

    // Process listingAgents if provided
    if (body.listingAgents && Array.isArray(body.listingAgents)) {
      const listingAgentIds: string[] = [];
      for (const agentData of body.listingAgents) {
        if (typeof agentData === 'string') {
          // It's an ID, use directly
          listingAgentIds.push(agentData);
        } else if (typeof agentData === 'object' && agentData !== null) {
          // It's an object, create or update
          const agentId = await createOrUpdateAgent(
            agentData,
            currentUser.company as mongoose.Types.ObjectId,
            currentUser._id as mongoose.Types.ObjectId
          );
          if (agentId) {
            listingAgentIds.push(agentId.toString());
          }
        }
      }
      body.listingAgent = listingAgentIds; // Convert to IDs for updateInspection (note: field name is listingAgent, not listingAgents)
    }
    
    const result = await updateInspection(inspectionId, body);

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    // Get updated inspection state
    const inspectionAfter = await Inspection.findById(inspectionId).lean();

    // Check for trigger events based on changes
    if (inspectionBefore && inspectionAfter) {
      // Status change
      if (body.status && inspectionBefore.status !== inspectionAfter.status) {
        if (body.status === 'Canceled') {
          await checkAndProcessTriggers(inspectionId, 'INSPECTION_CANCELED');
        } else if (inspectionAfter.confirmedInspection && !inspectionBefore.confirmedInspection) {
          await checkAndProcessTriggers(inspectionId, 'INSPECTION_SCHEDULED');
        }
      }

      // Inspector assignment change
      if (body.inspector !== undefined) {
        const inspectorBefore = inspectionBefore.inspector?.toString();
        const inspectorAfter = inspectionAfter.inspector?.toString();
        
        if (!inspectorBefore && inspectorAfter) {
          await checkAndProcessTriggers(inspectionId, 'INSPECTOR_ASSIGNED');
        } else if (inspectorBefore && !inspectorAfter) {
          await checkAndProcessTriggers(inspectionId, 'INSPECTOR_UNASSIGNED');
        }
      }

      // Date change (rescheduled)
      if (body.date && inspectionBefore.date?.toString() !== inspectionAfter.date?.toString()) {
        await checkAndProcessTriggers(inspectionId, 'INSPECTION_RESCHEDULED');
        // Re-queue time-based triggers
        await queueTimeBasedTriggers(inspectionId);
      }

      // Closing date change
      const closingDateBefore = inspectionBefore.closingDate?.date?.toString();
      const closingDateAfter = inspectionAfter.closingDate?.date?.toString();
      if (body.closingDate !== undefined) {
        // Date was set, changed, or cleared
        if (closingDateBefore !== closingDateAfter) {
          await queueTimeBasedTriggers(inspectionId);
        }
      }

      // End of period date change
      const endOfPeriodBefore = inspectionBefore.endOfInspectionPeriod?.date?.toString();
      const endOfPeriodAfter = inspectionAfter.endOfInspectionPeriod?.date?.toString();
      if (body.endOfInspectionPeriod !== undefined) {
        // Date was set, changed, or cleared
        if (endOfPeriodBefore !== endOfPeriodAfter) {
          await queueTimeBasedTriggers(inspectionId);
        }
      }

      // Pricing change (services/addons added or removed)
      if (body.pricing !== undefined && inspectionAfter.confirmedInspection) {
        const pricingChanges = detectPricingChanges(
          inspectionBefore.pricing,
          inspectionAfter.pricing
        );

        if (pricingChanges.servicesOrAddonsAdded) {
          await checkAndProcessTriggers(inspectionId, 'SERVICE_OR_ADDON_ADDED_AFTER_CONFIRMATION');
        }

        if (pricingChanges.servicesOrAddonsRemoved) {
          await checkAndProcessTriggers(inspectionId, 'SERVICE_OR_ADDON_REMOVED_AFTER_CONFIRMATION');
        }
      }

      // Agreement change (agreements added or removed)
      if (body.agreements !== undefined && inspectionAfter.confirmedInspection) {
        const agreementChanges = detectAgreementChanges(
          inspectionBefore.agreements,
          inspectionAfter.agreements
        );

        if (agreementChanges.agreementsAdded) {
          await checkAndProcessTriggers(inspectionId, 'AGREEMENT_ADDED_AFTER_CONFIRMATION');
        }

        if (agreementChanges.agreementsRemoved) {
          await checkAndProcessTriggers(inspectionId, 'AGREEMENT_REMOVED_AFTER_CONFIRMATION');
        }
      }
    }

    return NextResponse.json(
      { 
        message: "Inspection updated successfully",
        modifiedCount: result.modifiedCount 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating inspection:", error);
    
    if (error.message.includes("Invalid inspection ID format")) {
      return NextResponse.json(
        { error: "Invalid inspection ID format" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to update inspection" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();
    
    const { inspectionId } = await params;
    
    if (!inspectionId) {
      return NextResponse.json(
        { error: "Inspection ID is required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID format" },
        { status: 400 }
      );
    }

    const result = await Inspection.updateOne(
      {
        _id: new mongoose.Types.ObjectId(inspectionId)
      },
      {
        $set: { deletedAt: null }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        message: "Inspection restored successfully",
        modifiedCount: result.modifiedCount 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error restoring inspection:", error);
    
    return NextResponse.json(
      { error: error.message || "Failed to restore inspection" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();
    
    const { inspectionId } = await params;
    
    console.log('Deleting inspection ID:', inspectionId);
    
    if (!inspectionId) {
      return NextResponse.json(
        { error: "Inspection ID is required" },
        { status: 400 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID format" },
        { status: 400 }
      );
    }

    const oid = new mongoose.Types.ObjectId(inspectionId);

    // Optional cascade cleanup for R2 and related documents
    const cleanupEnabled = process.env.ENABLE_R2_CASCADE_CLEANUP === 'true';

    // Fetch inspection and related docs to gather URLs
    const inspectionDoc = await Inspection.findById(oid).lean();
    
    if (!inspectionDoc) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    // Fetch related documents using Mongoose models
    const mongooseOid = new mongoose.Types.ObjectId(inspectionId);

    const [defects, infoBlocks] = await Promise.all([
      Defect.find({ inspection_id: mongooseOid }).lean(),
      InspectionInformationBlock.find({ inspection_id: mongooseOid }).select('images').lean(),
    ]);

    // Build list of URLs to delete from R2 (exclude reports/* to preserve permanent report links)
    const urls: string[] = [];
    if (typeof (inspectionDoc as any)?.headerImage === 'string') {
      urls.push((inspectionDoc as any).headerImage);
    }
    // Defects: image and optionally thumbnail if present
    for (const d of defects) {
      if (typeof (d as any)?.image === 'string') urls.push((d as any).image);
      if (typeof (d as any)?.thumbnail === 'string') urls.push((d as any).thumbnail);
    }
    // Information blocks: images[].url
    for (const b of infoBlocks) {
      const imgs = Array.isArray((b as any)?.images) ? (b as any).images : [];
      for (const img of imgs) {
        if (typeof img?.url === 'string') urls.push(img.url);
      }
    }

    // Best-effort R2 deletions (only if enabled)
    if (cleanupEnabled && urls.length) {
      const keys = urls
        .map(u => extractR2KeyFromUrl(u))
        .filter((k): k is string => !!k)
        .filter(k => !k.startsWith('reports/')); // never delete permanent report files

      // De-duplicate keys
      const uniqueKeys = Array.from(new Set(keys));

      await Promise.all(uniqueKeys.map(async (key) => {
        try {
          await deleteFromR2(key);
        } catch (e) {
          console.warn(`R2 delete failed for key ${key}:`, e);
        }
      }));
    }

    // Note: For soft delete, we keep related records (defects and information blocks) intact for recovery
    // Only soft delete the inspection itself
    const result = await deleteInspection(inspectionId);

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        message: "Inspection deleted successfully",
        deletedCount: result.deletedCount,
        cleanup: cleanupEnabled ? 'r2-cleaned' : 'r2-skipped'
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting inspection:", error);
    
    if (error.message.includes("Invalid inspection ID format")) {
      return NextResponse.json(
        { error: "Invalid inspection ID format" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to delete inspection" },
      { status: 500 }
    );
  }
}