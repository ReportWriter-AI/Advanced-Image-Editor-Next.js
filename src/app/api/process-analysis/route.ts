// /app/api/process-analysis/route.ts
import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { uploadToR2 } from "@/lib/r2";
import { createDefect } from "@/lib/defect";
import { getInspection } from "@/lib/inspection";

// Force dynamic rendering to avoid build-time execution
export const dynamic = 'force-dynamic';

function decodeBase64Image(dataString: string) {
    const matches = dataString.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error("Invalid base64 string");
    }
    return {
      mime: matches[1],            // e.g. "image/png"
      buffer: Buffer.from(matches[2], "base64"),
    };
  }



async function handler(request: Request) {
  try {
  const body = await request.json();

    console.log('🔍 process-analysis received request');
    console.log('📦 Body keys:', Object.keys(body));
    console.log('📊 annotations field:', body.annotations);
    console.log('  - is array:', Array.isArray(body.annotations));
    console.log('  - length:', body.annotations?.length || 0);
    console.log('🖼️ originalImage field:', body.originalImage);

    const {
      imageUrl,
      description,
      file,
      location,
      inspectionId,
      section,
      subSection,
      templateId,
      sectionId,
      subsectionId,
      selectedColor,
      analysisId,
      finalVideoUrl,
      thumbnail,
      type,
      videoSrc,
      isThreeSixty,
      annotations,
      originalImage,
      state: passedState,
      city: passedCity,
      zipCode: passedZipCode
    } = body;


  let finalImageUrl: string | undefined = imageUrl;
  let finalThumbnailUrl: string | null = null;
  // let finalVideoUrl = '';

      if (imageUrl && imageUrl.startsWith("data:")) {
        // Decode base64 into buffer + mime type
        const { mime, buffer } = decodeBase64Image(imageUrl);
      
        // Generate R2 key
        const key = `inspections/${inspectionId}/${Date.now()}.png`;
      
        // Upload buffer to R2
        finalImageUrl = await uploadToR2(buffer, key, mime);
      }

      if (thumbnail) {
        if (thumbnail.startsWith("data:")) {
          // Decode base64 into buffer + mime type
          const { mime, buffer } = decodeBase64Image(thumbnail);
          // Generate R2 key
          const key = `inspections/${inspectionId}/${Date.now()}-thumbnail.png`;
          // Upload buffer to R2
          finalThumbnailUrl = await uploadToR2(buffer, key, mime);
          console.log("✅ Thumbnail uploaded to R2:", finalThumbnailUrl);
        } else {
          // Already a remote URL
          finalThumbnailUrl = thumbnail;
        }
      } else {
  // no thumbnail
      }

      // if (videoFile) {
      //   // Generate R2 key
      //   const extension = videoFile.name.split(".").pop();
      //   const key = `inspections/${inspectionId}/${Date.now()}.${extension}`;

      //   // Upload video file (as buffer) to R2
      //   const buffer = Buffer.from(await videoFile.arrayBuffer());
      //   finalVideoUrl = await uploadToR2(buffer, key, videoFile.type);
      //   console.log("✅ Video uploaded to R2:", finalVideoUrl);
      // } else {
      //   console.log('no video found')
      // }

    // ✅ Fetch inspection to get companyId and location info
    const inspection = await getInspection(inspectionId);
    if (!inspection || !inspection.companyId) {
      return NextResponse.json({ error: "Inspection not found or missing companyId" }, { status: 404 });
    }

    const companyId = inspection.companyId.toString();
    console.log("============================")
    console.log('companyId', companyId);
    console.log("============================")
    // Use passed values if available, otherwise fall back to inspection location
    const inspectionState = passedState || inspection.location?.state || "";
    const inspectionCity = passedCity || inspection.location?.city || "";
    const inspectionZip = passedZipCode || inspection.location?.zip || "";

    // ✅ Convert image URL to Blob for classify API
    let imageBlob: Blob;
    if (finalImageUrl) {
      const imageResponse = await fetch(finalImageUrl);
      if (!imageResponse.ok) {
        return NextResponse.json({ error: "Failed to fetch image for classification" }, { status: 500 });
      }
      imageBlob = await imageResponse.blob();
    } else {
      return NextResponse.json({ error: "No image URL available" }, { status: 400 });
    }

    // ✅ Call classify API
    const formData = new FormData();
    formData.append('file', imageBlob, 'defect-image.png');
    formData.append('company_id', companyId);
    formData.append('context', `${description || ''} || Location: ${location || ''}`);
    formData.append('include_pricing', 'true');
    
    if (inspectionZip) {
      formData.append('zip_code', inspectionZip);
    }
    if (inspectionState) {
      formData.append('state', inspectionState);
    }
    if (inspectionCity) {
      formData.append('city', inspectionCity);
    }
    formData.append('overhead_profit_factor', '1.0');

    const classifyResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/classify`, {
      method: 'POST',
      body: formData,
    });

    if (!classifyResponse.ok) {
      const errorText = await classifyResponse.text();
      console.error("Classify API error:", errorText);
      return NextResponse.json({ error: "Classification failed", details: errorText }, { status: 500 });
    }

    const classifyData = await classifyResponse.json();

    // ✅ Map classify API response to defect data structure
    const materialsCost = classifyData.materials_cost || 0;
    const laborHours = classifyData.labor_hours || 0;
    const laborCost = classifyData.labor_cost || 0;
    const laborRate = laborHours > 0 ? Math.round(laborCost / laborHours) : 0;
    const totalCost = classifyData.estimated_cost || 0;
    
    // Extract materials as a comma-separated string
    const materialsArray = classifyData.materials || [];
    const materialsString = materialsArray
      .map((m: any) => m.label || '')
      .filter((label: string) => label)
      .join(', ') || '';

    const defectData = {
      inspection_id: inspectionId,
      templateId: templateId,
      sectionId: sectionId,
      subsectionId: subsectionId,
      image: finalImageUrl!,
      location: location || "",
      section: section || "",
      subsection: subSection || "",
      defect_description: classifyData.task_description || description || "",
      materials: materialsString,
      material_total_cost: materialsCost,
      labor_type: classifyData.trade || "",
      labor_rate: laborRate,
      hours_required: laborHours,
      recommendation: classifyData.recommendation || "",
      title: classifyData.title || "",
      narrative: classifyData.narrative || "",
      severity: classifyData.severity || "",
      trade: classifyData.trade || "",
      color: selectedColor || undefined,
      type: type,
      thumbnail: finalThumbnailUrl,
      video: finalVideoUrl,
      isThreeSixty: isThreeSixty || false,
      base_cost: totalCost, // Save base cost for future multiplication
      additional_images: [], // Initialize empty array for additional location photos
      annotations: annotations || [], // Save editable annotations
      originalImage: originalImage || finalImageUrl!, // Save original unannotated image
    };

    console.log('💾 About to call createDefect with:');
    console.log('  - annotations:', defectData.annotations);
    console.log('  - annotations length:', defectData.annotations?.length || 0);
    console.log('  - originalImage:', defectData.originalImage);

    console.log('💾 defectData:', defectData);
  await createDefect(defectData);

    console.log('✅ createDefect completed successfully');

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Process-analysis error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Secure endpoint with QStash signature verification
export const POST = verifySignatureAppRouter(handler);
