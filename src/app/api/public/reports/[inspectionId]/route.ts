import { NextResponse, NextRequest } from "next/server";
import { getInspection } from "@/lib/inspection";
import dbConnect from "@/lib/db";
import mongoose from "mongoose";
import '@/src/models/User'

interface RouteParams {
  params: Promise<{
    inspectionId: string;
  }>;
}

// GET /api/public/reports/[inspectionId] - Get inspection data for public report viewing (no auth)
export async function GET(
  req: NextRequest,
  context: RouteParams
) {
  try {
    await dbConnect();
    
    const { inspectionId } = await context.params;
    
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

    // Return only public-facing data, exclude sensitive business information
    const publicInspectionData = {
      _id: inspection._id,
      id: inspection.id,
      orderId: inspection.orderId,
      date: inspection.date,
      location: inspection.location,
      headerImage: inspection.headerImage,
      headerText: inspection.headerText,
      headerName: inspection.headerName,
      headerAddress: inspection.headerAddress,
      htmlReportUrl: inspection.htmlReportUrl,
      htmlReportGeneratedAt: inspection.htmlReportGeneratedAt,
      pdfReportUrl: inspection.pdfReportUrl,
      pdfReportGeneratedAt: inspection.pdfReportGeneratedAt,
    };

    return NextResponse.json(publicInspectionData);
  } catch (error: any) {
    console.error("Error fetching public inspection:", error);
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch inspection" },
      { status: 500 }
    );
  }
}
