import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Defect, { IAdditionalImage } from "@/src/models/Defect";
import mongoose from "mongoose";

// Helper function for conditional logging
const isDevelopment = process.env.NODE_ENV === 'development';
function log(...args: any[]) {
  if (isDevelopment) {
    console.log(...args);
  }
}

function logError(...args: any[]) {
  console.error(...args);
}

// POST /api/defects/unmerge
export async function POST(req: Request) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const body = await req.json();
    const { mergedDefectId } = body;

    // Validate request body
    if (!mergedDefectId) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "mergedDefectId is required" },
        { status: 400 }
      );
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(mergedDefectId)) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Invalid mergedDefectId format" },
        { status: 400 }
      );
    }

    const mergedDefectObjectId = new mongoose.Types.ObjectId(mergedDefectId);

    await dbConnect();

    // Find the merged defect
    const mergedDefect = await Defect.findOne(
      { _id: mergedDefectObjectId },
      {
        _id: 1,
        inspection_id: 1,
        templateId: 1,
        sectionId: 1,
        subsectionId: 1,
        parentDefect: 1,
        createdAt: 1,
        additional_images: 1
      }
    ).lean().session(session);

    if (!mergedDefect) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Merged defect not found" },
        { status: 404 }
      );
    }

    // Verify it has a parentDefect (indicating it's a merged defect)
    if (!mergedDefect.parentDefect) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Defect is not a merged defect (no parentDefect found)" },
        { status: 400 }
      );
    }

    log(`Found merged defect ${mergedDefectId} with parentDefect ${mergedDefect.parentDefect}`);

    // Extract defect IDs from additional_images
    const additionalImageDefectIds: string[] = [];
    if (mergedDefect.additional_images && Array.isArray(mergedDefect.additional_images)) {
      mergedDefect.additional_images.forEach((img: IAdditionalImage) => {
        if (img.id && mongoose.Types.ObjectId.isValid(img.id)) {
          additionalImageDefectIds.push(img.id);
        }
      });
    }
    log(`Found ${additionalImageDefectIds.length} defect IDs from additional_images`);

    // Calculate time window: 2 minutes before merged defect creation
    const timeWindowStart = new Date(mergedDefect.createdAt);
    timeWindowStart.setMinutes(timeWindowStart.getMinutes() - 2);

    // Find all soft-deleted defects that were likely part of the merge
    // Criteria:
    // 1. Same inspection_id, templateId, sectionId, subsectionId
    // 2. Have deletedAt set
    // 3. deletedAt is within 2 minutes before merged defect creation
    // 4. Include parentDefect explicitly
    const queryConditions: any = {
      inspection_id: mergedDefect.inspection_id,
      deletedAt: { $ne: null, $exists: true },
      $or: [
        // Defects deleted within time window
        {
          deletedAt: {
            $gte: timeWindowStart,
            $lte: mergedDefect.createdAt
          }
        },
        // Always include parentDefect
        {
          _id: mergedDefect.parentDefect
        }
      ]
    };

    // Add templateId filter if it exists
    if (mergedDefect.templateId) {
      queryConditions.templateId = mergedDefect.templateId;
    }

    // Add sectionId filter if it exists
    if (mergedDefect.sectionId) {
      queryConditions.sectionId = mergedDefect.sectionId;
    }

    // Add subsectionId filter if it exists
    if (mergedDefect.subsectionId) {
      queryConditions.subsectionId = mergedDefect.subsectionId;
    }

    // Find all defects that match the criteria
    const defectsToRestore = await Defect.find(
      queryConditions,
      { _id: 1 }
    ).lean().session(session);

    log(`Found ${defectsToRestore.length} defects to restore from time window query`);

    // Collect defect IDs for response
    const defectIdsToRestore = defectsToRestore.map(d => d._id.toString());
    
    // Ensure parentDefect is included
    const parentDefectId = mergedDefect.parentDefect.toString();
    if (!defectIdsToRestore.includes(parentDefectId)) {
      defectIdsToRestore.push(parentDefectId);
    }

    // Add defect IDs from additional_images (ensuring no duplicates)
    additionalImageDefectIds.forEach(id => {
      if (!defectIdsToRestore.includes(id)) {
        defectIdsToRestore.push(id);
      }
    });

    // Undelete all identified defects by setting deletedAt to null
    if (defectIdsToRestore.length > 0) {
      const defectObjectIdsToRestore = defectIdsToRestore.map(
        id => new mongoose.Types.ObjectId(id)
      );

      const restoreResult = await Defect.updateMany(
        {
          _id: { $in: defectObjectIdsToRestore }
        },
        {
          $set: { deletedAt: null }
        },
        { session }
      );

      log(`Restored ${restoreResult.modifiedCount} defects (${defectsToRestore.length} from time window, ${additionalImageDefectIds.length} from additional_images)`);
    }

    // Hard delete the merged defect
    const deleteResult = await Defect.deleteOne(
      { _id: mergedDefectObjectId },
      { session }
    );

    if (deleteResult.deletedCount === 0) {
      await session.abortTransaction();
      return NextResponse.json(
        { error: "Failed to delete merged defect" },
        { status: 500 }
      );
    }

    // Commit transaction
    await session.commitTransaction();
    log(`Successfully unmerged defect ${mergedDefectId}. Restored ${defectIdsToRestore.length} defects (${defectsToRestore.length} from time window, ${additionalImageDefectIds.length} from additional_images).`);

    // Return success response
    return NextResponse.json(
      {
        success: true,
        restoredDefectCount: defectIdsToRestore.length,
        restoredDefectIds: defectIdsToRestore
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    await session.abortTransaction();
    const errorMessage = error instanceof Error ? error.message : "Failed to unmerge defects";
    logError("Error in unmerge defects:", error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}
