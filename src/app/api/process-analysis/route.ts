// /app/api/process-analysis/route.ts
import { NextResponse } from "next/server";
import { verifySignature } from "@upstash/qstash/nextjs";
import OpenAI from 'openai';
import { uploadToR2 } from "@/lib/r2";
import { createDefect } from "@/lib/defect";

import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
// import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

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
    console.log("🔥 PROCESS-ANALYSIS ENDPOINT HIT!");
    console.log("📨 Request received at:", new Date().toISOString());
    
    // const raw = await request.text();
    // console.log("Raw body:", raw);
    const body = await request.json();
    console.log("📦 Request body keys:", Object.keys(body));
    
    const {
      imageUrl,
      description,
      file,
      location,
      inspectionId,
      section,
      subSection,
      selectedColor,
      analysisId,
      finalVideoUrl,
      thumbnail,
      type,
      videoSrc,
      isThreeSixty
    } = body;

    console.log("🔄 Processing job", analysisId);
    console.log("📍 Inspection ID:", inspectionId);
    console.log("📝 Section:", section, "Subsection:", subSection);

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
        console.log('no thumbnail found')
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

    // ✅ Create OpenAI thread
    const thread = await openai.beta.threads.create();

    const content: any[] = [
      { type: "text", text: `Description: ${description} || Location: ${location}` },
    ];

    // if (file) {
    //   const uploaded = await openai.files.create({ file, purpose: "vision" });
    //   content.push({ type: "image_file", image_file: { file_id: uploaded.id } });
    
      content.push({ type: "image_url", image_url: { url: finalImageUrl } });
    // }

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content,
    });

    console.log("🤖 Creating OpenAI run with Assistant ID:", process.env.OPENAI_ASSISTANT_ID);
    
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.OPENAI_ASSISTANT_ID!,
    });

    console.log("⏳ Polling OpenAI run...", run.id);
    
    // Poll until done
    let runStatus = run.status;
    while (!["completed", "failed", "cancelled"].includes(runStatus)) {
      await new Promise((r) => setTimeout(r, 2000));
      const currentRun = await openai.beta.threads.runs.retrieve(run.id, {
        thread_id: thread.id,
      });
      runStatus = currentRun.status;
    }

    console.log("✅ OpenAI run completed with status:", runStatus);
    
    if (runStatus !== "completed") {
      console.error("❌ Run failed:", runStatus);
      return NextResponse.json({ error: "Run failed" }, { status: 500 });
    }

    const messages = await openai.beta.threads.messages.list(thread.id);

    let assistantResponse = "";
    for (const msg of messages.data) {
      if (msg.role === "assistant") {
        for (const c of msg.content) {
          if (c.type === "text") {
            assistantResponse = c.text.value;
            break;
          }
        }
      }
      if (assistantResponse) break;
    }

    const jsonMatch = assistantResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("❌ Assistant response not JSON:", assistantResponse);
      return NextResponse.json({ error: "Invalid AI response" }, { status: 500 });
    }

    console.log("📄 Parsing AI response...");
    const parsed = JSON.parse(jsonMatch[0]);
    console.log("✅ Parsed defect data:", {
      defect: parsed.defect?.substring(0, 50),
      materials: parsed.materials_names,
      labor_rate: parsed.labor_rate,
      hours: parsed.hours_required
    });

    // Calculate total cost from AI analysis
    const totalCost = (parsed.materials_total_cost || 0) + ((parsed.labor_rate || 0) * (parsed.hours_required || 0));

    const defectData = {
      inspection_id: inspectionId,
      image: finalImageUrl!,
      location: location || "",
      section: section || "",
      subsection: subSection || "",
      defect_description: parsed.defect || description || "",
      defect_short_description: parsed.short_description || "",
      materials: parsed.materials_names || "",
      material_total_cost: totalCost, // Use calculated total cost
      labor_type: parsed.labor_type || "",
      labor_rate: parsed.labor_rate || 0,
      hours_required: parsed.hours_required || 0,
      recommendation: parsed.recommendation || "",
      color: selectedColor || undefined,
      type: type,
      thumbnail: finalThumbnailUrl,
      video: finalVideoUrl,
      isThreeSixty: isThreeSixty || false,
      base_cost: totalCost, // Save base cost for future multiplication
      additional_images: [], // Initialize empty array for additional location photos
    };

    await createDefect(defectData);
    console.log("✅ Defect saved", defectData);

    return NextResponse.json({ success: true }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  } catch (err: any) {
    console.error("Process-analysis error:", err);
    return NextResponse.json({ error: err.message }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }
}

// ✅ Secure endpoint with QStash signature verification
// TEMPORARILY DISABLED for debugging - re-enable after fixing!
export const POST = handler;
// export const POST = verifySignatureAppRouter(handler);

// Handle CORS preflight requests
export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
