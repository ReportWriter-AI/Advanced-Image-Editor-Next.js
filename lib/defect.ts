// lib/defect.ts
import clientPromise from "./mongodb";
import { ObjectId } from "mongodb";

const DB_NAME = "agi_inspections_db"; // change this

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
}) {
  const client = await clientPromise;
  const db = client.db(DB_NAME);

  // ensure inspection_id stored as ObjectId
  const defectData = {
    ...data,
    inspection_id: new ObjectId(data.inspection_id),
  };

  const result = await db.collection("defects").insertOne(defectData);
  return result.insertedId.toString();
}

// 4. Get defects by inspection_id
export async function getDefectsByInspection(inspectionId: string) {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  return await db
    .collection("defects")
    .find({ inspection_id: new ObjectId(inspectionId) })
    .toArray();
}


export async function deleteDefect(defectId: string) {
  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const result = await db.collection("defects").deleteOne({
    _id: new ObjectId(defectId)
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
}) {
  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const result = await db.collection("defects").updateOne(
    {
      _id: new ObjectId(defectId),
      inspection_id: new ObjectId(inspectionId), // ensure it belongs to the right inspection
    },
    {
      $set: updates,
    }
  );

  return result;
}