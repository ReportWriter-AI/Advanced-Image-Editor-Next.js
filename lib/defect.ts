// lib/defect.ts
import dbConnect from "./db";
import Defect from "@/src/models/Defect";
import mongoose from "mongoose";

// 3. Create defect
export async function createDefect(data: {
  inspection_id: string;
  image: string;
  location: string;
  section: string;
  subsection: string;
  defect_description: string;
  materials: string;
  material_total_cost: number;
  labor_type: string;
  labor_rate: number;
  hours_required: number;
  recommendation: string;
  color?: string; // Add selected arrow color field
  isThreeSixty?: boolean; // Mark as 360° photo
  additional_images?: Array<{ url: string; location: string; isThreeSixty?: boolean }>; // Multiple location photos (support 360)
  base_cost?: number; // Initial AI-calculated cost (before multiplying by image count)
  annotations?: any[]; // Store annotation shapes (arrows, circles, squares, freehand) as JSON
  originalImage?: string; // Original image without annotations (for re-editing)
}) {
  await dbConnect();

  // ensure inspection_id stored as ObjectId
  const defectData = {
    ...data,
    inspection_id: new mongoose.Types.ObjectId(data.inspection_id),
  };

  const result = await Defect.create(defectData);
  return (result as any)._id.toString();
}

// 4. Get defects by inspection_id
export async function getDefectsByInspection(inspectionId: string) {
  await dbConnect();
  return await Defect.find({ 
    inspection_id: new mongoose.Types.ObjectId(inspectionId) 
  }).lean();
}


export async function deleteDefect(defectId: string) {
  await dbConnect();

  const result = await Defect.deleteOne({
    _id: new mongoose.Types.ObjectId(defectId)
  });

  return result;
}

export async function updateDefect(defectId: string, inspectionId: string, updates: {
  defect_description?: string;
  materials?: string;
  material_total_cost?: number;
  location?: string;
  labor_type?: string;
  labor_rate?: number;
  hours_required?: number;
  recommendation?: string;
  isThreeSixty?: boolean;
  additional_images?: Array<{ url: string; location: string; isThreeSixty?: boolean }>; // Multiple location photos (support 360)
  base_cost?: number; // Base cost for calculation
  image?: string; // Allow updating the main image
  annotations?: any[]; // Update annotation shapes
  originalImage?: string; // Update original image
}) {
  await dbConnect();

  const result = await Defect.updateOne(
    {
      _id: new mongoose.Types.ObjectId(defectId),
      inspection_id: new mongoose.Types.ObjectId(inspectionId), // ensure it belongs to the right inspection
    },
    {
      $set: updates,
    }
  );

  return result;
}