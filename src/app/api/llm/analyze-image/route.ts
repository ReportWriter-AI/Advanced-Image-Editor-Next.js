import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { uploadToR2 } from "@/lib/r2";
import { createDefect } from "@/lib/defect";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
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

const client = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export async function POST(request: Request) {
  try {
    let imageUrl: string | undefined;
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
  
    if (videoFile) {
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

  // Unique ID for job
  const analysisId = `${inspectionId}-${Date.now()}`;

  console.log('enquing jobbbbbb');

  // Publish job to QStash -> will call /api/process-analysis
  await client.publishJSON({
    url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/process-analysis`,
    body: {
      imageUrl,
      description,
      location,
      inspectionId,
      section,
      subSection,
      selectedColor,
      analysisId,
      finalVideoUrl,
      thumbnail,
      type,
      isThreeSixty
    },
  });

  return NextResponse.json(
    {
      message: "Analysis started. Defect will be saved when ready.",
      analysisId,
      statusUrl: `/api/analysis-status/${analysisId}`,
    },
    { status: 202 }
  );
} catch {
  console.log('error getting the input')
}
}



// Optional: Add GET method for testing or documentation
export async function GET() {
  return NextResponse.json({
    message: 'Use POST method to analyze images',
    endpoint: '/api/llm/analyze-image',
    required_fields: ['imageUrl', 'description']
  });
}

// Optional: Add other HTTP methods if needed
export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed', message: 'Only POST requests are accepted' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed', message: 'Only POST requests are accepted' },
    { status: 405 }
  );
}