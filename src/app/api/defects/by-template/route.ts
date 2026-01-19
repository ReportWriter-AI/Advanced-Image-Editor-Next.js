import { NextResponse } from "next/server";
import { getDefectsByTemplate } from "@/lib/defect";

// GET /api/defects/by-template?inspectionId=xxx&templateId=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const inspectionId = searchParams.get('inspectionId');
    const templateId = searchParams.get('templateId');
    
    if (!inspectionId || !templateId) {
      return NextResponse.json(
        { error: "Missing required query parameters: inspectionId, templateId" },
        { status: 400 }
      );
    }

    const defects = await getDefectsByTemplate(inspectionId, templateId);
    return NextResponse.json(defects);
  } catch (error: any) {
    console.error("Error fetching defects by template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
