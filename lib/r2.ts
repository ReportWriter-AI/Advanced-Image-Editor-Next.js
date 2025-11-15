import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET!;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
const public_url = process.env.CLOUDFLARE_PUBLIC_URL;

// Initialize the S3 client with proper configuration
const S3: S3Client = new S3Client({
  region: "auto",
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
});



export async function uploadToR2(file: Buffer, key: string, contentType: string) {
  try {
    // Verify environment variables are set
    if (!process.env.CLOUDFLARE_R2_BUCKET) {
      throw new Error("R2 bucket name is not configured");
    }
    
    if (!public_url) {
      throw new Error("Cloudflare public URL is not configured");
    }
    
    const bucket = process.env.CLOUDFLARE_R2_BUCKET;
    
    console.log(`Uploading to R2: bucket=${bucket}, key=${key}, contentType=${contentType}`);
    
    await S3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      })
    );
    
    const fileUrl = `${public_url}/${key}`;
    console.log(`File uploaded successfully: ${fileUrl}`);
    return fileUrl;
  } catch (error) {
    console.error("R2 upload error:", error);
    throw error; // Re-throw to handle in the API route
  }
}

// Upload PDF or HTML report to R2 and return permanent URL
export async function uploadReportToR2(
  fileBuffer: Buffer,
  inspectionId: string,
  reportType: 'pdf' | 'html',
  reportMode: 'full' | 'summary' = 'full'
) : Promise<{ url: string; key: string }> {
  try {
    const timestamp = Date.now();
    const extension = reportType === 'pdf' ? 'pdf' : 'html';
    const contentType = reportType === 'pdf' ? 'application/pdf' : 'text/html';
    
    // Create a structured path: reports/inspection-{id}/inspection-{id}-{mode}-{timestamp}.{ext}
    const key = `reports/inspection-${inspectionId}/inspection-${inspectionId}-${reportMode}-${timestamp}.${extension}`;
    
    const url = await uploadToR2(fileBuffer, key, contentType);
    
    console.log(`✅ Report uploaded: ${reportType.toUpperCase()} - ${url}`);
    return { url, key };
  } catch (error) {
    console.error(`❌ Failed to upload ${reportType} report:`, error);
    throw error;
  }
}

// Extract the R2 object key from a full public URL. Returns null if it doesn't match the configured public base URL.
export function extractR2KeyFromUrl(url: string): string | null {
  if (!public_url) return null;
  try {
    // Normalize both strings to avoid subtle trailing slash issues
    const base = public_url.replace(/\/$/, "");
    const full = url.trim();
    if (full.startsWith(base + "/")) {
      return full.substring((base + "/").length);
    }
    return null;
  } catch {
    return null;
  }
}

// Delete an object from R2 by key. Best-effort utility used for cleanup flows.
export async function deleteFromR2(key: string): Promise<void> {
  if (!process.env.CLOUDFLARE_R2_BUCKET) {
    throw new Error("R2 bucket name is not configured");
  }
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  await S3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

// Server-side copy within the same R2 bucket. Preferred over download+reupload.
export async function copyInR2(srcKey: string, destKey: string): Promise<void> {
  if (!process.env.CLOUDFLARE_R2_BUCKET) {
    throw new Error("R2 bucket name is not configured");
  }
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  // CopySource format: `${Bucket}/${Key}`; Key must be URL-encoded for special chars
  const encodedSrc = encodeURIComponent(srcKey).replace(/%2F/g, '/');
  await S3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: destKey,
      CopySource: `${bucket}/${encodedSrc}`,
      MetadataDirective: 'COPY',
    })
  );
}

// Read an object from R2 and return its content buffer and content type
export async function getR2Object(key: string): Promise<{ buffer: Buffer; contentType: string | undefined }> {
  if (!process.env.CLOUDFLARE_R2_BUCKET) {
    throw new Error("R2 bucket name is not configured");
  }
  const bucket = process.env.CLOUDFLARE_R2_BUCKET;
  const res = await S3.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
  // Body is a stream; consume into Buffer
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body = res.Body as any;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    body.on('data', (chunk: Buffer) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    body.on('end', () => resolve());
    body.on('error', (err: unknown) => reject(err));
  });
  const buffer = Buffer.concat(chunks);
  return { buffer, contentType: res.ContentType };
}

// Convenience: get object as data URI string
export async function getR2ObjectAsDataURI(key: string): Promise<string> {
  const { buffer, contentType } = await getR2Object(key);
  const ct = contentType || inferMimeFromKey(key);
  const b64 = buffer.toString('base64');
  return `data:${ct};base64,${b64}`;
}

// Basic mime inference when ContentType is missing
function inferMimeFromKey(key: string): string {
  const ext = (key.split('.').pop() || '').toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'gif': return 'image/gif';
    case 'webp': return 'image/webp';
    case 'svg': return 'image/svg+xml';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    default: return 'application/octet-stream';
  }
}

// Heuristic resolver: try multiple patterns to derive an object key within the bucket from an arbitrary URL or path
export function resolveR2KeyFromUrl(src: string): string | null {
  // 1) Try strict extraction using configured public base
  let strict = extractR2KeyFromUrl(src);
  if (strict) {
    strict = strict.split(/[?#]/)[0];
    if (strict) return strict;
  }
  // 2) Try extraction when URL contains /<bucket>/<key>
  if (bucketName) {
    const m = src.match(new RegExp(`^https?:\/\/[^/]+\/${bucketName}\/([^?#"'>\s]+)`, 'i'));
    if (m && m[1]) {
      return m[1].replace(/^[\/]+/, '');
    }
  }
  // 3) Generic match for any origin containing /(uploads|inspections|reports)/...
  const match = src.match(/^(?:https?:\/\/[^/]+)?\/(((uploads|inspections|reports)\/[^\?"'>\s#]+))/i);
  if (match && match[1]) return match[1];
  // 4) Root-relative paths
  if (src.startsWith('/uploads/') || src.startsWith('/inspections/') || src.startsWith('/reports/')) return src.replace(/^\//, '');
  // 5) Non-root-relative keys (e.g., "inspections/..." without leading slash)
  if (src.startsWith('uploads/') || src.startsWith('inspections/') || src.startsWith('reports/')) return src;
  return null;
}

// Generate a presigned URL for direct browser-to-R2 upload
// NOTE: Presigned URLs CANNOT use public R2.dev domains - they only work with private S3-compatible endpoints
// WORKAROUND: We generate the presigned URL with private endpoint, but CORS must be configured on the bucket
export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 300 // 5 minutes default
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  if (!process.env.CLOUDFLARE_R2_BUCKET) {
    throw new Error("R2 bucket name is not configured");
  }
  
  if (!public_url) {
    throw new Error("Cloudflare public URL is not configured");
  }

  const bucket = process.env.CLOUDFLARE_R2_BUCKET;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  // Generate presigned URL using the private S3-compatible endpoint
  // CORS MUST be configured on this bucket for this to work from browsers!
  const uploadUrl = await getSignedUrl(S3, command, { expiresIn });
  const publicUrl = `${public_url}/${key}`;

  console.log(`✅ Generated presigned URL for key: ${key}, expires in ${expiresIn}s`);
  console.log(`🔗 Upload URL (private endpoint):`, uploadUrl);

  return { uploadUrl, publicUrl, key };
}