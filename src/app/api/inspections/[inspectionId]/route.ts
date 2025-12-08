import { NextResponse } from "next/server";
import { deleteInspection, updateInspection, getInspection } from "@/lib/inspection";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import Defect from "@/src/models/Defect";
import InspectionInformationBlock from "@/src/models/InspectionInformationBlock";
import mongoose from "mongoose";
import { extractR2KeyFromUrl, deleteFromR2 } from "@/lib/r2";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();
    
    const { inspectionId } = await params;
    
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
    await dbConnect();
    
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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();
    
    const { inspectionId } = await params;
    
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

    const result = await Inspection.updateOne(
      {
        _id: new mongoose.Types.ObjectId(inspectionId)
      },
      {
        $set: { deletedAt: null }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        message: "Inspection restored successfully",
        modifiedCount: result.modifiedCount 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error restoring inspection:", error);
    
    return NextResponse.json(
      { error: error.message || "Failed to restore inspection" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();
    
    const { inspectionId } = await params;
    
    console.log('Deleting inspection ID:', inspectionId);
    
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

    const oid = new mongoose.Types.ObjectId(inspectionId);

    // Optional cascade cleanup for R2 and related documents
    const cleanupEnabled = process.env.ENABLE_R2_CASCADE_CLEANUP === 'true';

    // Fetch inspection and related docs to gather URLs
    const inspectionDoc = await Inspection.findById(oid).lean();
    
    if (!inspectionDoc) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    // Fetch related documents using Mongoose models
    const mongooseOid = new mongoose.Types.ObjectId(inspectionId);

    const [defects, infoBlocks] = await Promise.all([
      Defect.find({ inspection_id: mongooseOid }).lean(),
      InspectionInformationBlock.find({ inspection_id: mongooseOid }).select('images').lean(),
    ]);

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

    // Note: For soft delete, we keep related records (defects and information blocks) intact for recovery
    // Only soft delete the inspection itself
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