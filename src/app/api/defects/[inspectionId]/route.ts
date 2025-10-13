import { NextResponse } from "next/server";
import { getDefectsByInspection } from "@/lib/defect";


// GET /api/defects/[inspectionId]
export async function GET(
  req: Request,
  { params }: { params: { inspectionId: string } }
) {
  try {
    const { inspectionId } = params;
    const defects = await getDefectsByInspection(inspectionId);
    return NextResponse.json(defects);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}


import { deleteDefect } from "@/lib/defect";

// DELETE /api/defects/[defectId]
export async function DELETE(
  req: Request,
  { params }: { params: { inspectionId: string } }
) {
  try {
    const { inspectionId } = params;
    
    if (!inspectionId) {
      console.log('123');
      return NextResponse.json(
        { error: "Defect ID is required" },
        { status: 400 }
      );
    }

    const result = await deleteDefect(inspectionId);

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Defect not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Defect deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting defect:", error);
    
    if (error.message.includes("Invalid defect ID format")) {
      return NextResponse.json(
        { error: "Invalid defect ID format" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to delete defect" },
      { status: 500 }
    );
  }
}


// import { NextResponse } from "next/server";
import { updateDefect } from "@/lib/defect";

// PATCH /api/defects/[defectId]
export async function PATCH(
  req: Request,
  { params }: { params: { inspectionId: string } }
) {
  try {
    const { inspectionId } = params;
    const body = await req.json();

    const {
      inspection_id,
      defect_description,
      materials,
      material_total_cost,
      location,
      labor_type,
      labor_rate,
      hours_required,
      recommendation,
      isThreeSixty,
    } = body;

    if (!inspection_id) {
      return NextResponse.json(
        { error: "inspection_id is required" },
        { status: 400 }
      );
    }

    const updates = {
      defect_description,
      materials,
      material_total_cost,
      location,
      labor_type,
      labor_rate,
      hours_required,
      recommendation,
      isThreeSixty,
    };

    // remove undefined keys to avoid overwriting fields accidentally
    Object.keys(updates).forEach(
      (key) => updates[key as keyof typeof updates] === undefined && delete updates[key as keyof typeof updates]
    );

    const result = await updateDefect(inspectionId, inspection_id, updates);

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Defect not found for this inspection" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Defect updated successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating defect:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update defect" },
      { status: 500 }
    );
  }
}
