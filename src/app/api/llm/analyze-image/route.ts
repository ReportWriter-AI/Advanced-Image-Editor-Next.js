import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { uploadToR2 } from "@/lib/r2";
import { createDefect } from "@/lib/defect";

// Force dynamic rendering to avoid build-time execution
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

interface ErrorResponse {
  error: string;
  message: string;
  details?: string;
}

interface AnalysisResult {
  defect?: string;
  materials_names?: string;
  materials_total_cost?: number;
  labor_type?: string;
  labor_rate?: number;
  hours_required?: number;
  recommendation?: string;
  analysis?: string;
}

import { Client } from "@upstash/qstash";

const getQstashClient = () => {
  const token = process.env.QSTASH_TOKEN;
  if (!token) {
    throw new Error("Missing QSTASH_TOKEN environment variable");
  }
  return new Client({ token });
};

const decodeBase64Image = (dataString: string) => {
  const matches = dataString.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error("Invalid base64 image string");
  }
  return {
    mime: matches[1],
    buffer: Buffer.from(matches[2], "base64"),
  };
};

export async function POST(request: Request) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (!baseUrl) {
      throw new Error("Missing NEXT_PUBLIC_BASE_URL environment variable");
    }

    const client = getQstashClient();

  let imageUrl: string | undefined;
  let videoUrlJson: string | undefined;
  let thumbnailUrlJson: string | undefined;
    let description: string | undefined;
    let file: File | null = null;
    let location: string | undefined;
    let inspectionId: string | undefined;
    let section: string | undefined;
    let subSection: string | undefined;
    let selectedColor: string | undefined;
    let videoFile: File | null = null;
    let thumbnail: string | null = null;
    let type: string | undefined;
    let videoSrc: string | null = null;
    let isThreeSixty = false;
    let annotations: any[] | undefined;
    let originalImage: string | undefined;
  
    const contentType = request.headers.get("content-type") || "";
  
    if (contentType.includes("application/json")) {
      const body = await request.json();
      imageUrl = body.imageUrl;
      description = body.description;
      location = body.location;
      inspectionId = body.inspectionId;
      section = body.section;
      subSection = body.subSection;
      selectedColor = body.selectedColor;
      isThreeSixty = body.isThreeSixty || false;
      type = body.type;
      // Optional: video/thumbnail urls already uploaded to R2
      videoUrlJson = body.videoUrl;
      thumbnailUrlJson = body.thumbnailUrl;
      annotations = body.annotations; // Editable annotations
      originalImage = body.originalImage; // Original unannotated image

      console.log('🔍 analyze-image received JSON body');
      console.log('📊 annotations:', annotations);
      console.log('  - is array:', Array.isArray(annotations));
      console.log('  - length:', annotations?.length || 0);
      console.log('🖼️ originalImage:', originalImage);
    }
    else if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      file = form.get("image") as File | null;
      description = form.get("description") as string | undefined;
      imageUrl = form.get("imageUrl") as string | undefined;
      location = form.get("location") as string | undefined;
      inspectionId = form.get("inspectionId") as string | undefined;
      section = form.get('section') as string | undefined;
      subSection = form.get('subSection') as string | undefined;
      selectedColor = form.get('selectedColor') as string | undefined;
      videoFile = form.get("videoFile") as File | null;
      thumbnail = form.get("thumbnail") as string | null;
      type = form.get("type") as string | undefined;
      videoSrc = form.get("videoSrc") as string | null;
      const isThreeSixtyStr = form.get("isThreeSixty") as string | null;
      isThreeSixty = isThreeSixtyStr === 'true';
    }
    else {
      return NextResponse.json(
        { error: "Unsupported content type" },
        { status: 400 }
      );
    }
  
    if ((!imageUrl && !file) || !description || !inspectionId) {
      return NextResponse.json(
        { error: "Missing required params: image/description/inspectionId" },
        { status: 400 }
      );
    }

    console.log(videoFile);
  let finalVideoUrl = null;
    let finalImageUrl = imageUrl;
  let finalThumbnailUrl = thumbnail;
  
  if (videoUrlJson) {
    // Already uploaded via presigned URL
    finalVideoUrl = videoUrlJson;
    console.log("✅ Using pre-uploaded video URL:", finalVideoUrl);
  } else if (videoFile) {
        // Generate R2 key
        const extension = videoFile.name.split(".").pop();
        const key = `inspections/${inspectionId}/${Date.now()}.${extension}`;

        // Upload video file (as buffer) to R2
        const buffer = Buffer.from(await videoFile.arrayBuffer());
        finalVideoUrl = await uploadToR2(buffer, key, videoFile.type);
        console.log("✅ Video uploaded to R2:", finalVideoUrl);
    } else {
      console.log('no video found')
    }

    if (finalImageUrl && !finalImageUrl.startsWith('data:') && !file) {
      // Using pre-uploaded URL from client
      console.log("✅ Using pre-uploaded image URL:", finalImageUrl);
    } else if (file) {
      const extension = file.name.split(".").pop() || "jpg";
      const key = `inspections/${inspectionId}/${Date.now()}.${extension}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      finalImageUrl = await uploadToR2(buffer, key, file.type || 'image/jpeg');
      console.log("✅ Image file uploaded to R2:", finalImageUrl);
    } else if (imageUrl && imageUrl.startsWith('data:')) {
      const { mime, buffer } = decodeBase64Image(imageUrl);
      const isJpeg = mime.includes('jpeg') || mime.includes('jpg');
      const key = `inspections/${inspectionId}/${Date.now()}${isJpeg ? '.jpg' : '.png'}`;
      finalImageUrl = await uploadToR2(buffer, key, isJpeg ? 'image/jpeg' : mime);
      console.log("✅ Base64 image uploaded to R2:", finalImageUrl);
    }

    if (thumbnailUrlJson) {
      finalThumbnailUrl = thumbnailUrlJson;
      console.log("✅ Using pre-uploaded thumbnail URL:", finalThumbnailUrl);
    } else if (thumbnail && thumbnail.startsWith('data:')) {
      const { mime, buffer } = decodeBase64Image(thumbnail);
      const key = `inspections/${inspectionId}/${Date.now()}-thumbnail.png`;
      finalThumbnailUrl = await uploadToR2(buffer, key, mime);
      console.log("✅ Thumbnail uploaded to R2:", finalThumbnailUrl);
    }

  // Unique ID for job
  const analysisId = `${inspectionId}-${Date.now()}`;

  // Publish job to QStash -> will call /api/process-analysis
  try {
    console.log('📤 About to publish to QStash:');
    console.log('  - annotations:', annotations);
    console.log('  - annotations length:', annotations?.length || 0);
    console.log('  - originalImage:', originalImage);

    const qstashResponse = await client.publishJSON({
      url: `${baseUrl}/api/process-analysis`,
      body: {
        imageUrl: finalImageUrl,
        description,
        location,
        inspectionId,
        section,
        subSection,
        selectedColor,
        analysisId,
        finalVideoUrl,
        thumbnail: finalThumbnailUrl,
        type,
        isThreeSixty,
        annotations, // Pass annotations for saving
        originalImage // Pass original image URL
      },
    });

    console.log('✅ QStash publish successful');
  } catch (qstashError) {
    console.error('❌ QStash publish failed:', qstashError);
    throw qstashError;
  }

  return NextResponse.json(
    {
      message: "Analysis started. Defect will be saved when ready.",
      analysisId,
      statusUrl: `/api/analysis-status/${analysisId}`,
    },
    { status: 202 }
  );
} catch (error) {
  console.error('❌ Error handling analyze-image request:', error);
  const message = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json(
    {
      error: 'analyze_image_failed',
      message,
    },
    { status: 500 }
  );
}
}