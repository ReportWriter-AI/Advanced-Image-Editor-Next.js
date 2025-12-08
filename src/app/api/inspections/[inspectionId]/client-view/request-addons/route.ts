import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import Service from "@/src/models/Service";
import mongoose from "mongoose";
import { isValidTokenFormat } from "@/src/lib/token-utils";

// POST /api/inspections/[inspectionId]/client-view/request-addons?token=xxx
export async function POST(
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

    // Parse request body
    const body = await req.json();
    const { addonRequests } = body;

    // Validate addonRequests array
    if (!Array.isArray(addonRequests) || addonRequests.length === 0) {
      return NextResponse.json(
        { error: "addonRequests must be a non-empty array" },
        { status: 400 }
      );
    }

    // Find inspection by ID and token
    const inspection = await Inspection.findOne({
      _id: new mongoose.Types.ObjectId(inspectionId),
      token: token,
    });

    // If inspection not found or token doesn't match
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found or invalid token" },
        { status: 404 }
      );
    }

    // Get service IDs from inspection
    const inspectionServiceIds = new Set(
      (inspection.services || []).map((s: any) => s.serviceId.toString())
    );

    // Validate each addon request
    const validatedRequests: any[] = [];

    for (const request of addonRequests) {
      const { serviceId, addonName } = request;

      // Validate required fields
      if (!serviceId || !addonName) {
        return NextResponse.json(
          { error: "Each addon request must have serviceId and addonName" },
          { status: 400 }
        );
      }

      // Validate serviceId format
      if (!mongoose.Types.ObjectId.isValid(serviceId)) {
        return NextResponse.json(
          { error: `Invalid serviceId: ${serviceId}` },
          { status: 400 }
        );
      }

      // Check if service is in the inspection
      if (!inspectionServiceIds.has(serviceId)) {
        return NextResponse.json(
          { error: `Service ${serviceId} is not part of this inspection` },
          { status: 400 }
        );
      }

      // Fetch the service to validate addon
      const service = await Service.findById(serviceId).lean();

      if (!service) {
        return NextResponse.json(
          { error: `Service ${serviceId} not found` },
          { status: 400 }
        );
      }

      // Find the addon in the service
      const addon = service.addOns?.find((a: any) => a.name === addonName);

      if (!addon) {
        return NextResponse.json(
          { error: `Addon "${addonName}" not found in service "${service.name}"` },
          { status: 400 }
        );
      }

      // Check if addon has allowUpsell enabled
      if (!addon.allowUpsell) {
        return NextResponse.json(
          { error: `Addon "${addonName}" is not available for upsell` },
          { status: 400 }
        );
      }

      // Add to validated requests with pricing
      validatedRequests.push({
        serviceId: new mongoose.Types.ObjectId(serviceId),
        addonName: addon.name,
        addFee: addon.baseCost || 0,
        addHours: addon.baseDurationHours || 0,
        status: 'pending',
        requestedAt: new Date(),
      });
    }

    // Add all validated requests to the inspection
    if (!inspection.requestedAddons) {
      inspection.requestedAddons = [];
    }

    inspection.requestedAddons.push(...validatedRequests);

    // Save the inspection
    await inspection.save();

    return NextResponse.json(
      {
        message: "Addon requests submitted successfully",
        requestedCount: validatedRequests.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error submitting addon requests:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit addon requests" },
      { status: 500 }
    );
  }
}
