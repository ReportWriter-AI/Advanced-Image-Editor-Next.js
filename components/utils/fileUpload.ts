/**
 * Uploads a file to R2 storage using presigned URL
 * @param file - The file to upload
 * @returns Promise with publicUrl
 */
export async function uploadFileToR2(file: File): Promise<{ publicUrl: string }> {
  const presignedRes = await fetch(
    `/api/r2api?action=presigned&fileName=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
  );
  
  if (!presignedRes.ok) {
    const errorText = await presignedRes.text();
    throw new Error(`Failed to get presigned URL: ${errorText}`);
  }
  
  const { uploadUrl, publicUrl } = await presignedRes.json();
  
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  
  if (!putRes.ok) {
    const errorText = await putRes.text();
    throw new Error(`Failed to upload file to R2: ${putRes.status} ${errorText}`);
  }
  
  return { publicUrl };
}

/**
 * Uploads a thumbnail (base64 data URL) to R2 storage
 * @param thumbnail - Base64 data URL of the thumbnail
 * @returns Promise with publicUrl or null if thumbnail is invalid
 */
export async function uploadThumbnailToR2(thumbnail: string): Promise<string | null> {
  if (!thumbnail || !thumbnail.startsWith('data:')) {
    return null;
  }
  
  const mimeMatch = thumbnail.match(/^data:(.+);base64,(.+)$/);
  const thumbMime = mimeMatch ? mimeMatch[1] : 'image/png';
  const b64 = mimeMatch ? mimeMatch[2] : '';
  
  if (!b64) {
    return null;
  }
  
  const thumbBuffer = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const thumbFile = new Blob([thumbBuffer], { type: thumbMime });
  const fileName = `thumbnail-${Date.now()}.png`;
  
  const presignedThumbRes = await fetch(
    `/api/r2api?action=presigned&fileName=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(thumbMime)}`
  );
  
  if (!presignedThumbRes.ok) {
    const errorText = await presignedThumbRes.text();
    throw new Error(`Failed to get presigned URL for thumbnail: ${errorText}`);
  }
  
  const { uploadUrl: thumbUploadUrl, publicUrl: thumbPublicUrl } = await presignedThumbRes.json();
  
  const putThumb = await fetch(thumbUploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': thumbMime },
    body: thumbFile,
  });
  
  if (!putThumb.ok) {
    const errorText = await putThumb.text();
    throw new Error(`Failed to upload thumbnail to R2: ${putThumb.status} ${errorText}`);
  }
  
  return thumbPublicUrl;
}

/**
 * Uploads an original image file to R2 storage
 * @param file - The original image file to upload
 * @returns Promise with publicUrl or null if file is not provided
 */
export async function uploadOriginalImageToR2(file: File | null): Promise<string | null> {
  if (!file) {
    return null;
  }
  
  const fileName = `original-${file.name}`;
  const presignedRes = await fetch(
    `/api/r2api?action=presigned&fileName=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(file.type)}`
  );
  
  if (!presignedRes.ok) {
    const errorText = await presignedRes.text();
    throw new Error(`Failed to get presigned URL for original image: ${errorText}`);
  }
  
  const { uploadUrl, publicUrl } = await presignedRes.json();
  
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  
  if (!putRes.ok) {
    const errorText = await putRes.text();
    throw new Error(`Failed to upload original image to R2: ${putRes.status} ${errorText}`);
  }
  
  return publicUrl;
}
