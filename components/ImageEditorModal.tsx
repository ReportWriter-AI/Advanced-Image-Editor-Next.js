"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import ImageEditor from './ImageEditor';
import { toast } from 'sonner';
import { useSpeechToText } from '@/src/lib/useSpeechToText';
import { CreatableConcatenatedInput } from '@/components/ui/creatable-concatenated-input';import { uploadFileToR2, uploadThumbnailToR2, uploadOriginalImageToR2 } from './utils/fileUpload';
import { updateDefectImage, addAdditionalLocationPhoto, updateAdditionalLocationPhoto } from './utils/defectOperations';
import ColorDropdown from './ColorDropdown';
import { useInspectionTemplateSectionsAndSubsectionsQuery } from '@/components/api/queries/inspectionTemplates';
import { useReusableDropdownsQuery } from '@/components/api/queries/reusableDropdowns';

interface ImageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'defect-main' | 'additional-location' | 'edit-additional' | 'annotation' | 'merged-defect';
  inspectionId?: string;
  imageUrl?: string;
  defectId?: string;
  editIndex?: number;
  checklistId?: string;
  templateId?: string;
  sectionId?: string;
  subsectionId?: string;
  sectionName?: string;
  subsectionName?: string;
  onSave?: (result: any) => void;
  preloadedAnnotations?: any[];
  originalImageUrl?: string;
  isPage?: boolean;
  location?: string;
}

 // Color options for all tools (arrow, circle, square)
export const toolColors = ['#d63636', '#FF8C00', '#0066CC', '#4CBB17', '#800080'];

export default function ImageEditorModal({
  isOpen,
  onClose,
  mode="create",
  inspectionId = '',
  imageUrl,
  defectId,
  editIndex,
  checklistId,
  templateId,
  sectionId,
  subsectionId,
  sectionName,
  subsectionName,
  onSave,
  preloadedAnnotations: propAnnotations,
  originalImageUrl: propOriginalImageUrl,
  isPage = false,
  location: propLocation,
}: ImageEditorModalProps) {
  // Read URL params when used as a page
  const searchParams = useSearchParams();
  const urlTemplateId = isPage ? searchParams.get('templateId') : null;
  const urlInspectionId = isPage ? searchParams.get('inspectionId') : null;
  
  // Prefer URL params over props, fallback to props if URL params don't exist
  const finalTemplateId = urlTemplateId || templateId;
  const finalInspectionId = urlInspectionId || inspectionId;
  
  const isAdditionalLocationMode = mode === 'additional-location' && defectId;
  const isEditAdditionalMode = mode === 'edit-additional' && defectId && editIndex !== undefined;
  const isDefectMainMode = mode === 'defect-main' && defectId;
  const isAnnotationMode = mode === 'annotation' && checklistId;
  const isMergedDefectMode = mode === 'merged-defect' && defectId && editIndex !== undefined;
  
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

  // Clear image date when modal closes
  useEffect(() => {
    if (!isOpen) {
      setImageDate(null);
    }
  }, [isOpen]);

  const [activeMode, setActiveMode] = useState<'none' | 'crop' | 'arrow' | 'circle' | 'square'>('none');
  const [hasCropFrame, setHasCropFrame] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<'arrow' | 'circle' | 'square' | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>(sectionName || '');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>(subsectionName || '');
  const [selectedLocation2, setSelectedLocation2] = useState<string>(propLocation || '');
  const [locationOptions, setLocationOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const arrowDropdownRef = useRef<HTMLDivElement>(null);
  const circleDropdownRef = useRef<HTMLDivElement>(null);
  const squareDropdownRef = useRef<HTMLDivElement>(null);
  
  // Section and Subsection dropdown state (for isPage mode)
  const [showSectionDropdown, setShowSectionDropdown] = useState(false);
  const [sectionSearch, setSectionSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [showSubsectionDropdown, setShowSubsectionDropdown] = useState(false);
  const [subsectionSearch, setSubsectionSearch] = useState('');
  const [selectedSubsection, setSelectedSubsection] = useState<string>('');
  const [selectedSubsectionId, setSelectedSubsectionId] = useState<string>('');
  const sectionDropdownRef = useRef<HTMLDivElement>(null);
  const subsectionDropdownRef = useRef<HTMLDivElement>(null);
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const [editedFile, setEditedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedColor, setSelectedColor] = useState('#FF8C00');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isThreeSixty, setIsThreeSixty] = useState(false);
  const [preloadedAnnotations, setPreloadedAnnotations] = useState<any[] | undefined>(undefined);
  const [currentAnnotations, setCurrentAnnotations] = useState<any[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [imageDate, setImageDate] = useState<string | null>(null);

  // Callback handler for EXIF date extraction (only store in create mode)
  const handleImageDateExtracted = useCallback((date: string | null) => {
    if (mode === 'create') {
      setImageDate(date);
    }
  }, [mode]);

  const [inspectionState, setInspectionState] = useState<string>('');
  const [inspectionCity, setInspectionCity] = useState<string>('');
  const [inspectionZipCode, setInspectionZipCode] = useState<string>('');

  // Fetch sections and subsections when in page mode
  const { data: sectionsData } = useInspectionTemplateSectionsAndSubsectionsQuery(
    isPage && finalInspectionId ? finalInspectionId : '',
    isPage && finalTemplateId ? finalTemplateId : ''
  );
  const sections = (isPage && sectionsData?.data?.sections) || [];

  // Fetch reusable dropdowns (defaults) when modal opens
  const { data: dropdownsData, isError } = useReusableDropdownsQuery({ enabled: isOpen });

  // Filter sections and subsections
  const filteredSections = sections.filter((section: any) =>
    section.name.toLowerCase().includes(sectionSearch.toLowerCase())
  );

  const selectedSectionData = sections.find((section: any) => section.name === selectedSection);
  const subsectionsForSelectedSection = selectedSectionData?.subsections || [];
  const filteredSubsections = subsectionsForSelectedSection.filter((subsection: any) =>
    subsection.name.toLowerCase().includes(subsectionSearch.toLowerCase())
  );

  // Fetch inspection data to get location info for classify API
  useEffect(() => {
    if (!isOpen || !finalInspectionId) return;
    
    const fetchInspection = async () => {
      try {
        const response = await fetch(`/api/inspections/${finalInspectionId}`);
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
  }, [isOpen, finalInspectionId]);

  // Fetch parent defect info when in additional location mode
  useEffect(() => {
    if (!isOpen || !(isAdditionalLocationMode || isEditAdditionalMode || isMergedDefectMode) || !defectId || !finalInspectionId) return;
    
    const fetchParentDefect = async () => {
      try {
        const response = await fetch(`/api/defects/${finalInspectionId}`);
        if (response.ok) {
          const defects = await response.json();
          const parentDefect = defects.find((d: any) => d._id === defectId);
          if (parentDefect) {
            setSelectedLocation(parentDefect.section || '');
            setSelectedSubLocation(parentDefect.subsection || '');
            if ((isEditAdditionalMode || isMergedDefectMode) && Array.isArray(parentDefect.additional_images) && editIndex !== undefined) {
              const target = parentDefect.additional_images[editIndex];
              if (target) {
                // For merged defects, use 'location' field; for regular, also use 'location'
                const locationValue = target.location || '';
                if (locationValue) {
                  setSelectedLocation2(locationValue);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch parent defect:', error);
      }
    };
    fetchParentDefect();
  }, [isOpen, isAdditionalLocationMode, isEditAdditionalMode, isMergedDefectMode, defectId, finalInspectionId, editIndex]);

  // Sync section and subsection props with state for create mode
  useEffect(() => {
    if (!isOpen || mode !== 'create') return;
    
    // Only sync if props are provided and we're in create mode
    if (sectionName !== undefined) {
      setSelectedLocation(sectionName || '');
      // Also set selectedSection when in page mode
      if (isPage) {
        setSelectedSection(sectionName || '');
        // If sectionId prop is provided, also set the ID
        if (sectionId) {
          setSelectedSectionId(sectionId);
        }
      }
    }
    if (subsectionName !== undefined) {
      setSelectedSubLocation(subsectionName || '');
      // Also set selectedSubsection when in page mode
      if (isPage) {
        setSelectedSubsection(subsectionName || '');
        // If subsectionId prop is provided, also set the ID
        if (subsectionId) {
          setSelectedSubsectionId(subsectionId);
        }
      }
    }
  }, [isOpen, mode, sectionName, subsectionName, sectionId, subsectionId, isPage]);

  // Helper function to dispatch color to all tools
  const dispatchColorToAllTools = useCallback((color: string) => {
    const arrowEvent = new CustomEvent('setArrowColor', { detail: color });
    const circleEvent = new CustomEvent('setCircleColor', { detail: color });
    const squareEvent = new CustomEvent('setSquareColor', { detail: color });
    window.dispatchEvent(arrowEvent);
    window.dispatchEvent(circleEvent);
    window.dispatchEvent(squareEvent);
  }, []);

  // Sync reusable dropdowns data to component state when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    if (isError) {
      console.error('Failed to fetch defaults');
      // Use fallbacks on error
      const fallbackColor = '#FF8C00';
      setSelectedColor(fallbackColor);
      dispatchColorToAllTools(fallbackColor);
      setActiveMode('arrow');
      setLocationOptions([]);
      return;
    }
    
    if (dropdownsData?.data) {
      const data = dropdownsData.data;
      
      // Set default defect color
      const color = data.defaultDefectColor || '#FF8C00';
      setSelectedColor(color);
      dispatchColorToAllTools(color);
      
      // Set default annotation tool
      const tool = data.defaultAnnotationTool || 'arrow';
      if (tool === 'arrow' || tool === 'circle' || tool === 'square') {
        setActiveMode(tool);
      }
      
      // Extract location data from API response
      let locationValues: string[] = [];
      if (Array.isArray(data.location)) {
        locationValues = data.location.map((item: { id: string; value: string }) => item.value);
      } else if (typeof data.location === 'string') {
        // Backward compatibility: handle string format
        locationValues = data.location.split(',').map((item: string) => item.trim()).filter((item: string) => item.length > 0);
      }
      
      // Convert to format needed by CreatableConcatenatedInput
      const locationOptionsFormatted = locationValues.map(value => ({ value, label: value }));
      setLocationOptions(locationOptionsFormatted);
    } else {
      // Use fallbacks when data is not available
      const fallbackColor = '#FF8C00';
      setSelectedColor(fallbackColor);
      dispatchColorToAllTools(fallbackColor);
      setActiveMode('arrow');
      setLocationOptions([]);
    }
  }, [isOpen, dropdownsData, isError, dispatchColorToAllTools]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideArrow = arrowDropdownRef.current && !arrowDropdownRef.current.contains(target);
      const isOutsideCircle = circleDropdownRef.current && !circleDropdownRef.current.contains(target);
      const isOutsideSquare = squareDropdownRef.current && !squareDropdownRef.current.contains(target);
      const isOutsideSection = sectionDropdownRef.current && !sectionDropdownRef.current.contains(target);
      const isOutsideSubsection = subsectionDropdownRef.current && !subsectionDropdownRef.current.contains(target);
      
      if (openDropdown && isOutsideArrow && isOutsideCircle && isOutsideSquare) {
        setOpenDropdown(null);
      }
      
      if (showSectionDropdown && isOutsideSection) {
        setShowSectionDropdown(false);
      }
      
      if (showSubsectionDropdown && isOutsideSubsection) {
        setShowSubsectionDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, openDropdown, showSectionDropdown, showSubsectionDropdown]);

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

  // Load annotations for merged-defect mode
  useEffect(() => {
    if (!isOpen) return;
    
    if (isMergedDefectMode && propAnnotations) {
      setPreloadedAnnotations(propAnnotations);
    } else if (isMergedDefectMode) {
      setPreloadedAnnotations([]);
    }
  }, [isOpen, isMergedDefectMode, propAnnotations]);

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
      setSelectedLocation(sectionName || '');
      setSelectedSubLocation(subsectionName || '');
      setSelectedLocation2('');
      setVideoFile(null);
      setVideoSrc(null);
      setThumbnail(null);
      setIsThreeSixty(false);
      setActiveMode('none');
      setHasCropFrame(false);
      setOpenDropdown(null);
      // Reset section/subsection dropdown states
      setShowSectionDropdown(false);
      setSectionSearch('');
      setSelectedSection('');
      setSelectedSectionId('');
      setShowSubsectionDropdown(false);
      setSubsectionSearch('');
      setSelectedSubsection('');
      setSelectedSubsectionId('');
    }
  }, [isOpen, sectionName, subsectionName]);

  // Actions for editing images
  const handleActionClick = (mode: 'none' | 'crop' | 'arrow' | 'circle' | 'square') => {
    if (mode === 'arrow' || mode === 'circle' || mode === 'square') {
      const isCurrentlyActive = activeMode === mode;
      setActiveMode(isCurrentlyActive ? 'none' : mode);
      setOpenDropdown(isCurrentlyActive ? null : mode);
    } else {
      setOpenDropdown(null);
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

  // Reset form state for create mode to allow creating multiple defects
  const resetCreateFormState = useCallback(() => {
    setDescription('');
    setCurrentImage(null);
    setEditedFile(null);
    setOriginalFile(null);
    setVideoFile(null);
    setVideoSrc(null);
    setThumbnail(null);
    setIsThreeSixty(false);
    setCurrentAnnotations([]);
    setSelectedLocation2('');
    // Reset section/subsection dropdown states (but preserve selected values)
    setShowSectionDropdown(false);
    setSectionSearch('');
    // Preserve selectedSection and selectedSectionId - don't clear them
    setShowSubsectionDropdown(false);
    setSubsectionSearch('');
    // Preserve selectedSubsection and selectedSubsectionId - don't clear them
    // Keep activeMode selected so annotation tool remains active after submit
    setHasCropFrame(false);
    setOpenDropdown(null);
    setPreloadedAnnotations(undefined);
    setImageDate(null); // Clear image date on reset
    setResetKey(prev => prev + 1); // Force ImageEditor remount
  }, []);

  // Mode-specific submit handlers
  const handleSubmitAdditionalLocation = async () => {
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
      const { publicUrl } = await uploadFileToR2(editedFile);
      await addAdditionalLocationPhoto(defectId!, finalInspectionId, {
        url: publicUrl,
        location: selectedLocation2,
        isThreeSixty
      });

      toast.success('Location photo added successfully');
      onSave?.({ defectId, photo: { url: publicUrl, location: selectedLocation2, isThreeSixty } });
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to add location photo: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitDefectMain = async () => {
    if (!editedFile) {
      toast.error('Please upload and edit an image before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { publicUrl } = await uploadFileToR2(editedFile);
      await updateDefectImage(
        defectId!,
        finalInspectionId,
        publicUrl,
        currentAnnotations,
        propOriginalImageUrl
      );

      toast.success('Defect image updated successfully');
      onSave?.({ defectId, newImageUrl: publicUrl, annotations: currentAnnotations });
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to update defect image: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEditAdditional = async () => {
    if (!editedFile) {
      toast.error('Please upload and edit an image before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { publicUrl } = await uploadFileToR2(editedFile);
      const { oldUrl } = await updateAdditionalLocationPhoto(
        defectId!,
        finalInspectionId,
        editIndex!,
        {
          url: publicUrl,
          location: selectedLocation2 || undefined
        }
      );

      toast.success('Photo updated successfully');
      onSave?.({ defectId, index: editIndex, oldUrl, newUrl: publicUrl });
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to save edited photo: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitMergedDefect = async () => {
    if (!editedFile) {
      toast.error('Please upload and edit an image before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload the annotated image
      const { publicUrl: annotatedImageUrl } = await uploadFileToR2(editedFile);
      
      // Upload the original image (without annotations) if annotations exist
      let originalImageUrl = annotatedImageUrl;
      if (originalFile && currentAnnotations.length > 0) {
        //@ts-ignore
        const { publicUrl: origUrl } = await uploadOriginalImageToR2(originalFile);
        originalImageUrl = origUrl;
      } else if (propOriginalImageUrl) {
        // If no new original file but we have a prop, use that
        originalImageUrl = propOriginalImageUrl;
      }

      // Fetch the defect to get current additional_images
      const defectRes = await fetch(`/api/defects/${finalInspectionId}`);
      if (!defectRes.ok) {
        throw new Error('Failed to fetch defect data');
      }
      
      const defects = await defectRes.json();
      const defect = defects.find((d: any) => d._id === defectId);
      
      if (!defect) {
        throw new Error('Defect not found');
      }

      // Update the specific additional_image at editIndex
      const additionalImages = defect.additional_images || [];
      if (!additionalImages[editIndex!]) {
        throw new Error('Invalid image index');
      }

      const updatedImages = additionalImages.map((img: any, i: number) => 
        i === editIndex! ? {
          ...img,
          image: annotatedImageUrl,
          originalImage: originalImageUrl,
          annotations: currentAnnotations,
          location: selectedLocation2 || img.location || ''
        } : img
      );

      // Update the defect via API
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

      toast.success('Annotation saved successfully');
      onSave?.({
        defectId,
        index: editIndex,
        newImageUrl: annotatedImageUrl,
        newOriginalImageUrl: originalImageUrl,
        annotations: currentAnnotations,
        location: selectedLocation2 || additionalImages[editIndex!].location || ''
      });
      onClose();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to save annotation: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitAnnotation = async () => {
    if (!editedFile) {
      toast.error('Please make some changes to the image before saving (draw arrows, circles, etc.).');
      return;
    }

    setIsSubmitting(true);

    try {
      const { publicUrl } = await uploadFileToR2(editedFile);

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
  };

  const handleSubmitCreate = () => {
    
    // When in page mode, use selectedSection and selectedSubsection; otherwise use selectedLocation and selectedSubLocation
    const finalSection = isPage ? selectedSection : selectedLocation;
    const finalSubsection = isPage ? selectedSubsection : selectedSubLocation;
    
    if (!finalSection || !finalSubsection || !selectedLocation2) {
      toast.error('Please select all required location fields.');
      return;
    }
    
    if (!editedFile) {
      toast.error('No edited image to upload');
      return;
    }

    // Capture values before resetting form
    const selectedSectionValue = finalSection;
    const selectedSubsectionValue = finalSubsection;
    const selectedLocationValue = selectedLocation2;
    // Use selected IDs from state when in page mode, otherwise fall back to props
    const finalSectionId = isPage ? selectedSectionId : (sectionId || '');
    const finalSubsectionId = isPage ? selectedSubsectionId : (subsectionId || '');
    const capturedEditedFile = editedFile;
    const capturedOriginalFile = originalFile && currentAnnotations.length > 0 ? originalFile : null;
    const capturedVideoFile = videoFile;
    const capturedThumbnail = thumbnail;
    const capturedDescription = description;
    const capturedAnnotations = currentAnnotations;
    const capturedIsThreeSixty = isThreeSixty;
    const capturedSelectedColor = selectedColor;

    // Start async upload/analysis without awaiting (fire-and-forget)
    (async () => {
      try {
        // Upload original image (without annotations) if available and annotations exist
        const originalImageUrl = await uploadOriginalImageToR2(capturedOriginalFile);

        // Upload edited image
        const { publicUrl: imagePublicUrl } = await uploadFileToR2(capturedEditedFile);

        // Optional video upload
        let videoPublicUrl: string | null = null;
        let thumbnailPublicUrl: string | null = null;
        let finalType: 'image' | 'video' = 'image';
        
        if (capturedVideoFile) {
          finalType = 'video';
          const { publicUrl: vidPublicUrl } = await uploadFileToR2(capturedVideoFile);
          videoPublicUrl = vidPublicUrl;

          if (capturedThumbnail) {
            thumbnailPublicUrl = await uploadThumbnailToR2(capturedThumbnail);
          }
        }

        const response = await fetch('/api/llm/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: imagePublicUrl,
            description: capturedDescription,
            location: selectedLocationValue,
            inspectionId: finalInspectionId,
            section: selectedSectionValue,
            subSection: selectedSubsectionValue,
            templateId: finalTemplateId,
            sectionId: finalSectionId,
            subsectionId: finalSubsectionId,
            selectedColor: capturedSelectedColor,
            isThreeSixty: capturedIsThreeSixty,
            type: finalType,
            videoUrl: videoPublicUrl,
            thumbnailUrl: thumbnailPublicUrl,
            annotations: capturedAnnotations,
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
          toast.error('Analysis did not start correctly. Please check if it was created.');
          return;
        }

        onSave?.({ analysisId: result.analysisId, imageUrl: imagePublicUrl });
      } catch (error: any) {
        toast.error('Error processing defect. Please check if it was created.');
        console.error('Error in fire-and-forget submit:', error);
      }
    })();

    // Immediately reset form - don't wait for API
    resetCreateFormState();
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    if (isAdditionalLocationMode && defectId) {
      return handleSubmitAdditionalLocation();
    }

    if (isDefectMainMode && defectId) {
      return handleSubmitDefectMain();
    }

    if (isEditAdditionalMode && defectId && editIndex !== undefined) {
      return handleSubmitEditAdditional();
    }

    if (isMergedDefectMode && defectId && editIndex !== undefined) {
      return handleSubmitMergedDefect();
    }

    if (isAnnotationMode && checklistId) {
      return handleSubmitAnnotation();
    }

    if (mode === 'create') {
      return handleSubmitCreate();
    }
  };

  

  // Function to handle color selection for all tools
  const handleColorSelection = (color: string) => {
    setSelectedColor(color);
    dispatchColorToAllTools(color);
  };

  if (!isOpen) return null;

  return (
    <div className={isPage ? "min-h-screen p-4" : "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"}>
      <div className={`relative w-full ${isPage ? "h-full" : "max-w-7xl max-h-[95vh]"} bg-white ${isPage ? "" : "rounded-lg shadow-xl"} overflow-hidden flex flex-col`}>
        {/* Header */}
        {isPage ? null : <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">
            {mode === 'annotation' ? 'Annotate Image' :
             mode === 'defect-main' ? 'Edit Defect Image' :
             mode === 'additional-location' ? 'Add Location Photo' :
             mode === 'edit-additional' ? 'Edit Location Photo' :
             mode === 'merged-defect' ? 'Annotate Merged Defect Image' :
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
        }
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isSubmitting && mode !== 'create' ? (
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
                <div className="arrow-button-container" ref={arrowDropdownRef}>
                  <button 
                    className={`action-btn arrow-btn ${activeMode === 'arrow' ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActionClick('arrow');
                    }}
                  >
                    <i className="fas fa-arrow-right"></i>
                  </button>
                  
                  <ColorDropdown
                    isOpen={openDropdown === 'arrow'}
                    onClose={() => setOpenDropdown(null)}
                    selectedColor={selectedColor}
                    onColorSelect={handleColorSelection}
                    className="arrow-dropdown"
                    type="arrow"
                  />
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
                  
                  <ColorDropdown
                    isOpen={openDropdown === 'circle'}
                    onClose={() => setOpenDropdown(null)}
                    selectedColor={selectedColor}
                    onColorSelect={handleColorSelection}
                    className="circle-dropdown"
                    type="circle"
                  />
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
                  
                  <ColorDropdown
                    isOpen={openDropdown === 'square'}
                    onClose={() => setOpenDropdown(null)}
                    selectedColor={selectedColor}
                    onColorSelect={handleColorSelection}
                    className="square-dropdown"
                    type="square"
                  />
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
                  key={resetKey}
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
                  imageDate={imageDate}
                  onImageDateExtracted={handleImageDateExtracted}
                />
              </div>

              {/* Description Box - Only show for defect workflow (but not in defect-main annotate mode or merged-defect mode) */}
              {!isAnnotationMode && !isDefectMainMode && !isAdditionalLocationMode && !isEditAdditionalMode && !isMergedDefectMode && (
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
          
                    {/* Section and Subsection Dropdowns - Only show when isPage is true */}
                    {isPage && !isDefectMainMode && (
                      <>
                        {/* Section Button with Dropdown */}
                        <div className="location-button-container">
                          <button 
                            className="location-btn section-btn bg-gradient-to-br from-[rgb(75,108,183)] to-[rgb(106,17,203)] text-white px-6 py-[18px] rounded-xl text-base font-semibold cursor-pointer transition-all duration-300 shadow-[0_4px_20px_rgba(75,108,183,0.3)] flex items-center justify-between font-['Inter',sans-serif] tracking-[0.3px] border border-white/10 w-[300px] h-[60px] whitespace-nowrap overflow-hidden text-ellipsis hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(75,108,183,0.4)] hover:bg-gradient-to-br hover:from-[rgb(106,17,203)] hover:to-[rgb(75,108,183)] active:-translate-y-px active:shadow-[0_4px_20px_rgba(75,108,183,0.3)]"
                            onClick={() => setShowSectionDropdown(!showSectionDropdown)}
                          >
                            <div className="btn-content">
                              <i className="fas fa-map-marker-alt"></i>
                              <span>{selectedSection || 'Section'}</span>
                            </div>
                            <i className={`fas fa-chevron-down ${showSectionDropdown ? 'rotate' : ''}`}></i>
                          </button>
                          
                          {showSectionDropdown && (
                            <div className="location-dropdown" ref={sectionDropdownRef}>
                              <div className="location-search-container">
                                <input
                                  type="text"
                                  placeholder="Search section..."
                                  value={sectionSearch}
                                  onChange={(e) => setSectionSearch(e.target.value)}
                                  className="location-search-input"
                                />
                              </div>
                              <div className="location-options">
                                {filteredSections.map((section: any) => (
                                  <div
                                    key={section._id}
                                    className={`location-option ${selectedSection === section.name ? 'selected' : ''}`}
                                    onClick={() => {
                                      setSelectedSection(section.name);
                                      setSelectedSectionId(section._id);
                                      setShowSectionDropdown(false);
                                      setSectionSearch('');
                                      setSelectedSubsection(''); // Reset subsection when section changes
                                      setSelectedSubsectionId(''); // Reset subsection ID when section changes
                                      setSubsectionSearch(''); // Reset subsection search
                                      setShowSubsectionDropdown(false); // Hide subsection dropdown initially
                                    }}
                                  >
                                    <i className="fas fa-map-marker-alt"></i>
                                    <span>{section.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Subsection Button with Dropdown */}
                        <div className="location-button-container">
                          <button 
                            className={`location-btn sub-location-btn ${!selectedSection ? 'disabled opacity-50' : ''} bg-gradient-to-br from-[rgb(75,108,183)] to-[rgb(106,17,203)] text-white px-6 py-[18px] rounded-xl text-base font-semibold cursor-pointer transition-all duration-300 shadow-[0_4px_20px_rgba(75,108,183,0.3)] flex items-center justify-between font-['Inter',sans-serif] tracking-[0.3px] border border-white/10 w-[300px] h-[60px] whitespace-nowrap overflow-hidden text-ellipsis hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(75,108,183,0.4)] hover:bg-gradient-to-br hover:from-[rgb(106,17,203)] hover:to-[rgb(75,108,183)] active:-translate-y-px active:shadow-[0_4px_20px_rgba(75,108,183,0.3)]`}
                            onClick={() => selectedSection && setShowSubsectionDropdown(!showSubsectionDropdown)}
                            disabled={!selectedSection}
                          >
                            <div className="btn-content">
                              <i className="fas fa-layer-group"></i>
                              <span>{selectedSubsection || 'Sub Section'}</span>
                            </div>
                            <i className={`fas fa-chevron-down ${showSubsectionDropdown ? 'rotate' : ''}`}></i>
                          </button>
                          
                          {showSubsectionDropdown && selectedSection && (
                            <div className="location-dropdown sub-location-dropdown" ref={subsectionDropdownRef}>
                              <div className="location-search-container">
                                <input
                                  type="text"
                                  placeholder="Search sub-section..."
                                  value={subsectionSearch}
                                  onChange={(e) => setSubsectionSearch(e.target.value)}
                                  className="location-search-input"
                                />
                              </div>
                              <div className="location-options">
                                {filteredSubsections.map((subsection: any) => (
                                  <div
                                    key={subsection._id}
                                    className={`location-option ${selectedSubsection === subsection.name ? 'selected' : ''}`}
                                    onClick={() => {
                                      setSelectedSubsection(subsection.name);
                                      setSelectedSubsectionId(subsection._id);
                                      setShowSubsectionDropdown(false);
                                      setSubsectionSearch('');
                                    }}
                                  >
                                    <i className="fas fa-layer-group"></i>
                                    <span>{subsection.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Location Select - Hide in defect-main annotate mode, show for merged-defect mode */}
                    {!isDefectMainMode && (
                      <div className="w-[300px]">
                        <CreatableConcatenatedInput
                          value={selectedLocation2}
                          onChange={setSelectedLocation2}
                          // label="Location"
                          placeholder="Search location..."
                          inputPlaceholder="Enter location"
                          options={locationOptions}
                        />
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
                          {isDefectMainMode ? 'Saving...' : isAdditionalLocationMode ? 'Adding Photo...' : isEditAdditionalMode ? 'Saving...' : isMergedDefectMode ? 'Saving...' : 'Processing...'}
                        </>
                      ) : (
                        <>
                          {mode === 'create' && <i className="fas fa-plus-circle"></i>}
                          {isDefectMainMode ? 'Save Changes' : isAdditionalLocationMode ? 'Add Photo' : isEditAdditionalMode ? 'Save Photo' : isMergedDefectMode ? 'Save Annotation' : 'Create Defect'}
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
