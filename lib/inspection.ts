// lib/inspection.ts
import clientPromise from "./mongodb";
import { ObjectId } from "mongodb";

const DB_NAME = "agi_inspections_db"; // change this

const COLLECTION_NAME = "inspections";

type CreateInspectionParams = {
  name: string;
  companyId: string;
  status?: string;
  date?: string | Date;
  createdBy?: string;
};

const formatInspection = (doc: any) => {
  if (!doc) return null;
  return {
    _id: doc._id?.toString(),
    id: doc._id?.toString(),
    name: doc.name ?? "",
    status: doc.status ?? "Pending",
    date: doc.date ? new Date(doc.date).toISOString() : null,
    companyId: doc.companyId ? doc.companyId.toString() : null,
    createdBy: doc.createdBy ? doc.createdBy.toString() : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
};

// 1. Create inspection scoped to a company
export async function createInspection({
  name,
  companyId,
  status,
  date,
  createdBy,
}: CreateInspectionParams) {
  if (!name || !companyId) {
    throw new Error("Missing required inspection fields");
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const now = new Date();
  const document: Record<string, any> = {
    name,
    status: status ?? "Pending",
    date: date ? new Date(date) : now,
    companyId: new ObjectId(companyId),
    createdAt: now,
    updatedAt: now,
  };

  if (createdBy) {
    document.createdBy = ObjectId.isValid(createdBy)
      ? new ObjectId(createdBy)
      : createdBy;
  }

  const result = await db.collection(COLLECTION_NAME).insertOne(document);
  return formatInspection({ ...document, _id: result.insertedId });
}

// 2. Get all inspections for a company
export async function getAllInspections(companyId: string) {
  if (!companyId) {
    return [];
  }

  const client = await clientPromise;
  const db = client.db(DB_NAME);

  const cursor = db
    .collection(COLLECTION_NAME)
    .find({ companyId: new ObjectId(companyId) })
    .sort({ updatedAt: -1 });

  const results = await cursor.toArray();
  return results.map(formatInspection).filter(Boolean);
}


export async function deleteInspection(inspectionId: string) {
  const client = await clientPromise;
  const db = client.db(DB_NAME);

  // Validate if inspectionId is a valid ObjectId
  if (!ObjectId.isValid(inspectionId)) {
    throw new Error('Invalid inspection ID format');
  }

  const result = await db.collection(COLLECTION_NAME).deleteOne({
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
  hidePricing: boolean; // hide cost estimates in all report formats
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

  if (Object.keys(updateData).length === 0) {
    return { matchedCount: 0, modifiedCount: 0 };
  }

  updateData.updatedAt = new Date();

  const result = await db.collection(COLLECTION_NAME).updateOne(
    { _id: new ObjectId(inspectionId) },
    { $set: updateData }
  );

  return result;
}