import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import mongoose from "mongoose";
import { isValidTokenFormat } from "@/src/lib/token-utils";

// GET /api/inspections/[inspectionId]/client-view?token=xxx → get minimal inspection data for client view
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();

    const { inspectionId } = await params;

    // Validate inspection ID format
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID" },
        { status: 400 }
      );
    }

    // Get token from query params
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    // Validate token is provided
    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 401 }
      );
    }

    // Validate token format
    if (!isValidTokenFormat(token)) {
      return NextResponse.json(
        { error: "Invalid token format" },
        { status: 401 }
      );
    }

    // Find inspection by ID and token
    const inspection = await Inspection.findOne({
      _id: new mongoose.Types.ObjectId(inspectionId),
      token: token,
    }).lean();

    // If inspection not found or token doesn't match
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found or invalid token" },
        { status: 404 }
      );
    }

    // Return only minimal data
    const clientViewData = {
      id: inspection._id.toString(),
      date: inspection.date ? new Date(inspection.date).toISOString() : null,
      location: {
        address: inspection.location?.address || null,
        city: inspection.location?.city || null,
        state: inspection.location?.state || null,
        unit: inspection.location?.unit || null,
      },
    };

    return NextResponse.json(clientViewData, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching client view data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch inspection data" },
      { status: 500 }
    );
  }
}

