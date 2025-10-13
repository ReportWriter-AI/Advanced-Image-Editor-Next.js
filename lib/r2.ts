import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID!;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET!;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
const public_url = process.env.CLOUDFLARE_PUBLIC_URL;

// Initialize the S3 client with proper configuration
const S3 = new S3Client({
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
) {
  try {
    const timestamp = Date.now();
    const extension = reportType === 'pdf' ? 'pdf' : 'html';
    const contentType = reportType === 'pdf' ? 'application/pdf' : 'text/html';
    
    // Create a structured path: reports/inspection-{id}/inspection-{id}-{mode}-{timestamp}.{ext}
    const key = `reports/inspection-${inspectionId}/inspection-${inspectionId}-${reportMode}-${timestamp}.${extension}`;
    
    const url = await uploadToR2(fileBuffer, key, contentType);
    
    console.log(`✅ Report uploaded: ${reportType.toUpperCase()} - ${url}`);
    return url;
  } catch (error) {
    console.error(`❌ Failed to upload ${reportType} report:`, error);
    throw error;
  }
}