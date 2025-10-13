import { NextRequest, NextResponse } from "next/server";
import { uploadReportToR2 } from "../../../../../lib/r2";
import { updateInspection } from "../../../../../lib/inspection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { htmlContent, inspectionId, reportMode = 'full' } = await req.json();

    if (!htmlContent || !inspectionId) {
      return NextResponse.json(
        { error: "HTML content and inspection ID are required" },
        { status: 400 }
      );
    }

    console.log(`📤 Uploading HTML to R2 for inspection ${inspectionId}...`);

    // Convert HTML string to Buffer
    const htmlBuffer = Buffer.from(htmlContent, 'utf-8');

    // Upload to R2
    const permanentUrl = await uploadReportToR2(
      htmlBuffer,
      inspectionId,
      'html',
      reportMode
    );

    // Save the permanent URL to MongoDB
    await updateInspection(inspectionId, {
      htmlReportUrl: permanentUrl,
      htmlReportGeneratedAt: new Date()
    });

    console.log(`✅ HTML permanent URL saved: ${permanentUrl}`);

    return NextResponse.json({
      success: true,
      url: permanentUrl
    });

  } catch (error: any) {
    console.error('❌ Failed to upload HTML report:', error);
    return NextResponse.json(
      { error: error.message || "Failed to upload HTML report" },
      { status: 500 }
    );
  }
}
