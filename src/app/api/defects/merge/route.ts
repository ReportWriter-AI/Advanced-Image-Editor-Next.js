import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Defect from "@/src/models/Defect";
import mongoose from "mongoose";
import { createDefect } from "@/lib/defect";

// POST /api/defects/merge
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { defectIds, templateId } = body;

    // Validate request body
    if (!defectIds || !Array.isArray(defectIds) || defectIds.length === 0) {
      return NextResponse.json(
        { error: "defectIds array is required and must not be empty" },
        { status: 400 }
      );
    }

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required" },
        { status: 400 }
      );
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(templateId)) {
      return NextResponse.json(
        { error: "Invalid templateId format" },
        { status: 400 }
      );
    }

    // Validate all defect IDs are valid ObjectIds
    const invalidIds = defectIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `Invalid defect ID format: ${invalidIds.join(', ')}` },
        { status: 400 }
      );
    }

    await dbConnect();

    // Convert defect IDs to ObjectIds
    const defectObjectIds = defectIds.map(id => new mongoose.Types.ObjectId(id));

    // Fetch all defects by IDs (excluding soft-deleted ones)
    const defects = await Defect.find({
      _id: { $in: defectObjectIds },
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } }
      ]
    }).lean();

    // Check if all defects were found
    if (defects.length !== defectIds.length) {
      const foundIds = defects.map(d => d._id.toString());
      const missingIds = defectIds.filter(id => !foundIds.includes(id));
      return NextResponse.json(
        { error: `Some defects were not found: ${missingIds.join(', ')}` },
        { status: 404 }
      );
    }

    // Validate that all defects belong to the provided templateId
    const defectsNotInTemplate = defects.filter(
      defect => !defect.templateId || defect.templateId.toString() !== templateId
    );

    if (defectsNotInTemplate.length > 0) {
      const invalidDefectIds = defectsNotInTemplate.map(d => d._id.toString());
      return NextResponse.json(
        { 
          error: `Some defects do not belong to the specified template: ${invalidDefectIds.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Get the first defect as the base
    const firstDefect = defects[0];
    const firstDefectId = firstDefect._id.toString();

    // Calculate sums of cost and hours fields from all defects
    const totalMaterialCost = defects.reduce((sum, defect) => sum + (defect.material_total_cost || 0), 0);
    const totalBaseCost = defects.reduce((sum, defect) => sum + (defect.base_cost || 0), 0);
    const totalHoursRequired = defects.reduce((sum, defect) => sum + (defect.hours_required || 0), 0);

    // Create additional_images array from remaining defects (excluding the first)
    const remainingDefects = defects.slice(1);
    const additional_images: Array<{ id: string; image: string; originalImage: string; annotations: any[]; location: string; isThreeSixty?: boolean }> = [];

    // Map remaining defects to additional_images format
    remainingDefects.forEach(defect => {
      additional_images.push({
        id: defect._id.toString(),
        image: defect.image,
        originalImage: defect.originalImage,
        annotations: defect.annotations || [],
        location: defect.location || '',
        isThreeSixty: defect.isThreeSixty || false
      });
    });

    console.log("Additional images:", additional_images);

    // Create new defect data object based on first defect
    const mergedDefectData = {
      inspection_id: firstDefect.inspection_id.toString(),
      templateId: firstDefect.templateId?.toString(),
      sectionId: firstDefect.sectionId?.toString(),
      subsectionId: firstDefect.subsectionId?.toString(),
      image: firstDefect.image,
      location: firstDefect.location || '',
      section: firstDefect.section || '',
      subsection: firstDefect.subsection || '',
      defect_description: firstDefect.defect_description || '',
      materials: firstDefect.materials || '',
      material_total_cost: totalMaterialCost,
      labor_type: firstDefect.labor_type || '',
      labor_rate: firstDefect.labor_rate || 0,
      hours_required: totalHoursRequired,
      recommendation: firstDefect.recommendation || '',
      title: firstDefect.title || '',
      narrative: firstDefect.narrative || '',
      severity: firstDefect.severity || '',
      trade: firstDefect.trade || '',
      color: firstDefect.color,
      isThreeSixty: firstDefect.isThreeSixty || false,
      additional_images: additional_images,
      base_cost: totalBaseCost,
      annotations: firstDefect.annotations || [],
      originalImage: firstDefect.originalImage,
      parentDefect: firstDefectId, // Reference to the first defect
    };

    const newDefectId = await createDefect(mergedDefectData);

    // Soft delete all merged defects by setting deletedAt
    await Defect.updateMany(
      {
        _id: { $in: defectObjectIds }
      },
      {
        $set: { deletedAt: new Date() }
      }
    );

    // Return success response with the new defect ID
    return NextResponse.json(
      { 
        success: true,
        mergedDefectId: newDefectId
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error in merge defects:", error);
    return NextResponse.json(
      { error: error.message || "Failed to merge defects" },
      { status: 500 }
    );
  }
}
