import { NextResponse } from "next/server";
import { uploadToR2, generatePresignedUploadUrl } from "@/lib/r2";

// Configure route to accept large file uploads (360° photos can be 30-50MB)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for large file uploads

// Dynamic import for heic-convert (ESM module)
let heicConvert: any = null;

async function getHeicConvert() {
  if (!heicConvert) {
    heicConvert = (await import('heic-convert')).default;
  }
  return heicConvert;
}

// GET handler supports:
// 1. Image proxying: ?imageUrl=... (legacy)
// 2. Presigned URL generation: ?action=presigned&fileName=...&contentType=...
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    
    // NEW: Presigned URL generation
    if (action === 'presigned') {
      const fileName = searchParams.get('fileName');
      const contentType = searchParams.get('contentType');
      
      if (!fileName || !contentType) {
        return NextResponse.json(
          { error: "fileName and contentType are required for presigned URL" },
          { status: 400 }
        );
      }

      // Generate unique key with timestamp
      const timestamp = Date.now();
      const key = `uploads/${timestamp}-${fileName}`;

      console.log('🔑 Generating presigned URL for:', key);

      const { uploadUrl, publicUrl, key: finalKey } = await generatePresignedUploadUrl(
        key,
        contentType,
        300 // 5 minutes expiry
      );

      return NextResponse.json({
        success: true,
        uploadUrl,
        publicUrl,
        key: finalKey,
      });
    }

    // LEGACY: Image proxy
    const imageUrl = searchParams.get('imageUrl');

    if (!imageUrl) {
      return NextResponse.json({ error: "No imageUrl provided" }, { status: 400 });
    }

    // Normalize obvious protocol/port mismatches for known R2-style hosts to avoid SSL handshake errors
    const normalizeUrl = (raw: string): string => {
      try {
        const u = new URL(raw);
        const host = u.hostname.toLowerCase();
        const isR2 = host.includes('r2.cloudflarestorage.com') || host.endsWith('.r2.dev') || host.includes('cloudflare') || host.includes('r2');
        if (isR2 && u.protocol === 'http:') {
          u.protocol = 'https:'; // R2 endpoints generally require TLS
        }
        if (u.protocol === 'https:' && u.port === '80') u.port = '';
        if (u.protocol === 'http:' && u.port === '443') u.port = '';
        return u.toString();
      } catch {
        return raw;
      }
    };

    const targetUrl = normalizeUrl(imageUrl);

    console.log('🔄 Proxying image fetch for:', targetUrl);

    // Fetch the image from R2 (or external)
    let response: Response;
    try {
      response = await fetch(targetUrl);
    } catch (err: any) {
      // Surface clearer diagnostics for SSL wrong version errors without changing functionality
      const code = err?.cause?.code || err?.code;
      if (code === 'ERR_SSL_WRONG_VERSION_NUMBER') {
        console.error('⚠️ SSL handshake error (wrong version) for URL:', targetUrl);
        return NextResponse.json({ error: 'Upstream SSL handshake failed for the provided URL.' }, { status: 502 });
      }
      throw err;
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    // Get the image as a blob
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();

    console.log('✅ Image fetched successfully, size:', arrayBuffer.byteLength);

    // Return the image with proper headers
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': blob.type || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error: any) {
    console.error("❌ Image proxy failed:", error);
    return NextResponse.json(
      { error: `Failed to fetch image: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    console.log('🚀 R2 API POST request received');
    
    // Check if required environment variables are set
    const requiredEnvVars = [
      "CLOUDFLARE_ACCOUNT_ID",
      "CLOUDFLARE_R2_BUCKET",
      "CLOUDFLARE_R2_ACCESS_KEY_ID",
      "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      "CLOUDFLARE_PUBLIC_URL"
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      console.error(`Missing environment variables: ${missingVars.join(', ')}`);
      return NextResponse.json(
        { error: "Server configuration error: Missing R2 storage credentials" },
        { status: 500 }
      );
    }

    console.log('📋 Parsing form data...');
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      console.error('❌ No file provided in request');
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log('📁 File received:', {
      name: file.name,
      size: file.size,
      sizeMB: (file.size / (1024 * 1024)).toFixed(2),
      type: file.type
    });

  // Validate file size: different limits for images vs videos
  // Note: 360° photos are typically larger (30-50MB). Limit increased to 200MB for both images and videos.
    const fileExt = file.name.toLowerCase().split('.').pop() || '';
    const isVideo = file.type.startsWith('video/') || ['mp4','mov','webm','3gp','3gpp','m4v'].includes(fileExt);
  const maxSizeBytes = isVideo ? 200 * 1024 * 1024 : 200 * 1024 * 1024; // 200MB for both videos and images
    
    console.log('🔍 File size validation:', {
      fileSize: file.size,
      maxSizeBytes,
      isVideo,
      withinLimit: file.size <= maxSizeBytes
    });
    
    if (file.size > maxSizeBytes) {
      console.error('❌ File size exceeds limit:', file.size, 'bytes (', (file.size / (1024 * 1024)).toFixed(2), 'MB)');
      return NextResponse.json(
        { error: `File size exceeds the 200MB limit` },
        { status: 400 }
      );
    }

    // Validate file type - include images (with HEIC/HEIF) and common videos
    const allowedImageTypes = [
      "image/jpeg", 
      "image/png", 
      "image/gif", 
      "image/webp",
      "image/heic",
      "image/heif",
      "image/heic-sequence",
      "image/heif-sequence"
    ];
    const allowedVideoTypes = [
      "video/mp4",
      "video/quicktime", // .mov
      "video/webm",
      "video/3gpp",
      "video/x-m4v",
    ];

    // Also check file extension for HEIC files (some browsers don't set correct MIME type)
    const isHeicFile = fileExt === 'heic' || fileExt === 'heif' || 
                       file.type.toLowerCase().includes('heic') || 
                       file.type.toLowerCase().includes('heif');

    const isAllowedImage = allowedImageTypes.includes(file.type) || isHeicFile;
    const isAllowedVideo = allowedVideoTypes.includes(file.type) || (isVideo && ['mp4','mov','webm','3gp','3gpp','m4v'].includes(fileExt));
    
    if (!isAllowedImage && !isAllowedVideo) {
      return NextResponse.json(
        { error: "Only images (JPG, PNG, GIF, WebP, HEIC/HEIF) and videos (MP4, MOV, WebM, 3GP, M4V) are supported" },
        { status: 400 }
      );
    }

    // Convert to Buffer for processing
    let arrayBuffer = await file.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
  let finalContentType = file.type;
  let finalFileName = file.name;

    // Convert HEIC/HEIF to JPEG
  if (!isVideo && isHeicFile) {
      try {
        console.log("📸 Converting HEIC/HEIF image to JPEG...");
        const convert = await getHeicConvert();
        
        const jpegBuffer = await convert({
          buffer: buffer,
          format: 'JPEG',
          quality: 0.92 // High quality conversion
        });
        
        buffer = Buffer.from(jpegBuffer);
        finalContentType = 'image/jpeg';
        // Change file extension to .jpg
        finalFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
        console.log("✅ HEIC/HEIF converted to JPEG successfully");
      } catch (conversionError) {
        console.error("❌ HEIC conversion failed:", conversionError);
        return NextResponse.json(
          { error: "Failed to convert HEIC/HEIF image. Please try a different format." },
          { status: 500 }
        );
      }
    }

    // Create unique filename with sanitized name
  const sanitizedName = finalFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const folder = isVideo ? 'uploads/videos' : 'uploads';
  const key = `${folder}/${Date.now()}-${sanitizedName}`;

    console.log("Starting R2 upload process...");
    const result = await uploadToR2(buffer, key, finalContentType);

    return NextResponse.json(
      { success: true, url: result, type: isVideo ? 'video' : 'image' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("❌ Upload failed with error:", {
      message: error.message,
      code: error.code,
      stack: error.stack?.split('\n')[0],
      name: error.name
    });
    
    // Check for specific Vercel body size limit errors
    if (error.message?.includes('413') || error.message?.toLowerCase().includes('payload too large')) {
      return NextResponse.json(
        { error: "File too large for Vercel plan. Consider upgrading to Pro plan or compress file under 4.5MB." },
        { status: 413 }
      );
    }
    
    // Check for timeout errors
    if (error.message?.toLowerCase().includes('timeout') || error.code === 'ETIMEDOUT') {
      return NextResponse.json(
        { error: "Upload timeout. Large files may take longer to process." },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { error: `Upload failed: ${error.message}` },
      { status: 500 }
    );
  }
}
