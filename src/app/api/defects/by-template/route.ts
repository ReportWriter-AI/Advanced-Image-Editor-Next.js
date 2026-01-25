import { NextResponse } from "next/server";
import { getDefectsByTemplate, getDefectsByTemplateWithFilters } from "@/lib/defect";

// GET /api/defects/by-template?inspectionId=xxx&templateId=xxx&sectionId=xxx&subsectionId=xxx
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const inspectionId = searchParams.get('inspectionId');
    const templateId = searchParams.get('templateId');
    const sectionId = searchParams.get('sectionId');
    const subsectionId = searchParams.get('subsectionId');
    
    if (!inspectionId || !templateId) {
      return NextResponse.json(
        { error: "Missing required query parameters: inspectionId, templateId" },
        { status: 400 }
      );
    }

    // Use the new function with optional filters if sectionId or subsectionId are provided
    const defects = sectionId || subsectionId
      ? await getDefectsByTemplateWithFilters(inspectionId, templateId, sectionId || undefined, subsectionId || undefined)
      : await getDefectsByTemplate(inspectionId, templateId);
    
    return NextResponse.json(defects);
  } catch (error: any) {
    console.error("Error fetching defects by template:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
