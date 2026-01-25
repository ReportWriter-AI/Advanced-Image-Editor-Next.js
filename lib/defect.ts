// lib/defect.ts
import dbConnect from "./db";
import Defect from "@/src/models/Defect";
import mongoose from "mongoose";

// 3. Create defect
export async function createDefect(data: {
  inspection_id: string;
  templateId?: string;
  sectionId?: string;
  subsectionId?: string;
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
  title?: string;
  narrative?: string;
  severity?: string;
  trade?: string;
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
    ...(data.templateId && { templateId: new mongoose.Types.ObjectId(data.templateId) }),
    ...(data.sectionId && { sectionId: new mongoose.Types.ObjectId(data.sectionId) }),
    ...(data.subsectionId && { subsectionId: new mongoose.Types.ObjectId(data.subsectionId) }),
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

// Get defects by subsection (for report editing page)
export async function getDefectsBySubsection(
  inspectionId: string,
  templateId: string,
  sectionId: string,
  subsectionId: string
) {
  await dbConnect();
  return await Defect.find({
    inspection_id: new mongoose.Types.ObjectId(inspectionId),
    templateId: new mongoose.Types.ObjectId(templateId),
    sectionId: new mongoose.Types.ObjectId(sectionId),
    subsectionId: new mongoose.Types.ObjectId(subsectionId),
  }).sort({ createdAt: -1 }).lean();
}

// Get all defects by template (for report viewing page)
export async function getDefectsByTemplate(
  inspectionId: string,
  templateId: string
) {
  await dbConnect();
  return await Defect.find({
    inspection_id: new mongoose.Types.ObjectId(inspectionId),
    templateId: new mongoose.Types.ObjectId(templateId),
  }).sort({ createdAt: -1 }).lean();
}

// Get defects by template with optional sectionId and subsectionId filters
export async function getDefectsByTemplateWithFilters(
  inspectionId: string,
  templateId: string,
  sectionId?: string,
  subsectionId?: string
) {
  await dbConnect();
  const query: any = {
    inspection_id: new mongoose.Types.ObjectId(inspectionId),
    templateId: new mongoose.Types.ObjectId(templateId),
  };

  // Add optional filters if provided
  if (sectionId) {
    query.sectionId = new mongoose.Types.ObjectId(sectionId);
  }
  if (subsectionId) {
    query.subsectionId = new mongoose.Types.ObjectId(subsectionId);
  }

  return await Defect.find(query).sort({ createdAt: -1 }).lean();
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
  section?: string;
  subsection?: string;
  templateId?: string;
  sectionId?: string;
  subsectionId?: string;
  labor_type?: string;
  labor_rate?: number;
  hours_required?: number;
  recommendation?: string;
  title?: string;
  narrative?: string;
  severity?: string;
  trade?: string;
  isThreeSixty?: boolean;
  additional_images?: Array<{ url: string; location: string; isThreeSixty?: boolean }>; // Multiple location photos (support 360)
  base_cost?: number; // Base cost for calculation
  image?: string; // Allow updating the main image
  annotations?: any[]; // Update annotation shapes
  originalImage?: string; // Update original image
}) {
  await dbConnect();

  // Convert string IDs to ObjectIds if provided
  const updateData: any = { ...updates };
  if (updates.templateId) {
    updateData.templateId = new mongoose.Types.ObjectId(updates.templateId);
  }
  if (updates.sectionId) {
    updateData.sectionId = new mongoose.Types.ObjectId(updates.sectionId);
  }
  if (updates.subsectionId) {
    updateData.subsectionId = new mongoose.Types.ObjectId(updates.subsectionId);
  }

  const result = await Defect.updateOne(
    {
      _id: new mongoose.Types.ObjectId(defectId),
      inspection_id: new mongoose.Types.ObjectId(inspectionId), // ensure it belongs to the right inspection
    },
    {
      $set: updateData,
    }
  );

  return result;
}