import { NextRequest, NextResponse } from "next/server";
import { createInspection, getAllInspections } from "@/lib/inspection";
import { getCurrentUser } from "@/lib/auth-helpers";

const mapInspectionResponse = (inspection: any) => {
  if (!inspection) return null;
  return {
    ...inspection,
    id: inspection.id ?? inspection._id ?? inspection.id,
  };
};

// POST /api/inspections → create inspection
export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json(
        { error: "User is not associated with a company" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const name = body.inspectionName ?? body.name ?? "";
    const status = body.status ?? "Pending";
    const date = body.date;

    const inspection = await createInspection({
      name: String(name).trim(),
      status,
      date,
      companyId: currentUser.company.toString(),
      createdBy: currentUser._id?.toString(),
    });

    return NextResponse.json(mapInspectionResponse(inspection), { status: 201 });
  } catch (error: any) {
    console.log("error", error);
    return NextResponse.json(
      { error: error.message || "Failed to create inspection" },
      { status: 500 }
    );
  }
}

// GET /api/inspections → list all
export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json([], { status: 200 });
    }

    const inspections = await getAllInspections(currentUser.company.toString());
    return NextResponse.json(
      inspections.map((inspection: any) => mapInspectionResponse(inspection))
    );
  } catch (error: any) {
    console.log(error);
    return NextResponse.json(
      { error: error.message || "Failed to load inspections" },
      { status: 500 }
    );
  }
}
