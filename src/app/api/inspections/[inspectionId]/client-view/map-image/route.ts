import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import mongoose from "mongoose";

// GET /api/inspections/[inspectionId]/client-view/map-image → get map image for the inspection address
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

    // Find inspection by ID
    const inspection = await Inspection.findById(
      new mongoose.Types.ObjectId(inspectionId)
    ).lean();

    // If inspection not found
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    // Check if Google Maps API key is configured
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps API key not configured" },
        { status: 500 }
      );
    }

    // Build address string
    const addressParts = [];
    if (inspection.location?.address) addressParts.push(inspection.location.address);
    if (inspection.location?.city) addressParts.push(inspection.location.city);
    if (inspection.location?.state) addressParts.push(inspection.location.state);
    if (inspection.location?.zip) addressParts.push(inspection.location.zip);

    const address = addressParts.join(", ");

    if (!address) {
      return NextResponse.json(
        { error: "No address available for this inspection" },
        { status: 404 }
      );
    }

    // Build Google Street View Static API URL for actual property photo
    const streetViewUrl = new URL("https://maps.googleapis.com/maps/api/streetview");
    streetViewUrl.searchParams.append("location", address);
    streetViewUrl.searchParams.append("size", "640x400");
    streetViewUrl.searchParams.append("fov", "90"); // Field of view
    streetViewUrl.searchParams.append("pitch", "0"); // Straight ahead
    streetViewUrl.searchParams.append("source", "outdoor"); // Outdoor imagery only
    streetViewUrl.searchParams.append("key", apiKey);

    // Fetch the actual photograph from Google Street View API
    const response = await fetch(streetViewUrl.toString());

    if (!response.ok) {
      console.error("Google Maps API error:", response.statusText);
      return NextResponse.json(
        { error: "Failed to fetch map image" },
        { status: 500 }
      );
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer();

    // Return the image with appropriate headers
    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    });
  } catch (error: any) {
    console.error("Error fetching map image:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch map image" },
      { status: 500 }
    );
  }
}

