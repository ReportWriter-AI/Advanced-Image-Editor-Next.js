import { NextResponse } from "next/server";
import { getDefectsBySubsection } from "@/lib/defect";

// GET /api/defects/by-subsection?inspectionId=xxx&templateId=xxx&sectionId=xxx&subsectionId=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const inspectionId = searchParams.get('inspectionId');
    const templateId = searchParams.get('templateId');
    const sectionId = searchParams.get('sectionId');
    const subsectionId = searchParams.get('subsectionId');
    
    if (!inspectionId || !templateId || !sectionId || !subsectionId) {
      return NextResponse.json(
        { error: "Missing required query parameters: inspectionId, templateId, sectionId, subsectionId" },
        { status: 400 }
      );
    }

    const defects = await getDefectsBySubsection(inspectionId, templateId, sectionId, subsectionId);
    return NextResponse.json(defects);
  } catch (error: any) {
    console.error("Error fetching defects by subsection:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
