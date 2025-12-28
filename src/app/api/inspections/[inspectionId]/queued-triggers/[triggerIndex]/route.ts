import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import mongoose from "mongoose";
import { removeQueuedTrigger } from "@/src/lib/automation-queue";
import { getCurrentUser } from "@/lib/auth-helpers";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string; triggerIndex: string }> }
) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inspectionId, triggerIndex } = await params;

    if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID" },
        { status: 400 }
      );
    }

    const triggerIndexNum = parseInt(triggerIndex, 10);
    if (isNaN(triggerIndexNum) || triggerIndexNum < 0) {
      return NextResponse.json(
        { error: "Invalid trigger index" },
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

    // Verify the trigger index is valid
    if (!inspection.triggers || triggerIndexNum >= inspection.triggers.length) {
      return NextResponse.json(
        { error: "Trigger not found" },
        { status: 404 }
      );
    }

    // Remove the queued trigger from Redis
    await removeQueuedTrigger(inspectionId, triggerIndexNum);

    return NextResponse.json(
      { message: "Scheduled trigger cancelled successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error cancelling queued trigger:", error);
    return NextResponse.json(
      { error: error.message || "Failed to cancel scheduled trigger" },
      { status: 500 }
    );
  }
}

