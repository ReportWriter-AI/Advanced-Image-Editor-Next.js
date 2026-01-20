import { NextRequest, NextResponse } from "next/server";
import { getDefectsByTemplate } from "@/lib/defect";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{
    inspectionId: string;
  }>;
}

// GET /api/public/reports/[inspectionId]/defects?templateId=xxx - Get defects by template (public, no auth)
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { inspectionId } = await context.params;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    
    if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID" },
        { status: 400 }
      );
    }

    if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { error: "Invalid or missing template ID" },
        { status: 400 }
      );
    }

    const defects = await getDefectsByTemplate(inspectionId, templateId);
    return NextResponse.json(defects);
  } catch (error: any) {
    console.error("Error fetching public defects:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
