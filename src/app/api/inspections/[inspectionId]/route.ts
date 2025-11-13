import { NextResponse } from "next/server";
import { deleteInspection, updateInspection } from "@/lib/inspection";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { extractR2KeyFromUrl, deleteFromR2 } from "@/lib/r2";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    const { inspectionId } = await params;
    
    if (!inspectionId) {
      return NextResponse.json(
        { error: "Inspection ID is required" },
        { status: 400 }
      );
    }

    // Import client directly since we don't have a getInspection function yet
    const { default: clientPromise } = await import("@/lib/mongodb");
    const client = await clientPromise;
    const db = client.db("agi_inspections_db");
    
    const { ObjectId } = await import("mongodb");
    if (!ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID format" },
        { status: 400 }
      );
    }

    const inspection = await db.collection("inspections").findOne({
      _id: new ObjectId(inspectionId)
    });

    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(inspection);
  } catch (error: any) {
    console.error("Error fetching inspection:", error);
    
    return NextResponse.json(
      { error: error.message || "Failed to fetch inspection" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    const { inspectionId } = await params;
    
    console.log('Updating inspection ID:', inspectionId);
    
    if (!inspectionId) {
      return NextResponse.json(
        { error: "Inspection ID is required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const result = await updateInspection(inspectionId, body);

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        message: "Inspection updated successfully",
        modifiedCount: result.modifiedCount 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating inspection:", error);
    
    if (error.message.includes("Invalid inspection ID format")) {
      return NextResponse.json(
        { error: "Invalid inspection ID format" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to update inspection" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    const { inspectionId } = await params;
    
    console.log('Deleting inspection ID:', inspectionId);
    
    if (!inspectionId) {
      return NextResponse.json(
        { error: "Inspection ID is required" },
        { status: 400 }
      );
    }

    // Optional cascade cleanup for R2 and related documents
    const cleanupEnabled = process.env.ENABLE_R2_CASCADE_CLEANUP === 'true';
    const client = await clientPromise;
    const db = client.db("agi_inspections_db");
    
    if (!ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID format" },
        { status: 400 }
      );
    }
    const oid = new ObjectId(inspectionId);

    // Fetch related docs to gather URLs
    const [inspectionDoc, defects, infoBlocks] = await Promise.all([
      db.collection("inspections").findOne({ _id: oid }),
      db.collection("defects").find({ inspection_id: oid }).toArray(),
      db.collection("inspectioninformationblocks").find({ inspection_id: oid }).project({ images: 1 }).toArray(),
    ]);

    if (!inspectionDoc) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    // Build list of URLs to delete from R2 (exclude reports/* to preserve permanent report links)
    const urls: string[] = [];
    if (typeof (inspectionDoc as any)?.headerImage === 'string') {
      urls.push((inspectionDoc as any).headerImage);
    }
    // Defects: image and optionally thumbnail if present
    for (const d of defects) {
      if (typeof (d as any)?.image === 'string') urls.push((d as any).image);
      if (typeof (d as any)?.thumbnail === 'string') urls.push((d as any).thumbnail);
    }
    // Information blocks: images[].url
    for (const b of infoBlocks) {
      const imgs = Array.isArray((b as any)?.images) ? (b as any).images : [];
      for (const img of imgs) {
        if (typeof img?.url === 'string') urls.push(img.url);
      }
    }

    // Best-effort R2 deletions (only if enabled)
    if (cleanupEnabled && urls.length) {
      const keys = urls
        .map(u => extractR2KeyFromUrl(u))
        .filter((k): k is string => !!k)
        .filter(k => !k.startsWith('reports/')); // never delete permanent report files

      // De-duplicate keys
      const uniqueKeys = Array.from(new Set(keys));

      await Promise.all(uniqueKeys.map(async (key) => {
        try {
          await deleteFromR2(key);
        } catch (e) {
          console.warn(`R2 delete failed for key ${key}:`, e);
        }
      }));
    }

    // Delete related DB records (defects and information blocks), then the inspection itself
    await Promise.all([
      db.collection("defects").deleteMany({ inspection_id: oid }),
      db.collection("inspectioninformationblocks").deleteMany({ inspection_id: oid }),
    ]);

    const result = await deleteInspection(inspectionId);

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        message: "Inspection deleted successfully",
        deletedCount: result.deletedCount,
        cleanup: cleanupEnabled ? 'r2-cleaned' : 'r2-skipped'
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting inspection:", error);
    
    if (error.message.includes("Invalid inspection ID format")) {
      return NextResponse.json(
        { error: "Invalid inspection ID format" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to delete inspection" },
      { status: 500 }
    );
  }
}