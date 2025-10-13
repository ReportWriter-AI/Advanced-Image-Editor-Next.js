// lib/inspection.ts
import clientPromise from "./mongodb";
import { ObjectId } from "mongodb";

const DB_NAME = "agi_inspections_db"; // change this

// 1. Create inspection
export async function createInspection(data: {
  name: string;
  status: string;
  date: string; // or Date
}) {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  const result = await db.collection("inspections").insertOne(data);
  return result.insertedId.toString();
}

// 2. Get all inspections
export async function getAllInspections() {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  return await db.collection("inspections").find({}).toArray();
}


export async function deleteInspection(inspectionId: string) {
  const client = await clientPromise;
  const db = client.db(DB_NAME);

  // Validate if inspectionId is a valid ObjectId
  if (!ObjectId.isValid(inspectionId)) {
    throw new Error('Invalid inspection ID format');
  }

  const result = await db.collection("inspections").deleteOne({
    _id: new ObjectId(inspectionId)
  });

  return result;
}

// 4. Update inspection - can update any inspection field including headerImage and headerText
export async function updateInspection(inspectionId: string, data: Partial<{
  name: string;
  status: string;
  date: string | Date;
  headerImage: string;
  headerText: string; // legacy single-line header
  headerName: string; // new: name line
  headerAddress: string; // new: address line
  pdfReportUrl: string; // permanent PDF report URL
  htmlReportUrl: string; // permanent HTML report URL
  pdfReportGeneratedAt: Date; // timestamp when PDF was generated
  htmlReportGeneratedAt: Date; // timestamp when HTML was generated
}>) {
  const client = await clientPromise;
  const db = client.db(DB_NAME);

  // Validate if inspectionId is a valid ObjectId
  if (!ObjectId.isValid(inspectionId)) {
    throw new Error('Invalid inspection ID format');
  }

  // Filter out undefined values to only update fields that are provided
  const updateData = Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);

  const result = await db.collection("inspections").updateOne(
    { _id: new ObjectId(inspectionId) },
    { $set: updateData }
  );

  return result;
}