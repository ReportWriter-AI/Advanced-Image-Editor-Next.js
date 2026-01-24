interface Defect {
  _id: string;
  inspection_id: string;
  section?: string;
  subsection?: string;
  additional_images?: Array<{ url: string; location: string; isThreeSixty?: boolean }>;
  originalImage?: string;
}

/**
 * Fetches a defect by ID from the inspection
 * @param inspectionId - The inspection ID
 * @param defectId - The defect ID
 * @returns Promise with the defect object
 */
export async function fetchDefectById(inspectionId: string, defectId: string): Promise<Defect> {
  const defectRes = await fetch(`/api/defects/${inspectionId}`);
  
  if (!defectRes.ok) {
    throw new Error('Failed to fetch defect data');
  }
  
  const defects = await defectRes.json();
  const defect = defects.find((d: any) => d._id === defectId);
  
  if (!defect) {
    throw new Error('Defect not found');
  }
  
  return defect;
}

/**
 * Updates a defect's main image and annotations
 * @param defectId - The defect ID
 * @param inspectionId - The inspection ID
 * @param imageUrl - The new image URL
 * @param annotations - The annotations array
 * @param originalImage - Optional original image URL
 * @returns Promise that resolves when update is complete
 */
export async function updateDefectImage(
  defectId: string,
  inspectionId: string,
  imageUrl: string,
  annotations: any[],
  originalImage?: string
): Promise<void> {
  const defect = await fetchDefectById(inspectionId, defectId);
  
  const updatePayload = {
    inspection_id: defect.inspection_id,
    image: imageUrl,
    annotations,
    originalImage: originalImage || defect.originalImage || imageUrl
  };
  
  const updateRes = await fetch(`/api/defects/${defectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatePayload)
  });
  
  if (!updateRes.ok) {
    throw new Error('Failed to update defect');
  }
}

/**
 * Adds an additional location photo to a defect
 * @param defectId - The defect ID
 * @param inspectionId - The inspection ID
 * @param photo - The photo object with url, location, and isThreeSixty
 * @returns Promise that resolves when update is complete
 */
export async function addAdditionalLocationPhoto(
  defectId: string,
  inspectionId: string,
  photo: { url: string; location: string; isThreeSixty: boolean }
): Promise<void> {
  const defect = await fetchDefectById(inspectionId, defectId);
  
  const additionalImages = defect.additional_images || [];
  additionalImages.push(photo);
  
  const updateRes = await fetch(`/api/defects/${defectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inspection_id: defect.inspection_id,
      additional_images: additionalImages
    })
  });
  
  if (!updateRes.ok) {
    throw new Error('Failed to update defect');
  }
}

/**
 * Updates an existing additional location photo
 * @param defectId - The defect ID
 * @param inspectionId - The inspection ID
 * @param editIndex - The index of the photo to update
 * @param photo - The updated photo object with url and optional location
 * @returns Promise with oldUrl of the updated photo
 */
export async function updateAdditionalLocationPhoto(
  defectId: string,
  inspectionId: string,
  editIndex: number,
  photo: { url: string; location?: string }
): Promise<{ oldUrl: string }> {
  const defect = await fetchDefectById(inspectionId, defectId);
  
  const photos = defect.additional_images || [];
  
  if (!photos[editIndex]) {
    throw new Error('Invalid photo index');
  }
  
  const oldUrl = photos[editIndex].url;
  
  const updatedImages = photos.map((p: any, i: number) => 
    i === editIndex ? { 
      ...p, 
      url: photo.url,
      location: photo.location || p.location // Use new location if provided, otherwise keep existing
    } : p
  );
  
  const updateRes = await fetch(`/api/defects/${defectId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      inspection_id: defect.inspection_id,
      additional_images: updatedImages,
    })
  });
  
  if (!updateRes.ok) {
    throw new Error('Failed to update defect');
  }
  
  return { oldUrl };
}
