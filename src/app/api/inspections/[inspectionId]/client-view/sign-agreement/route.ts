import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import mongoose from "mongoose";
import { isValidTokenFormat } from "@/src/lib/token-utils";

// POST /api/inspections/[inspectionId]/client-view/sign-agreement?token=xxx
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();

    const { inspectionId } = await params;

    // Validate inspection ID format
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID" },
        { status: 400 }
      );
    }

    // Get token from query params
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    // Validate token is provided
    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 401 }
      );
    }

    // Validate token format
    if (!isValidTokenFormat(token)) {
      return NextResponse.json(
        { error: "Invalid token format" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { agreementIds, inputData } = body;

    // Validate agreementIds array
    if (!Array.isArray(agreementIds) || agreementIds.length === 0) {
      return NextResponse.json(
        { error: "agreementIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Find inspection by ID and token
    const inspection = await Inspection.findOne({
      _id: new mongoose.Types.ObjectId(inspectionId),
      token: token,
    });

    // If inspection not found or token doesn't match
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found or invalid token" },
        { status: 404 }
      );
    }

    // Update agreements: set isSigned to true for matching agreementIds and save input data
    if (inspection.agreements && Array.isArray(inspection.agreements)) {
      const agreementIdsToSign = agreementIds.map((id: string) => 
        new mongoose.Types.ObjectId(id)
      );

      inspection.agreements = inspection.agreements.map((agreementEntry: any) => {
        const agreementId = agreementEntry.agreementId;
        const agreementIdString = agreementId?.toString();
        
        if (agreementIdsToSign.some((id: mongoose.Types.ObjectId) => id.toString() === agreementIdString)) {
          // Get input data for this agreement
          const agreementInputData = inputData && inputData[agreementIdString] 
            ? inputData[agreementIdString] 
            : {};
          
          return {
            ...agreementEntry,
            isSigned: true,
            inputData: agreementInputData,
          };
        }
        return agreementEntry;
      });

      await inspection.save();

      // Check if all agreements are now signed
      const allSigned = inspection.agreements.every((a: any) => a.isSigned === true);
      if (allSigned && inspection.agreements.length > 0) {
        const { checkAndProcessTriggers } = await import('@/src/lib/automation-trigger-helper');
        await checkAndProcessTriggers(inspectionId, 'ALL_AGREEMENTS_SIGNED');

        // Also check if fully paid for combined trigger
        if (inspection.isPaid) {
          await checkAndProcessTriggers(inspectionId, 'ALL_AGREEMENTS_SIGNED_AND_FULLY_PAID');
        }
      }
    }

    return NextResponse.json(
      { message: "Agreements signed successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error signing agreements:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sign agreements" },
      { status: 500 }
    );
  }
}

