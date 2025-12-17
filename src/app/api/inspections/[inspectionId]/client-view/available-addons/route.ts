import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import Service from "@/src/models/Service";
import mongoose from "mongoose";
import { isValidTokenFormat } from "@/src/lib/token-utils";

// GET /api/inspections/[inspectionId]/client-view/available-addons?token=xxx
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

    // Get service IDs from pricing.items
    const pricing = (inspection as any).pricing;
    const pricingItems = pricing?.items || [];
    const serviceItems = pricingItems.filter((item: any) => item.type === 'service');
    
    // If no services, return empty array
    if (serviceItems.length === 0) {
      return NextResponse.json({ addons: [] }, { status: 200 });
    }

    // Get all rejected addon names for this inspection
    const rejectedAddons = new Set(
      (inspection.requestedAddons || [])
        .filter((req: any) => req.status === 'rejected')
        .map((req: any) => `${req.serviceId.toString()}_${req.addonName}`)
    );

    // Fetch all services with their addons
    const serviceIds = serviceItems.map((item: any) => {
      const serviceId = item.serviceId;
      return typeof serviceId === 'string' ? serviceId : String(serviceId);
    });
    const services = await Service.find({
      _id: { $in: serviceIds.map((id: string) => new mongoose.Types.ObjectId(id)) }
    }).lean();

    // Build available addons list
    const availableAddons: any[] = [];

    for (const service of services) {
      if (!service.addOns || service.addOns.length === 0) {
        continue;
      }

      for (const addon of service.addOns) {
        // Check if addon has allowUpsell enabled
        if (!addon.allowUpsell) {
          continue;
        }

        // Check if addon was rejected
        const addonKey = `${service._id.toString()}_${addon.name}`;
        if (rejectedAddons.has(addonKey)) {
          continue;
        }

        availableAddons.push({
          serviceId: service._id.toString(),
          serviceName: service.name,
          addonName: addon.name,
          description: addon.description || '',
          baseCost: addon.baseCost || 0,
          baseDurationHours: addon.baseDurationHours || 0,
        });
      }
    }

    return NextResponse.json({ addons: availableAddons }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching available addons:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch available addons" },
      { status: 500 }
    );
  }
}
