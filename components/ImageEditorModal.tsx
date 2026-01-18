"use client";

import { useState, useRef, useEffect } from 'react';
import ImageEditor from './ImageEditor';
import { toast } from 'sonner';
import { useSpeechToText } from '@/src/lib/useSpeechToText';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Hardcoded dropdown data
const SECTIONS = [
  'AC / Cooling',
  'Built-In Appliances',
  'Electrical',
  'Exterior',
  'Fireplace / Chimney',
  'Foundation & Structure',
  'Furnace / Heater',
  'Grounds',
  'Insulation & Ventilation',
  'Interior',
  'Plumbing',
  'Roof',
  'Swimming Pool & Spa',
  'Verified Functionality'
];

const SUBSECTIONS: { [key: string]: string[] } = {
  'Grounds': ['Vegetation, Grading, & Drainage', 'Sidewalks, Porches, Driveways'],
  'Foundation & Structure': ['Foundation', 'Crawlspace', 'Floor Structure', 'Wall Structure', 'Ceiling Structure'],
  'Roof': ['Coverings', 'Flashing & Seals', 'Roof Penetrations', 'Roof Structure & Attic', 'Gutters'],
  'Exterior': ['Exterior Doors', 'Exterior Windows', 'Siding, Flashing, & Trim', 'Brick/Stone Veneer', 'Vinyl Siding', 'Soffit & Fascia', 'Wall Penetrations', 'Doorbell', 'Exterior Support Columns', 'Steps, Stairways, & Railings'],
  'Fireplace / Chimney': ['Fireplace', 'Chimney', 'Flue'],
  'Interior': ['Doors', 'Windows', 'Floors', 'Walls', 'Ceilings', 'Countertops & Cabinets', 'Trim', 'Steps, Staircase, & Railings'],
  'Insulation & Ventilation': ['Attic Access', 'Insulation', 'Vapor Barrier', 'Ventilation & Exhaust'],
  'AC / Cooling': ['Air Conditioning', 'Thermostats', 'Distribution System'],
  'Furnace / Heater': ['Forced Air Furnace'],
  'Electrical': ['Sub Panel', 'Service Panel', 'Branch Wiring & Breakers', 'Exterior Lighting', 'Fixtures, Fans, Switches, & Receptacles', 'GFCI & AFCI', '240 Volt Receptacle', 'Smoke / Carbon Monoxide Alarms', 'Service Entrance'],
  'Plumbing': ['Water Heater', 'Drain, Waste, & Vents', 'Water Supply', 'Water Spigot', 'Gas Supply', 'Vents & Flues', 'Fixtures,Sinks, Tubs, & Toilets'],
  'Built-In Appliances': ['Refrigerator', 'Dishwasher', 'Garbage Disposal', 'Microwave', 'Range Hood', 'Range, Oven & Cooktop'],
  'Swimming Pool & Spa': ['Equipment', 'Electrical', 'Safety Devices', 'Coping & Decking', 'Vessel Surface', 'Drains', 'Control Valves', 'Filter', 'Pool Plumbing', 'Pumps', 'Spa Controls & Equipment', 'Heating', 'Diving Board & Slide'],
  'Verified Functionality': ['AC Temperature Differential', 'Furnace Output Temperature', 'Oven Operation Temperature', 'Water Heater Output Temperature']
};

const LOCATIONS = [
  'Front of House',
  'Back of House',
  'Left Side of House',
  'Right Side of House',
  'Garage',
  'Attic',
  'Basement',
  'Kitchen',
  'Living Room',
  'Master Bedroom',
  'Bathroom',
  'Exterior',
  'Roof',
  'Driveway',
  'Yard'
];

interface ImageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'defect-main' | 'additional-location' | 'edit-additional' | 'annotation';
  inspectionId: string;
  imageUrl?: string;
  defectId?: string;
  editIndex?: number;
  checklistId?: string;
  templateId?: string;
  sectionId?: string;
  subsectionId?: string;
  onSave?: (result: any) => void;
  preloadedAnnotations?: any[];
  originalImageUrl?: string;
}

export default function ImageEditorModal({
  isOpen,
  onClose,
  mode,
  inspectionId,
  imageUrl,
  defectId,
  editIndex,
  checklistId,
  templateId,
  sectionId,
  subsectionId,
  onSave,
  preloadedAnnotations: propAnnotations,
  originalImageUrl: propOriginalImageUrl,
}: ImageEditorModalProps) {
  const isAdditionalLocationMode = mode === 'additional-location' && defectId;
  const isEditAdditionalMode = mode === 'edit-additional' && defectId && editIndex !== undefined;
  const isDefectMainMode = mode === 'defect-main' && defectId;
  const isAnnotationMode = mode === 'annotation' && checklistId;
  
  const [description, setDescription] = useState('');
  
  // Speech-to-text hook
  const {
    isRecording,
    startRecording,
    stopRecording,
    error: speechError,
  } = useSpeechToText(
    (transcript: string) => {
      setDescription((prev) => {
        return prev ? `${prev} ${transcript}` : transcript;
      });
    }
  );

  useEffect(() => {
    if (speechError) {
      toast.error(speechError);
    }
  }, [speechError]);

  const [activeMode, setActiveMode] = useState<'none' | 'crop' | 'arrow' | 'circle' | 'square'>('none');
  const [hasCropFrame, setHasCropFrame] = useState(false);
  const [showDrawingDropdown, setShowDrawingDropdown] = useState(false);
  const [showCircleDropdown, setShowCircleDropdown] = useState(false);
  const [showSquareDropdown, setShowSquareDropdown] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [selectedLocation2, setSelectedLocation2] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const drawingDropdownRef = useRef<HTMLDivElement>(null);
  const circleDropdownRef = useRef<HTMLDivElement>(null);
  const squareDropdownRef = useRef<HTMLDivElement>(null);
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const [editedFile, setEditedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedColor, setSelectedColor] = useState('#d63636');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isThreeSixty, setIsThreeSixty] = useState(false);
  const [preloadedAnnotations, setPreloadedAnnotations] = useState<any[] | undefined>(undefined);
  const [currentAnnotations, setCurrentAnnotations] = useState<any[]>([]);

  const [inspectionState, setInspectionState] = useState<string>('');
  const [inspectionCity, setInspectionCity] = useState<string>('');
  const [inspectionZipCode, setInspectionZipCode] = useState<string>('');

  // Fetch inspection data to get location info for classify API
  useEffect(() => {
    if (!isOpen || !inspectionId) return;
    
    const fetchInspection = async () => {
      try {
        const response = await fetch(`/api/inspections/${inspectionId}`);
        if (response.ok) {
          const inspection = await response.json();
          if (inspection && inspection.location) {
            setInspectionState(inspection.location.state || '');
            setInspectionCity(inspection.location.city || '');
            setInspectionZipCode(inspection.location.zip || '');
          }
        }
      } catch (error) {
        console.error('Failed to fetch inspection:', error);
      }
    };
    fetchInspection();
  }, [isOpen, inspectionId]);

  // Fetch parent defect info when in additional location mode
  useEffect(() => {
    if (!isOpen || !(isAdditionalLocationMode || isEditAdditionalMode) || !defectId || !inspectionId) return;
    
    const fetchParentDefect = async () => {
      try {
        const response = await fetch(`/api/defects/${inspectionId}`);
        if (response.ok) {
          const defects = await response.json();
          const parentDefect = defects.find((d: any) => d._id === defectId);
          if (parentDefect) {
            setSelectedLocation(parentDefect.section || '');
            setSelectedSubLocation(parentDefect.subsection || '');
            if (isEditAdditionalMode && Array.isArray(parentDefect.additional_images) && editIndex !== undefined) {
              const target = parentDefect.additional_images[editIndex];
              if (target && target.location) {
                setSelectedLocation2(target.location);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch parent defect:', error);
      }
    };
    fetchParentDefect();
  }, [isOpen, isAdditionalLocationMode, isEditAdditionalMode, defectId, inspectionId, editIndex]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (drawingDropdownRef.current && !drawingDropdownRef.current.contains(event.target as Node)) {
        setShowDrawingDropdown(false);
      }
      if (circleDropdownRef.current && !circleDropdownRef.current.contains(event.target as Node)) {
        setShowCircleDropdown(false);
      }
      if (squareDropdownRef.current && !squareDropdownRef.current.contains(event.target as Node)) {
        setShowSquareDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Load existing image from URL if provided
  useEffect(() => {
    if (!isOpen || !imageUrl) return;
    
    const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(imageUrl)}`;
    
    fetch(proxyUrl)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
        }
        return res.blob();
      })
      .then(blob => {
        const objectUrl = URL.createObjectURL(blob);
  
        const img = new Image();
        img.onload = () => {
          setCurrentImage(img);
          
          const file = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });
          setEditedFile(file);
        };
        img.onerror = (err) => {
          toast.error('Failed to load image from object URL. Please try again.');
        };
        img.src = objectUrl;
      })
      .catch(err => {
        toast.error(`Failed to load image: ${err.message}. Please try again.`);
      });
  }, [isOpen, imageUrl]);

  // Load annotations for defect-main mode
  useEffect(() => {
    if (!isOpen) return;
    
    if (isDefectMainMode && propAnnotations) {
      setPreloadedAnnotations(propAnnotations);
    } else if (isDefectMainMode) {
      setPreloadedAnnotations([]);
    }
  }, [isOpen, isDefectMainMode, propAnnotations]);

  // Cleanup all state when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Reset all state when modal closes
      setCurrentImage(null);
      setEditedFile(null);
      setOriginalFile(null);
      setPreloadedAnnotations(undefined);
      setCurrentAnnotations([]);
      setDescription('');
      setSelectedLocation('');
      setSelectedSubLocation('');
      setSelectedLocation2('');
      setVideoFile(null);
      setVideoSrc(null);
      setThumbnail(null);
      setIsThreeSixty(false);
      setActiveMode('none');
      setHasCropFrame(false);
      setShowDrawingDropdown(false);
      setShowCircleDropdown(false);
      setShowSquareDropdown(false);
    }
  }, [isOpen]);

  // Actions for editing images
  const handleActionClick = (mode: 'none' | 'crop' | 'arrow' | 'circle' | 'square') => {
    if (mode === 'arrow') {
      setShowDrawingDropdown(!showDrawingDropdown);
      setShowCircleDropdown(false);
      setShowSquareDropdown(false);
      setActiveMode(activeMode === 'arrow' ? 'none' : 'arrow');
    } else if (mode === 'circle') {
      setShowCircleDropdown(!showCircleDropdown);
      setShowDrawingDropdown(false);
      setShowSquareDropdown(false);
      setActiveMode(activeMode === 'circle' ? 'none' : 'circle');
    } else if (mode === 'square') {
      setShowSquareDropdown(!showSquareDropdown);
      setShowCircleDropdown(false);
      setShowDrawingDropdown(false);
      setActiveMode(activeMode === 'square' ? 'none' : 'square');
    } else {
      setShowDrawingDropdown(false);
      setShowCircleDropdown(false);
      setShowSquareDropdown(false);
      setActiveMode(activeMode === mode ? 'none' : mode);
    }
  };

  const handleUndo = () => {
    const event = new CustomEvent('undoAction');
    window.dispatchEvent(event);
  };

  const handleRedo = () => {
    const event = new CustomEvent('redoAction');
    window.dispatchEvent(event);
  };

  const handleRotate = () => {
    const event = new CustomEvent('rotateImage');
    window.dispatchEvent(event);
  };

  const handleDeleteAnnotation = () => {
    const event = new CustomEvent('deleteSelectedAnnotation');
    window.dispatchEvent(event);
  };

  const handleCropStateChange = (hasFrame: boolean) => {
    setHasCropFrame(hasFrame);
  };

  const handleSubmit = async () => {
    // Special handling for additional location photos
    if (isAdditionalLocationMode && defectId) {
      if (!editedFile) {
        toast.error('Please upload and edit an image before submitting.');
        return;
      }

      if (!selectedLocation2) {
        toast.error('Please select a location for this photo.');
        return;
      }

      setIsSubmitting(true);

      try {
        const presignedRes = await fetch(
          `/api/r2api?action=presigned&fileName=${encodeURIComponent(editedFile.name)}&contentType=${encodeURIComponent(editedFile.type)}`
        );
        if (!presignedRes.ok) {
          const t = await presignedRes.text();
          throw new Error(`Failed to get presigned URL: ${t}`);
        }
        const { uploadUrl, publicUrl } = await presignedRes.json();
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': editedFile.type },
          body: editedFile,
        });
        if (!putRes.ok) {
          const t = await putRes.text();
          throw new Error(`Failed to upload image to R2: ${putRes.status} ${t}`);
        }

        const defectRes = await fetch(`/api/defects/${inspectionId}`);
        if (!defectRes.ok) {
          throw new Error('Failed to fetch defect data');
        }

        const defects = await defectRes.json();
        const currentDefect = defects.find((d: any) => d._id === defectId);
        
        if (!currentDefect) {
          throw new Error('Defect not found');
        }

        const additionalImages = currentDefect.additional_images || [];
        additionalImages.push({
          url: publicUrl,
          location: selectedLocation2,
          isThreeSixty
        });

        const updateRes = await fetch(`/api/defects/${defectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inspection_id: currentDefect.inspection_id,
            additional_images: additionalImages
          })
        });

        if (!updateRes.ok) {
          throw new Error('Failed to update defect');
        }

        toast.success('Location photo added successfully');
        onSave?.({ defectId, photo: { url: publicUrl, location: selectedLocation2, isThreeSixty } });
        onClose();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        toast.error(`Failed to add location photo: ${errorMessage}`);
      } finally {
        setIsSubmitting(false);
      }
      
      return;
    }

    // Special handling for editing main defect image
    if (isDefectMainMode && defectId) {
      if (!editedFile) {
        toast.error('Please upload and edit an image before submitting.');
        return;
      }

      setIsSubmitting(true);

      try {
        const presignedRes = await fetch(
          `/api/r2api?action=presigned&fileName=${encodeURIComponent(editedFile.name)}&contentType=${encodeURIComponent(editedFile.type)}`
        );
        if (!presignedRes.ok) {
          const t = await presignedRes.text();
          throw new Error(`Failed to get presigned URL: ${t}`);
        }
        const { uploadUrl, publicUrl } = await presignedRes.json();
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': editedFile.type },
          body: editedFile,
        });
        if (!putRes.ok) {
          const t = await putRes.text();
          throw new Error(`Failed to upload image to R2: ${putRes.status} ${t}`);
        }

        const defectRes = await fetch(`/api/defects/${inspectionId}`);
        if (!defectRes.ok) {
          throw new Error('Failed to fetch defect data');
        }

        const defects = await defectRes.json();
        const currentDefect = defects.find((d: any) => d._id === defectId);

        if (!currentDefect) {
          throw new Error('Defect not found');
        }

        const updatePayload = {
          inspection_id: currentDefect.inspection_id,
          image: publicUrl,
          annotations: currentAnnotations,
          originalImage: propOriginalImageUrl || currentDefect.originalImage || publicUrl
        };

        const updateRes = await fetch(`/api/defects/${defectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });

        if (!updateRes.ok) {
          throw new Error('Failed to update defect');
        }

        toast.success('Defect image updated successfully');
        onSave?.({ defectId, newImageUrl: publicUrl, annotations: currentAnnotations });
        onClose();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        toast.error(`Failed to update defect image: ${errorMessage}`);
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    // Special handling for editing an existing additional location photo
    if (isEditAdditionalMode && defectId && editIndex !== undefined) {
      if (!editedFile) {
        toast.error('Please upload and edit an image before submitting.');
        return;
      }

      setIsSubmitting(true);

      try {
        const presignedRes = await fetch(
          `/api/r2api?action=presigned&fileName=${encodeURIComponent(editedFile.name)}&contentType=${encodeURIComponent(editedFile.type)}`
        );
        if (!presignedRes.ok) {
          const t = await presignedRes.text();
          throw new Error(`Failed to get presigned URL: ${t}`);
        }
        const { uploadUrl, publicUrl } = await presignedRes.json();
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': editedFile.type },
          body: editedFile,
        });
        if (!putRes.ok) {
          const t = await putRes.text();
          throw new Error(`Failed to upload image to R2: ${putRes.status} ${t}`);
        }

        const defectRes = await fetch(`/api/defects/${inspectionId}`);
        if (!defectRes.ok) {
          throw new Error('Failed to fetch defect data');
        }
        const defects = await defectRes.json();
        const currentDefect = defects.find((d: any) => d._id === defectId);
        if (!currentDefect) throw new Error('Defect not found');

        const photos = currentDefect.additional_images || [];
        const oldUrl: string | undefined = photos[editIndex]?.url;
        if (!photos[editIndex]) {
          throw new Error('Invalid photo index');
        }

        const updatedImages = photos.map((p: any, i: number) => 
          i === editIndex ? { 
            ...p, 
            url: publicUrl,
            location: selectedLocation2 || p.location // Use new location if selected, otherwise keep existing
          } : p
        );

        const updateRes = await fetch(`/api/defects/${defectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inspection_id: currentDefect.inspection_id,
            additional_images: updatedImages,
          })
        });
        if (!updateRes.ok) throw new Error('Failed to update defect');

        toast.success('Photo updated successfully');
        onSave?.({ defectId, index: editIndex, oldUrl, newUrl: publicUrl });
        onClose();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        toast.error(`Failed to save edited photo: ${errorMessage}`);
      } finally {
        setIsSubmitting(false);
      }

      return;
    }

    // Special handling for information block annotation
    if (isAnnotationMode && checklistId) {
      if (!editedFile) {
        toast.error('Please make some changes to the image before saving (draw arrows, circles, etc.).');
        return;
      }

      setIsSubmitting(true);

      try {
        const presignedRes = await fetch(
          `/api/r2api?action=presigned&fileName=${encodeURIComponent(editedFile.name)}&contentType=${encodeURIComponent(editedFile.type)}`
        );
        if (!presignedRes.ok) {
          const t = await presignedRes.text();
          throw new Error(`Failed to get presigned URL: ${t}`);
        }
        const { uploadUrl, publicUrl } = await presignedRes.json();
        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': editedFile.type },
          body: editedFile,
        });
        if (!putRes.ok) {
          const t = await putRes.text();
          throw new Error(`Failed to upload annotated image to R2: ${putRes.status} ${t}`);
        }

        toast.success('Annotation saved successfully');
        onSave?.({
          checklistId,
          imageUrl: publicUrl,
          originalImageUrl: propOriginalImageUrl || imageUrl || publicUrl,
          annotations: currentAnnotations,
        });
        onClose();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        toast.error(`Failed to save annotated image: ${errorMessage}`);
      } finally {
        setIsSubmitting(false);
      }
      
      return;
    }

    // Original defect analysis flow (create mode)
    if (mode === 'create') {
      if (!selectedLocation || !selectedSubLocation || !selectedLocation2) {
        toast.error('Please select all required location fields.');
        return;
      }
      
      const selectedSection = selectedLocation;
      const selectedSubsection = selectedSubLocation;
      const selectedLocationValue = selectedLocation2;
    
      setIsSubmitting(true);
    
      try {
        if (!editedFile) {
          throw new Error('No edited image to upload');
        }

        // Upload original image (without annotations) if available and annotations exist
        let originalImageUrl: string | null = null;
        if (originalFile && currentAnnotations.length > 0) {
          const presignedOrigRes = await fetch(
            `/api/r2api?action=presigned&fileName=original-${encodeURIComponent(originalFile.name)}&contentType=${encodeURIComponent(originalFile.type)}`
          );
          if (!presignedOrigRes.ok) {
            const t = await presignedOrigRes.text();
            throw new Error(`Failed to get presigned URL for original image: ${t}`);
          }
          const { uploadUrl: origUploadUrl, publicUrl: origPublicUrl } = await presignedOrigRes.json();
          const putOrig = await fetch(origUploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': originalFile.type },
            body: originalFile,
          });
          if (!putOrig.ok) {
            const t = await putOrig.text();
            throw new Error(`Failed to upload original image to R2: ${putOrig.status} ${t}`);
          }
          originalImageUrl = origPublicUrl;
        }

        const presignedImgRes = await fetch(
          `/api/r2api?action=presigned&fileName=${encodeURIComponent(editedFile.name)}&contentType=${encodeURIComponent(editedFile.type)}`
        );
        if (!presignedImgRes.ok) {
          const t = await presignedImgRes.text();
          throw new Error(`Failed to get presigned URL for image: ${t}`);
        }
        const { uploadUrl: imgUploadUrl, publicUrl: imagePublicUrl } = await presignedImgRes.json();
        const putImg = await fetch(imgUploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': editedFile.type },
          body: editedFile,
        });
        if (!putImg.ok) {
          const t = await putImg.text();
          throw new Error(`Failed to upload image to R2: ${putImg.status} ${t}`);
        }

        // Optional video upload via presigned URL
        let videoPublicUrl: string | null = null;
        let thumbnailPublicUrl: string | null = null;
        let finalType: 'image' | 'video' = 'image';
        if (videoFile) {
          finalType = 'video';

          const presignedVidRes = await fetch(
            `/api/r2api?action=presigned&fileName=${encodeURIComponent(videoFile.name)}&contentType=${encodeURIComponent(videoFile.type)}`
          );
          if (!presignedVidRes.ok) {
            const t = await presignedVidRes.text();
            throw new Error(`Failed to get presigned URL for video: ${t}`);
          }
          const { uploadUrl: vidUploadUrl, publicUrl: vidPublicUrl } = await presignedVidRes.json();
          const putVid = await fetch(vidUploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': videoFile.type },
            body: videoFile,
          });
          if (!putVid.ok) {
            const t = await putVid.text();
            throw new Error(`Failed to upload video to R2: ${putVid.status} ${t}`);
          }
          videoPublicUrl = vidPublicUrl;

          if (thumbnail && thumbnail.startsWith('data:')) {
            const mimeMatch = thumbnail.match(/^data:(.+);base64,(.+)$/);
            const thumbMime = mimeMatch ? mimeMatch[1] : 'image/png';
            const b64 = mimeMatch ? mimeMatch[2] : '';
            const thumbBuffer = b64 ? Uint8Array.from(atob(b64), c => c.charCodeAt(0)) : undefined;
            if (thumbBuffer) {
              const thumbFile = new Blob([thumbBuffer], { type: thumbMime });
              const fileName = `thumbnail-${Date.now()}.png`;
              const presignedThumbRes = await fetch(
                `/api/r2api?action=presigned&fileName=${encodeURIComponent(fileName)}&contentType=${encodeURIComponent(thumbMime)}`
              );
              if (!presignedThumbRes.ok) {
                const t = await presignedThumbRes.text();
                throw new Error(`Failed to get presigned URL for thumbnail: ${t}`);
              }
              const { uploadUrl: thumbUploadUrl, publicUrl: thumbPublicUrl } = await presignedThumbRes.json();
              const putThumb = await fetch(thumbUploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': thumbMime },
                body: thumbFile,
              });
              if (!putThumb.ok) {
                const t = await putThumb.text();
                throw new Error(`Failed to upload thumbnail to R2: ${putThumb.status} ${t}`);
              }
              thumbnailPublicUrl = thumbPublicUrl;
            }
          }
        }

        const response = await fetch('/api/llm/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: imagePublicUrl,
            description,
            location: selectedLocationValue,
            inspectionId: inspectionId,
            section: selectedSection,
            subSection: selectedSubsection,
            templateId,
            sectionId,
            subsectionId,
            selectedColor,
            isThreeSixty,
            type: finalType,
            videoUrl: videoPublicUrl,
            thumbnailUrl: thumbnailPublicUrl,
            annotations: currentAnnotations,
            originalImage: originalImageUrl || imagePublicUrl,
            state: inspectionState,
            city: inspectionCity,
            zipCode: inspectionZipCode,
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          toast.error(`Analysis request failed: ${errorText}`);
          return;
        }
        
        const result = await response.json();
        toast.success('You can see the details in the report once it is ready');
        
        if (response.status === 202) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else if (!result.analysisId) {
          toast.error('Analysis did not start correctly. Please try again.');
          return;
        }

        onSave?.({ analysisId: result.analysisId, imageUrl: imagePublicUrl });
        onClose();
      } catch (error: any) {
        toast.error('Unexpected error occurred while submitting. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  // Color options for all tools (arrow, circle, square)
  const toolColors = ['#d63636', '#FF8C00', '#0066CC', '#4CBB17', '#800080'];

  // Function to handle color selection for all tools
  const handleColorSelection = (color: string) => {
    setSelectedColor(color);
    
    const arrowEvent = new CustomEvent('setArrowColor', { detail: color });
    const circleEvent = new CustomEvent('setCircleColor', { detail: color });
    const squareEvent = new CustomEvent('setSquareColor', { detail: color });
    
    window.dispatchEvent(arrowEvent);
    window.dispatchEvent(circleEvent);
    window.dispatchEvent(squareEvent);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative w-full max-w-7xl max-h-[95vh] bg-white rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">
            {mode === 'annotation' ? 'Annotate Image' :
             mode === 'defect-main' ? 'Edit Defect Image' :
             mode === 'additional-location' ? 'Add Location Photo' :
             mode === 'edit-additional' ? 'Edit Location Photo' :
             'Create Defect'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isSubmitting ? (
            <div className="flex justify-center items-center h-full">
              <div className="w-12 h-12 border-[5px] border-gray-200 border-t-[#8230c9] rounded-full animate-spin" />
            </div>
          ) : (
            <div className="app-container">
              {/* Action Options Bar */}
              <div className="action-bar mb-4">
                {isAnnotationMode && (
                  <button 
                    className="action-btn done-btn bg-emerald-600 text-white px-5 py-2 font-semibold text-sm ml-auto mr-2.5"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    <i className="fas fa-check mr-2"></i>
                    Done
                  </button>
                )}

                <button className="action-btn undo-btn" onClick={handleUndo}>
                  <i className="fas fa-undo"></i>
                </button>
                <button className="action-btn redo-btn" onClick={handleRedo}>
                  <i className="fas fa-redo"></i>
                </button>

                <button className="action-btn rotate-btn" onClick={handleRotate}>
                  <i className="fas fa-sync-alt"></i>
                </button>
                
                <button 
                  className={`action-btn crop-btn ${activeMode === 'crop' ? 'active' : ''}`}
                  onClick={() => {
                    if (activeMode === 'crop' && hasCropFrame) {
                      const event = new CustomEvent('applyCrop');
                      window.dispatchEvent(event);
                    } else {
                      handleActionClick('crop');
                    }
                  }}
                >
                  <i className="fas fa-crop-alt"></i>
                  <span className="btn-text">
                    {activeMode === 'crop' && hasCropFrame ? 'Apply' : ''}
                  </span>
                </button>
                
                {/* Arrow button with dropdown */}
                <div className="arrow-button-container" ref={drawingDropdownRef}>
                  <button 
                    className={`action-btn arrow-btn ${activeMode === 'arrow' ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActionClick('arrow');
                    }}
                  >
                    <i className="fas fa-arrow-right"></i>
                  </button>
                  
                  {showDrawingDropdown && (
                    <div className="arrow-dropdown">
                      <div className="arrow-color-options">
                        {toolColors.map(color => (
                          <div 
                            key={color}
                            className={`arrow-color-option ${selectedColor === color ? 'selected' : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => {
                              handleColorSelection(color);
                              setShowDrawingDropdown(false);
                            }}
                            title={`Select ${color} for all tools`}
                          ></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Circle button with dropdown */}
                <div className="circle-button-container" ref={circleDropdownRef}>
                  <button 
                    className={`action-btn circle-btn ${activeMode === 'circle' ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActionClick('circle');
                    }}
                  >
                    <i className="far fa-circle thick-circle"></i>
                  </button>
                  
                  {showCircleDropdown && (
                    <div className="circle-dropdown">
                      <div className="circle-color-options">
                        {toolColors.map(color => (
                          <div 
                            key={color}
                            className={`circle-color-option ${selectedColor === color ? 'selected' : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => {
                              handleColorSelection(color);
                              setShowCircleDropdown(false);
                            }}
                            title={`Select ${color} for all tools`}
                          ></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Square button with dropdown */}
                <div className="square-button-container" ref={squareDropdownRef}>
                  <button 
                    className={`action-btn square-btn ${activeMode === 'square' ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActionClick('square');
                    }}
                  >
                    <i className="far fa-square thick-square"></i>
                  </button>
                  
                  {showSquareDropdown && (
                    <div className="square-dropdown">
                      <div className="square-color-options">
                        {toolColors.map(color => (
                          <div 
                            key={color}
                            className={`square-color-option ${selectedColor === color ? 'selected' : ''}`}
                            style={{ backgroundColor: color }}
                            onClick={() => {
                              handleColorSelection(color);
                              setShowSquareDropdown(false);
                            }}
                            title={`Select ${color} for all tools`}
                          ></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  className="action-btn delete-btn"
                  onClick={handleDeleteAnnotation}
                  title="Delete selected annotation"
                >
                  <i className="fas fa-trash"></i>
                </button>
              </div>

              {/* Image Upload Area */}
              <div className="image-upload-area mb-4">
                <ImageEditor
                  activeMode={activeMode}
                  onCropStateChange={handleCropStateChange}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  onImageChange={setCurrentImage}
                  onEditedFile={setEditedFile}
                  onOriginalFileSet={setOriginalFile}
                  videoRef={videoRef}
                  setIsCameraOpen={setIsCameraOpen}
                  isCameraOpen={isCameraOpen}
                  setVideoFile={setVideoFile}
                  setThumbnail={setThumbnail}
                  setVideoSrc={setVideoSrc}
                  preloadedImage={currentImage}
                  preloadedFile={editedFile}
                  preloadedAnnotations={preloadedAnnotations}
                  onAnnotationsChange={setCurrentAnnotations}
                />
              </div>

              {/* Description Box - Only show for defect workflow (but not in defect-main annotate mode) */}
              {!isAnnotationMode && !isDefectMainMode && !isAdditionalLocationMode && !isEditAdditionalMode && (
                <>
                  <p className="mb-2 px-3 py-2 rounded bg-blue-50 border-l-4 border-blue-400 text-blue-800 text-sm font-medium shadow-sm">
                    For optimal results, speak clearly and pause between lines. Your dictation will automatically appear in the description below.
                  </p>
                  <div className="description-box mb-4">
                    <div className="relative">
                      <textarea
                        placeholder="Describe your edited image here..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="pr-12 w-full p-3 border rounded-lg"
                        rows={4}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (isRecording) {
                            stopRecording();
                            toast.success('Recording stopped');
                          } else {
                            startRecording();
                            toast.info('Recording started... Speak now');
                          }
                        }}
                        className={`absolute right-3 top-3 p-2 rounded-full transition-all duration-300 ${
                          isRecording
                            ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50'
                            : 'bg-gradient-to-br from-[rgb(75,108,183)] to-[rgb(106,17,203)] text-white hover:from-[rgb(106,17,203)] hover:to-[rgb(75,108,183)] shadow-md'
                        }`}
                        title={isRecording ? 'Stop recording' : 'Start voice recording'}
                        disabled={!!speechError}
                      >
                        <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
                      </button>
                    </div>

                    {/* 360° Photo Checkbox */}
                    <div className="flex items-center gap-2.5 mt-3 p-3 bg-gradient-to-br from-[rgba(75,108,183,0.1)] to-[rgba(106,17,203,0.1)] rounded-lg border border-[rgba(75,108,183,0.2)]">
                      <input
                        type="checkbox"
                        id="threeSixtyCheckbox"
                        checked={isThreeSixty}
                        onChange={(e) => setIsThreeSixty(e.target.checked)}
                        className="w-[18px] h-[18px] cursor-pointer accent-[#4b6cb7]"
                      />
                      <label
                        htmlFor="threeSixtyCheckbox"
                        className="text-[15px] font-medium text-slate-700 cursor-pointer select-none flex items-center gap-1.5"
                      >
                        <i className="fas fa-sync-alt text-[#4b6cb7]"></i>
                        This is a 360° photo
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* Submit Section */}
              {(!isAnnotationMode) || isAdditionalLocationMode || isDefectMainMode ? (
                <div className="submit-section">
                  <div className="submit-controls flex flex-wrap gap-4 items-center">
                    {/* Section and Subsection - Hide in additional location mode and defect-main annotate mode */}
                    {!isAdditionalLocationMode && !isDefectMainMode && !isEditAdditionalMode && (
                      <>
                        {/* Section Select */}
                        <div className="w-[300px]">
                          <Select
                            value={selectedLocation}
                            onValueChange={(value) => {
                              setSelectedLocation(value);
                              setSelectedSubLocation(''); // Reset subsection when section changes
                            }}
                          >
                            <SelectTrigger className="h-[60px] bg-gradient-to-br from-[rgb(75,108,183)] to-[rgb(106,17,203)] text-white border-white/10">
                              <div className="flex items-center gap-2">
                                <i className="fas fa-map-marker-alt"></i>
                                <SelectValue placeholder="Section" />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {SECTIONS.map((section) => (
                                <SelectItem key={section} value={section}>
                                  {section}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Subsection Select */}
                        <div className="w-[300px]">
                          <Select
                            value={selectedSubLocation}
                            onValueChange={setSelectedSubLocation}
                            disabled={!selectedLocation}
                          >
                            <SelectTrigger className="h-[60px] bg-gradient-to-br from-[rgb(75,108,183)] to-[rgb(106,17,203)] text-white border-white/10 disabled:opacity-50">
                              <div className="flex items-center gap-2">
                                <i className="fas fa-layer-group"></i>
                                <SelectValue placeholder="Sub Section" />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {selectedLocation && SUBSECTIONS[selectedLocation]?.map((subsection) => (
                                <SelectItem key={subsection} value={subsection}>
                                  {subsection}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}

                    {/* Location Select - Hide in defect-main annotate mode */}
                    {!isDefectMainMode && (
                      <div className="w-[300px]">
                        <Select
                          value={selectedLocation2}
                          onValueChange={setSelectedLocation2}
                        >
                          <SelectTrigger className="h-[60px] bg-gradient-to-br from-[rgb(75,108,183)] to-[rgb(106,17,203)] text-white border-white/10">
                            <div className="flex items-center gap-2">
                              <i className="fas fa-map-marker-alt"></i>
                              <SelectValue placeholder="Location" />
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            {LOCATIONS.map((location) => (
                              <SelectItem key={location} value={location}>
                                {location}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Submit Button - Change text based on mode */}
                    <button 
                      className="submit-btn bg-gradient-to-br from-[rgb(75,108,183)] to-[rgb(106,17,203)] text-white px-8 py-4 rounded-xl text-base font-semibold cursor-pointer transition-all duration-300 shadow-[0_4px_20px_rgba(75,108,183,0.3)] hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(75,108,183,0.4)] hover:bg-gradient-to-br hover:from-[rgb(106,17,203)] hover:to-[rgb(75,108,183)] active:-translate-y-px active:shadow-[0_4px_20px_rgba(75,108,183,0.3)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" 
                      onClick={handleSubmit} 
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          {isDefectMainMode ? 'Saving...' : isAdditionalLocationMode ? 'Adding Photo...' : isEditAdditionalMode ? 'Saving...' : 'Processing...'}
                        </>
                      ) : (
                        <>
                          {mode === 'create' && <i className="fas fa-plus-circle"></i>}
                          {isDefectMainMode ? 'Save Changes' : isAdditionalLocationMode ? 'Add Photo' : isEditAdditionalMode ? 'Save Photo' : 'Create Defect'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
