"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import ImageEditor from './ImageEditor';
import { toast } from 'sonner';
import { useSpeechToText } from '@/src/lib/useSpeechToText';
import { CreatableConcatenatedInput } from '@/components/ui/creatable-concatenated-input';
import { LOCATIONS } from './constants/dropdownData';
import { uploadFileToR2, uploadThumbnailToR2, uploadOriginalImageToR2 } from './utils/fileUpload';
import { fetchDefectById, updateDefectImage, addAdditionalLocationPhoto, updateAdditionalLocationPhoto } from './utils/defectOperations';
import ColorDropdown from './ColorDropdown';

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
  sectionName?: string;
  subsectionName?: string;
  onSave?: (result: any) => void;
  preloadedAnnotations?: any[];
  originalImageUrl?: string;
}

 // Color options for all tools (arrow, circle, square)
export const toolColors = ['#d63636', '#FF8C00', '#0066CC', '#4CBB17', '#800080'];

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
  sectionName,
  subsectionName,
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
  const [openDropdown, setOpenDropdown] = useState<'arrow' | 'circle' | 'square' | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>(sectionName || '');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>(subsectionName || '');
  const [selectedLocation2, setSelectedLocation2] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const arrowDropdownRef = useRef<HTMLDivElement>(null);
  const circleDropdownRef = useRef<HTMLDivElement>(null);
  const squareDropdownRef = useRef<HTMLDivElement>(null);
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

  // Sync section and subsection props with state for create mode
  useEffect(() => {
    if (!isOpen || mode !== 'create') return;
    
    // Only sync if props are provided and we're in create mode
    if (sectionName !== undefined) {
      setSelectedLocation(sectionName || '');
    }
    if (subsectionName !== undefined) {
      setSelectedSubLocation(subsectionName || '');
    }
  }, [isOpen, mode, sectionName, subsectionName]);

  // Helper function to dispatch color to all tools
  const dispatchColorToAllTools = useCallback((color: string) => {
    const arrowEvent = new CustomEvent('setArrowColor', { detail: color });
    const circleEvent = new CustomEvent('setCircleColor', { detail: color });
    const squareEvent = new CustomEvent('setSquareColor', { detail: color });
    window.dispatchEvent(arrowEvent);
    window.dispatchEvent(circleEvent);
    window.dispatchEvent(squareEvent);
  }, []);

  // Fetch default defect color when modal opens
  useEffect(() => {
    if (!isOpen) return;
    
    const fetchDefaultColor = async () => {
      try {
        const response = await fetch('/api/reusable-dropdowns', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          const color = data.defaultDefectColor || '#FF8C00';
          setSelectedColor(color);
          dispatchColorToAllTools(color);
        }
      } catch (error) {
        console.error('Failed to fetch default defect color:', error);
        // Use fallback
        const fallbackColor = '#FF8C00';
        setSelectedColor(fallbackColor);
        dispatchColorToAllTools(fallbackColor);
      }
    };
    
    fetchDefaultColor();
  }, [isOpen, dispatchColorToAllTools]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!isOpen || !openDropdown) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isOutsideArrow = arrowDropdownRef.current && !arrowDropdownRef.current.contains(target);
      const isOutsideCircle = circleDropdownRef.current && !circleDropdownRef.current.contains(target);
      const isOutsideSquare = squareDropdownRef.current && !squareDropdownRef.current.contains(target);
      
      if (isOutsideArrow && isOutsideCircle && isOutsideSquare) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, openDropdown]);

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
    }
  }, [isOpen]);

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
    setActiveMode('none');
    setHasCropFrame(false);
    setOpenDropdown(null);
    setPreloadedAnnotations(undefined);
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
      await addAdditionalLocationPhoto(defectId!, inspectionId, {
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
        inspectionId,
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
        inspectionId,
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
    
    if (!selectedLocation || !selectedSubLocation || !selectedLocation2) {
      toast.error('Please select all required location fields.');
      return;
    }
    
    if (!editedFile) {
      toast.error('No edited image to upload');
      return;
    }

    // Capture values before resetting form
    const selectedSection = selectedLocation;
    const selectedSubsection = selectedSubLocation;
    const selectedLocationValue = selectedLocation2;
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
            inspectionId: inspectionId,
            section: selectedSection,
            subSection: selectedSubsection,
            templateId,
            sectionId,
            subsectionId,
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
                  <div className="submit-controls flex-col flex-wrap gap-4 items-center">
          
                    {/* Location Select - Hide in defect-main annotate mode */}
                    {!isDefectMainMode && (
                      <div className="w-[300px]">
                        <CreatableConcatenatedInput
                          value={selectedLocation2}
                          onChange={setSelectedLocation2}
                          label="Location"
                          placeholder="Search location..."
                          inputPlaceholder="Enter location"
                          options={LOCATIONS.map(loc => ({ value: loc, label: loc }))}
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
