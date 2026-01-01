import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import mongoose from "mongoose";
import { getQueuedTriggersForInspection } from "@/src/lib/automation-queue";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inspectionId } = await params;

    if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID" },
        { status: 400 }
      );
    }

    // Find the inspection
    const inspection = await Inspection.findById(inspectionId).lean();

    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    // Verify the inspection belongs to the user's company
    if (inspection.companyId.toString() !== currentUser.company?.toString()) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Get queued triggers from Redis
    console.log(`[queued-triggers API] Fetching queued triggers for inspection: ${inspectionId}`);
    const queuedTriggers = await getQueuedTriggersForInspection(inspectionId);
    console.log(`[queued-triggers API] Retrieved ${queuedTriggers.length} queued triggers from Redis`);

    // Enrich queued triggers with full trigger config from inspection
    const enrichedTriggers = queuedTriggers.map((queuedTrigger) => {
      const triggerConfig = inspection.triggers?.[queuedTrigger.triggerIndex];
      
      if (!triggerConfig) {
        console.warn(`[queued-triggers API] No trigger config found at index ${queuedTrigger.triggerIndex} for inspection ${inspectionId}`);
        return null;
      }

      return {
        ...queuedTrigger,
        // Add full trigger config details
        name: triggerConfig.name,
        automationTrigger: triggerConfig.automationTrigger,
        communicationType: triggerConfig.communicationType,
        emailSubject: triggerConfig.emailSubject,
        emailBody: triggerConfig.emailBody,
        emailTo: triggerConfig.emailTo,
        emailCc: triggerConfig.emailCc,
        emailBcc: triggerConfig.emailBcc,
        emailFrom: triggerConfig.emailFrom,
        isDisabled: triggerConfig.isDisabled,
        actionId: triggerConfig.actionId?.toString(),
        // Convert executionTime from timestamp to ISO string for easier handling
        executionTimeISO: new Date(queuedTrigger.executionTime).toISOString(),
      };
    }).filter((trigger) => trigger !== null); // Remove any null entries

    console.log(`[queued-triggers API] Returning ${enrichedTriggers.length} enriched triggers for inspection ${inspectionId}`);

    return NextResponse.json(
      { queuedTriggers: enrichedTriggers },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching queued triggers:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch queued triggers" },
      { status: 500 }
    );
  }
}

