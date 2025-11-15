"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import ImageEditor from '../../../../components/ImageEditor';
import { useState, useRef, useEffect, Suspense } from 'react';
import { useAnalysisStore } from '@/lib/store';

function ImageEditorPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedInspectionId = searchParams.get('inspectionId') || '';
  const preloadImageUrl = searchParams.get('imageUrl') || searchParams.get('src'); // Get existing image URL (support both 'imageUrl' and 'src')
  const returnTo = searchParams.get('returnTo'); // Where to return after editing
  const checklistId = searchParams.get('checklistId'); // For information block images
  const mode = searchParams.get('mode'); // 'additional-location' for adding photos to existing defect, 'defect-main' for main defect image
  const defectId = searchParams.get('defectId'); // Parent defect ID for additional photos
  const editIndexParam = searchParams.get('index'); // Index when editing existing additional photo
  
  // Check if this is additional location photo mode
  const isAdditionalLocationMode = mode === 'additional-location' && defectId;
  const isEditAdditionalMode = mode === 'edit-additional' && defectId && typeof editIndexParam === 'string';
  const isDefectMainMode = mode === 'defect-main' && defectId; // Editing main defect image
  
  const [description, setDescription] = useState('');
  const [activeMode, setActiveMode] = useState<'none' | 'crop' | 'arrow' | 'circle' | 'square'>('none');
  const [hasCropFrame, setHasCropFrame] = useState(false);
  const [showDrawingDropdown, setShowDrawingDropdown] = useState(false);
  const [showCircleDropdown, setShowCircleDropdown] = useState(false);
  const [showSquareDropdown, setShowSquareDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [showSubLocationDropdown, setShowSubLocationDropdown] = useState(false);
  const [subLocationSearch, setSubLocationSearch] = useState('');
  const [selectedSubLocation, setSelectedSubLocation] = useState<string>('');
  const [showLocationDropdown2, setShowLocationDropdown2] = useState(false);
  const [locationSearch2, setLocationSearch2] = useState('');
  const [selectedLocation2, setSelectedLocation2] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('');
  const drawingDropdownRef = useRef<HTMLDivElement>(null);
  const circleDropdownRef = useRef<HTMLDivElement>(null);
  const squareDropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const subLocationDropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef2 = useRef<HTMLDivElement>(null);
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const [editedFile, setEditedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null); // Store original unannotated file for CREATE flow
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedColor, setSelectedColor] = useState('#d63636'); // Default red color - shared across all tools
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isThreeSixty, setIsThreeSixty] = useState(false); // 360° photo flag
  const [preloadedAnnotations, setPreloadedAnnotations] = useState<any[] | undefined>(undefined);
  const [currentAnnotations, setCurrentAnnotations] = useState<any[]>([]);



  const { updateAnalysisData } = useAnalysisStore();

  const location = [
    'Addition', 'All Locations', 'Apartment', 'Attic', 'Back Porch', 'Back Room', 'Balcony',
    'Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Bedroom 4', 'Bedroom 5', 'Both Locations', 'Breakfast',
    'Carport', 'Carport Entry', 'Closet', 'Crawlspace', 'Dining', 'Downstairs', 'Downstairs Bathroom',
    'Downstairs Bathroom Closet', 'Downstairs Hallway', 'Downstairs Hall Closet', 'Driveway', 'Entry',
    'Family Room', 'Front Entry', 'Front of House', 'Front Porch', 'Front Room', 'Garage', 'Garage Entry',
    'Garage Storage Closet', 'Guest Bathroom', 'Guest Bedroom', 'Guest Bedroom Closet', 'Half Bathroom',
    'Hallway', 'Heater Operation Temp', 'HVAC Closet', 'Keeping Room', 'Kitchen', 'Kitchen Pantry',
    'Left Side of House', 'Left Wall', 'Living Room', 'Living Room Closet', 'Laundry Room',
    'Laundry Room Closet', 'Master Bathroom', 'Master Bedroom', 'Master Closet', 'Most Locations',
    'Multiple Locations', 'Office', 'Office Closet', 'Outdoor Storage', 'Patio', 'Rear Entry',
    'Rear of House', 'Rear Wall', 'Right Side of House', 'Right Wall', 'Shop', 'Side Entry', 'Staircase',
    'Sun Room', 'Top of Stairs', 'Upstairs Bathroom', 'Upstairs Bedroom 1', 'Upstairs Bedroom 1 Closet',
    'Upstairs Bedroom 2', 'Upstairs Bedroom 2 Closet', 'Upstairs Bedroom 3', 'Upstairs Bedroom 3 Closet',
    'Upstairs Bedroom 4', 'Upstairs Bedroom 4 Closet', 'Upstairs Hallway', 'Upstairs Laundry Room',
    'Utility Room', 'Water Heater Closet', 'Water Heater Output Temp'
  ];

  const section = [
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

  const subsection: { [key: string]: string[] } = {
    'Grounds': [
      'Vegetation, Grading, & Drainage',
      'Sidewalks, Porches, Driveways'
    ],
    'Foundation & Structure': [
      'Foundation',
      'Crawlspace',
      'Floor Structure',
      'Wall Structure',
      'Ceiling Structure'
    ],
    'Roof': [
      'Coverings',
      'Flashing & Seals',
      'Roof Penetrations',
      'Roof Structure & Attic',
      'Gutters'
    ],
    'Exterior': [
      'Exterior Doors',
      'Exterior Windows',
      'Siding, Flashing, & Trim',
      'Brick/Stone Veneer',
      'Vinyl Siding',
      'Soffit & Fascia',
      'Wall Penetrations',
      'Doorbell',
      'Exterior Support Columns',
      'Steps, Stairways, & Railings'
    ],
    'Fireplace / Chimney': [
      'Fireplace',
      'Chimney',
      'Flue'
    ],
    'Interior': [
      'Doors',
      'Windows',
      'Floors',
      'Walls',
      'Ceilings',
      'Countertops & Cabinets',
      'Trim',
      'Steps, Staircase, & Railings'
    ],
    'Insulation & Ventilation': [
      'Attic Access',
      'Insulation',
      'Vapor Barrier',
      'Ventilation & Exhaust'
    ],
    'AC / Cooling': [
      'Air Conditioning',
      'Thermostats',
      'Distribution System'
    ],
    'Furnace / Heater': [
      'Forced Air Furnace'
    ],
    'Electrical': [
      'Sub Panel',
      'Service Panel',
      'Branch Wiring & Breakers',
      'Exterior Lighting',
      'Fixtures, Fans, Switches, & Receptacles',
      'GFCI & AFCI',
      '240 Volt Receptacle',
      'Smoke / Carbon Monoxide Alarms',
      'Service Entrance'
    ],
    'Plumbing': [
      'Water Heater',
      'Drain, Waste, & Vents',
      'Water Supply',
      'Water Spigot',
      'Gas Supply',
      'Vents & Flues',
      'Fixtures,Sinks, Tubs, & Toilets'
    ],
    'Built-In Appliances': [
      'Refrigerator',
      'Dishwasher',
      'Garbage Disposal',
      'Microwave',
      'Range Hood',
      'Range, Oven & Cooktop'
    ],
    'Swimming Pool & Spa': [
      'Equipment',
      'Electrical',
      'Safety Devices',
      'Coping & Decking',
      'Vessel Surface',
      'Drains',
      'Control Valves',
      'Filter',
      'Pool Plumbing',
      'Pumps',
      'Spa Controls & Equipment',
      'Heating',
      'Diving Board & Slide'
    ],
    'Verified Functionality': [
      'AC Temperature Differential',
      'Furnace Output Temperature',
      'Oven Operation Temperature',
      'Water Heater Output Temperature'
    ]
  };

  const filteredSections = section.filter(sectionItem =>
    sectionItem.toLowerCase().includes(locationSearch.toLowerCase())
  );

  const filteredSubsections = selectedLocation && subsection[selectedLocation as keyof typeof subsection]
    ? subsection[selectedLocation as keyof typeof subsection].filter(subLocation =>
        subLocation.toLowerCase().includes(subLocationSearch.toLowerCase())
      )
    : [];

  const filteredLocations = location.filter(locationItem =>
    locationItem.toLowerCase().includes(locationSearch2.toLowerCase())
  );

  // Fetch parent defect info when in additional location mode
  useEffect(() => {
    if ((isAdditionalLocationMode || isEditAdditionalMode) && defectId && selectedInspectionId) {
      const fetchParentDefect = async () => {
        try {
          const response = await fetch(`/api/defects/${selectedInspectionId}`);
          if (response.ok) {
            const defects = await response.json();
            const parentDefect = defects.find((d: any) => d._id === defectId);
            if (parentDefect) {
              // Auto-fill section and subsection from parent defect
              setSelectedLocation(parentDefect.section || '');
              setSelectedSubLocation(parentDefect.subsection || '');
              console.log('✅ Parent defect loaded:', parentDefect.section, '-', parentDefect.subsection);
              // For edit mode, also prefill the location field with the photo's location
              if (isEditAdditionalMode && Array.isArray(parentDefect.additional_images)) {
                const idx = parseInt(editIndexParam as string, 10);
                const target = parentDefect.additional_images[idx];
                if (target && target.location) {
                  setSelectedLocation2(target.location);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error fetching parent defect:', error);
        }
      };
      fetchParentDefect();
    }
  }, [isAdditionalLocationMode, isEditAdditionalMode, defectId, selectedInspectionId, editIndexParam]);


  // Close dropdowns when clicking outside
  useEffect(() => {
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
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target as Node)) {
        setShowLocationDropdown(false);
      }
      if (subLocationDropdownRef.current && !subLocationDropdownRef.current.contains(event.target as Node)) {
        setShowSubLocationDropdown(false);
      }
      if (locationDropdownRef2.current && !locationDropdownRef2.current.contains(event.target as Node)) {
        setShowLocationDropdown2(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Load existing image from URL if provided
  useEffect(() => {
    if (preloadImageUrl) {
      console.log('🖼️ Loading existing image from URL:', preloadImageUrl);
      
  // Use the robust proxy-image API (has R2 SDK fallback) to avoid CORS and TLS hiccups
  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(preloadImageUrl)}`;
      
      fetch(proxyUrl)
        .then(res => {
          console.log('Fetch response status:', res.status);
          if (!res.ok) {
            throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
          }
          return res.blob();
        })
        .then(blob => {
          console.log('✅ Image fetched as blob, size:', blob.size, 'type:', blob.type);
          
          // Create object URL from blob
          const objectUrl = URL.createObjectURL(blob);
          console.log('Created object URL:', objectUrl);
          
          // Create image element
          const img = new Image();
          img.onload = () => {
            console.log('✅ Image loaded successfully, dimensions:', img.width, 'x', img.height);
            setCurrentImage(img);
            
            // Convert blob to File object for the editor
            const file = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });
            setEditedFile(file);
            console.log('✅ Image converted to File object');
          };
          img.onerror = (err) => {
            console.error('❌ Error loading image from object URL:', err);
            alert('Failed to load image from object URL. Please try again.');
          };
          img.src = objectUrl;
        })
        .catch(err => {
          console.error('❌ Error fetching image:', err);
          alert(`Failed to load image: ${err.message}. Please try again.`);
        });
    }
  }, [preloadImageUrl]);

  // Load annotations from localStorage for defect-main mode
  useEffect(() => {
    if (isDefectMainMode) {
      console.log('📥 Defect-main mode detected, checking for annotations...');
      const annotationsJson = localStorage.getItem('defectAnnotations');
      if (annotationsJson) {
        try {
          const annotations = JSON.parse(annotationsJson);
          console.log('✅ Loaded annotations from localStorage:', annotations.length);
          setPreloadedAnnotations(annotations);
        } catch (e) {
          console.error('❌ Failed to parse annotations from localStorage:', e);
        }
      } else {
        console.log('ℹ️ No annotations found in localStorage');
        setPreloadedAnnotations([]);
      }
    }
  }, [isDefectMainMode]);



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
    console.log('Undo clicked');
    // Dispatch custom event for ImageEditor to handle undo
    const event = new CustomEvent('undoAction');
    window.dispatchEvent(event);
  };

  const handleRedo = () => {
    console.log('Redo clicked');
    // Dispatch custom event for ImageEditor to handle redo
    const event = new CustomEvent('redoAction');
    window.dispatchEvent(event);
  };

  

  const handleRotate = () => {
    console.log('Rotate clicked');
    // Dispatch custom event for ImageEditor to handle rotation
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
      console.log('📤 Adding location photo to existing defect:', defectId);
      
      if (!editedFile) {
        alert('Please upload and edit an image before submitting.');
        return;
      }

      if (!selectedLocation2) {
        alert('Please select a location for this photo.');
        return;
      }

      setIsSubmitting(true);
      setSubmitStatus('Uploading photo...');

      try {
        // Upload the annotated image to R2 via presigned URL (direct, no Vercel bandwidth)
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
        const uploadData = { url: publicUrl };
        console.log('✅ Image uploaded (direct):', uploadData.url);

        // Get current defect data to update additional_images
        const defectRes = await fetch(`/api/defects/${selectedInspectionId}`);
        if (!defectRes.ok) {
          throw new Error('Failed to fetch defect data');
        }

        const defects = await defectRes.json();
        const currentDefect = defects.find((d: any) => d._id === defectId);
        
        if (!currentDefect) {
          throw new Error('Defect not found');
        }

        // Add new photo to additional_images array
        const additionalImages = currentDefect.additional_images || [];
        
        // No upper limit for additional location photos

        additionalImages.push({
          url: uploadData.url,
          location: selectedLocation2,
          isThreeSixty
        });

        // Update defect with new additional_images
        // IMPORTANT: The API expects defectId in URL path, not inspectionId
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

        // Notify parent window via localStorage so the Manage Defects modal can refresh instantly
        try {
          const notice = {
            inspectionId: selectedInspectionId,
            defectId,
            photo: { url: uploadData.url, location: selectedLocation2, isThreeSixty },
            timestamp: Date.now()
          };
          localStorage.setItem('pendingAdditionalLocationPhoto', JSON.stringify(notice));
        } catch (e) {
          console.warn('Unable to write pendingAdditionalLocationPhoto to localStorage:', e);
        }

        setSubmitStatus('Done! Closing...');
        
        // Close the window and return to inspection page
        setTimeout(() => {
          window.close();
          // If window.close doesn't work (not opened as popup), navigate back
          setTimeout(() => {
            if (!window.closed) {
              router.push(`/inspection_report/${selectedInspectionId}`);
            }
          }, 100);
        }, 500);

      } catch (error) {
        console.error('❌ Error adding location photo:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Failed to add location photo: ${errorMessage}`);
        setIsSubmitting(false);
        setSubmitStatus('');
      }
      
      return; // Exit early for additional location flow
    }

    // Special handling for editing main defect image
    if (isDefectMainMode && defectId) {
      console.log('✏️ Editing main defect image:', defectId);

      if (!editedFile) {
        alert('Please upload and edit an image before submitting.');
        return;
      }

      setIsSubmitting(true);
      setSubmitStatus('Uploading edited image...');

      try {
        // Upload the annotated image to R2 via presigned URL
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
        const uploadData = { url: publicUrl };
        console.log('✅ Main image uploaded (direct):', uploadData.url);

        // Get current defect data
        const defectRes = await fetch(`/api/defects/${selectedInspectionId}`);
        if (!defectRes.ok) {
          throw new Error('Failed to fetch defect data');
        }

        const defects = await defectRes.json();
        const currentDefect = defects.find((d: any) => d._id === defectId);

        if (!currentDefect) {
          throw new Error('Defect not found');
        }

        // Update defect with new main image AND annotations
        console.log('💾 Saving annotations:', currentAnnotations.length);
        console.log('📝 Full annotations data:', JSON.stringify(currentAnnotations, null, 2));

        // If there's an original image in localStorage, save it too
        const originalImageUrl = localStorage.getItem('defectOriginalImage');
        console.log('🖼️ Original image URL:', originalImageUrl);

        const updatePayload = {
          inspection_id: currentDefect.inspection_id,
          image: uploadData.url,
          annotations: currentAnnotations,
          originalImage: originalImageUrl || currentDefect.originalImage || uploadData.url
        };

        console.log('📦 Update payload:', JSON.stringify(updatePayload, null, 2));

        const updateRes = await fetch(`/api/defects/${defectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });

        if (!updateRes.ok) {
          const errorText = await updateRes.text();
          console.error('❌ Update failed:', errorText);
          throw new Error('Failed to update defect');
        }

        console.log('✅ Defect updated successfully');

        // Notify parent window via localStorage so the Manage Defects modal can refresh instantly
        try {
          const notice = {
            inspectionId: selectedInspectionId,
            defectId,
            newImageUrl: uploadData.url,
            timestamp: Date.now()
          };
          localStorage.setItem('pendingDefectMainImageUpdate', JSON.stringify(notice));
        } catch (e) {
          console.warn('Unable to write pendingDefectMainImageUpdate to localStorage:', e);
        }

        setSubmitStatus('Done! Closing...');

        // Close the window and return to inspection page
        setTimeout(() => {
          window.close();
          // If window.close doesn't work (not opened as popup), navigate back
          setTimeout(() => {
            if (!window.closed) {
              router.push(`/inspection_report/${selectedInspectionId}`);
            }
          }, 100);
        }, 500);

      } catch (error) {
        console.error('❌ Error updating main defect image:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Failed to update defect image: ${errorMessage}`);
        setIsSubmitting(false);
        setSubmitStatus('');
      }

      return; // Exit early for main defect image flow
    }

    // Special handling for editing an existing additional location photo
    if (isEditAdditionalMode && defectId) {
      console.log('✏️ Editing existing additional location photo:', defectId, 'index:', editIndexParam);

      if (!editedFile) {
        alert('Please upload and edit an image before submitting.');
        return;
      }

      setIsSubmitting(true);
      setSubmitStatus('Uploading edited photo...');

      try {
        // Upload the annotated image to R2 via presigned URL
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
        const uploadData = { url: publicUrl };
        console.log('✅ Edited image uploaded (direct):', uploadData.url);

        // Fetch current defect to get existing additional_images
        const defectRes = await fetch(`/api/defects/${selectedInspectionId}`);
        if (!defectRes.ok) {
          throw new Error('Failed to fetch defect data');
        }
        const defects = await defectRes.json();
        const currentDefect = defects.find((d: any) => d._id === defectId);
        if (!currentDefect) throw new Error('Defect not found');

        const photos = currentDefect.additional_images || [];
        const idx = parseInt(editIndexParam as string, 10);
        const oldUrl: string | undefined = photos[idx]?.url;
        if (Number.isNaN(idx) || !photos[idx]) {
          throw new Error('Invalid photo index');
        }

        // Replace URL at index, keep location and isThreeSixty as-is
        const updatedImages = photos.map((p: any, i: number) => i === idx ? { ...p, url: uploadData.url } : p);

        const updateRes = await fetch(`/api/defects/${defectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inspection_id: currentDefect.inspection_id,
            additional_images: updatedImages,
          })
        });
        if (!updateRes.ok) throw new Error('Failed to update defect');

        // Notify parent via localStorage so the Manage Defects modal updates instantly
        try {
          const notice = {
            inspectionId: selectedInspectionId,
            defectId,
            index: idx,
            oldUrl,
            newUrl: uploadData.url,
            timestamp: Date.now()
          };
          localStorage.setItem('pendingEditedAdditionalLocationPhoto', JSON.stringify(notice));
        } catch (e) {
          console.warn('Unable to write pendingEditedAdditionalLocationPhoto to localStorage:', e);
        }

        setSubmitStatus('Done! Closing...');
        setTimeout(() => {
          window.close();
          setTimeout(() => {
            if (!window.closed) {
              router.push(`/inspection_report/${selectedInspectionId}`);
            }
          }, 100);
        }, 500);

      } catch (error) {
        console.error('❌ Error editing location photo:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Failed to save edited photo: ${errorMessage}`);
        setIsSubmitting(false);
        setSubmitStatus('');
      }

      return; // Exit early for edit-additional flow
    }

    // Special handling for information block annotation
    if (returnTo && checklistId) {
      console.log('📤 Returning annotated image to information block');
      console.log('📋 Current editedFile state:', editedFile ? `${editedFile.name} (${editedFile.size} bytes)` : 'NULL');
      
      if (!editedFile) {
        console.error('❌ No edited file available! User must make changes before clicking Done.');
        alert('Please make some changes to the image before saving (draw arrows, circles, etc.).');
        return;
      }

      setIsSubmitting(true);
      setSubmitStatus('Saving annotated image...');

      try {
        // Upload the annotated image to R2
        const formData = new FormData();
        formData.append('file', editedFile);

        console.log('📤 Uploading annotated image:', editedFile.name, editedFile.size, 'bytes');

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
        const uploadData = { url: publicUrl };
        console.log('✅ Annotated image uploaded (direct):', uploadData.url);

        // Store the annotated image URL in localStorage for the modal to pick up
        // Include inspectionId so main page can reopen the correct modal
        const urlParams = new URLSearchParams(window.location.search);
        const inspectionIdFromUrl = urlParams.get('inspectionId');
        
        const annotationData = {
          checklistId,
          imageUrl: uploadData.url,
          annotations: 'annotated', // Mark as annotated
          inspectionId: inspectionIdFromUrl, // Store inspection ID for modal reopening
          timestamp: Date.now()
        };
        
        try {
          localStorage.setItem('pendingAnnotation', JSON.stringify(annotationData));
          console.log('✅ Saved annotation data to localStorage');
        } catch (storageError) {
          console.error('❌ Failed to save to localStorage:', storageError);
          // Continue anyway - the image was uploaded successfully
        }

        setSubmitStatus('Done! Returning...');
        
        // Navigate back to the inspection page
        // Use a full page reload to ensure the annotation detection works properly
        setTimeout(() => {
          try {
            // First try to close the window if it was opened as a popup
            window.close();
            
            // If window.close() doesn't work, do a full page reload
            // This ensures the window focus event fires and polling detects the annotation
            setTimeout(() => {
              if (!window.closed) {
                console.log('🔙 Reloading page to trigger annotation detection');
                // Use location.href for full page reload which guarantees:
                // 1. Window focus event fires
                // 2. Polling mechanism starts fresh
                // 3. returnToSection is detected and modal reopens
                window.location.href = returnTo || window.location.origin + '/';
              }
            }, 100);
          } catch (error) {
            console.error('❌ Navigation error:', error);
            // Fallback: reload the page
            window.location.href = returnTo || window.location.origin + '/';
          }
        }, 500);

      } catch (error) {
        console.error('❌ Error saving annotated image:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Failed to save annotated image: ${errorMessage}\n\nPlease try again or check your internet connection.`);
        setIsSubmitting(false);
        setSubmitStatus('');
      }
      
      return; // Exit early for information block flow
    }

    // Original defect analysis flow below
    // if ((!currentImage || !editedFile) && !videoFile) {
    //   alert('Please upload and edit an image before submitting.');
    //   return;
    // }
  
    if (!selectedLocation || !selectedSubLocation || !selectedLocation2) {
      alert('Please select all required location fields.');
      return;
    }
    
    // if (!currentImage || !editedFile) {
    //   alert('Please upload and edit an image before submitting.');
    //   return;
    // }

  
    const selectedSection = selectedLocation;
    const selectedSubsection = selectedSubLocation;
    const selectedLocationValue = selectedLocation2;
  
    setIsSubmitting(true);
    setSubmitStatus('Processing...');
  
    let imageDataUrl: string;
    imageDataUrl = ''
    try {
      if (editedFile) {
        imageDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(editedFile);
        });
      }
    } catch (conversionError) {
      console.error('Error converting image to data URL:', conversionError);
      imageDataUrl = '';
    }
  
    try {
      // 1) Upload image directly to R2 via presigned URL (bypasses Vercel's 4.5MB limit)
      // Image is required for both image and video flows (representative frame for analysis and/or the defect image itself)
      if (!editedFile) {
        throw new Error('No edited image to upload');
      }

      // Upload original image (without annotations) if available and annotations exist
      let originalImageUrl: string | null = null;
      if (originalFile && currentAnnotations.length > 0) {
        console.log('📤 Uploading original (unannotated) image for CREATE flow...');
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
        console.log('✅ Original image uploaded:', originalImageUrl);
      }

      // Get presigned URL for annotated image
      const presignedImgRes = await fetch(
        `/api/r2api?action=presigned&fileName=${encodeURIComponent(editedFile.name)}&contentType=${encodeURIComponent(editedFile.type)}`
      );
      if (!presignedImgRes.ok) {
        const t = await presignedImgRes.text();
        throw new Error(`Failed to get presigned URL for image: ${t}`);
      }
      const { uploadUrl: imgUploadUrl, publicUrl: imagePublicUrl } = await presignedImgRes.json();
      // Upload the edited (annotated) image directly to R2
      const putImg = await fetch(imgUploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': editedFile.type },
        body: editedFile,
      });
      if (!putImg.ok) {
        const t = await putImg.text();
        throw new Error(`Failed to upload image to R2: ${putImg.status} ${t}`);
      }
      console.log('✅ Annotated image uploaded:', imagePublicUrl);

      // Optional video upload via presigned URL
      let videoPublicUrl: string | null = null;
      let thumbnailPublicUrl: string | null = null;
      let finalType: 'image' | 'video' = 'image';
      if (videoFile) {
        finalType = 'video';

        // Upload video
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

        // Upload thumbnail if present (data URL => Blob)
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

      // 2) Send only JSON metadata and URLs to the analysis endpoint
      console.log('🚀 Sending to analyze-image API...');
      console.log('📝 Sending annotations:', currentAnnotations.length);
      console.log('🖼️ Original image URL:', originalImageUrl || imagePublicUrl);
      console.log('🎨 Annotated image URL:', imagePublicUrl);
      const response = await fetch('/api/llm/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imagePublicUrl,
          description,
          location: selectedLocationValue,
          inspectionId: selectedInspectionId,
          section: selectedSection,
          subSection: selectedSubsection,
          selectedColor,
          isThreeSixty,
          type: finalType,
          videoUrl: videoPublicUrl,
          thumbnailUrl: thumbnailPublicUrl,
          annotations: currentAnnotations, // Include annotations for saving
          originalImage: originalImageUrl || imagePublicUrl, // Use original (unannotated) if available, otherwise annotated
        }),
      });
      
      console.log('📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error:', errorText);
        alert(`Analysis request failed: ${errorText}`);
        return; // ❌ stop here
      }
      
      const result = await response.json();
      console.log('✅ API response:', result);
      
      // Check if the analysis was accepted and started
      if (response.status === 202) {
        // Analysis is processing in the background
        console.log('✅ Analysis started with ID:', result.analysisId);
        console.log('⏳ Waiting 3 seconds before redirect to see defect appear...');
        
        // Wait 3 seconds to let QStash process
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } else if (!result.analysisId) {
        console.error('❌ No analysisId in response!', result);
        alert('Analysis did not start correctly. Please try again.');
        return; // ❌ stop here
      }
  

  
  // ✅ Navigate only if job started successfully
      console.log('🔄 Redirecting to image editor...');
      window.location.href = `/image-editor/?inspectionId=${selectedInspectionId}`;
    } catch (error: any) {
      console.error('❌ Submission error:', error);
      alert('Unexpected error occurred while submitting. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  

  // Color options for all tools (arrow, circle, square)
  const toolColors = ['#d63636', '#FF8C00', '#0066CC', '#10b981', '#800080']; // red, orange, blue, green, purple

  // Function to handle color selection for all tools
  const handleColorSelection = (color: string) => {
    setSelectedColor(color);
    
    // Dispatch events to set colors for all tools simultaneously
    const arrowEvent = new CustomEvent('setArrowColor', { detail: color });
    const circleEvent = new CustomEvent('setCircleColor', { detail: color });
    const squareEvent = new CustomEvent('setSquareColor', { detail: color });
    
    window.dispatchEvent(arrowEvent);
    window.dispatchEvent(circleEvent);
    window.dispatchEvent(squareEvent);
    
    console.log('Color synchronized across all tools:', color);
  };

  if (isSubmitting) {
    return (
      <div style={{ position: "relative", display: "inline-block" }}>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(255,255,255,0.7)",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 999,
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                border: "5px solid #e5e7eb",
                borderTop: "5px solid #8230c9",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
            {/* Inline keyframes */}
            <style>{`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <style jsx>{`
        .location-btn, .main-location-btn, .section-btn, .sub-location-btn, .location2-btn {
          background: linear-gradient(135deg, rgb(75, 108, 183) 0%, rgb(106, 17, 203) 100%) !important;
          color: white !important;
          border: none !important;
          padding: 18px 24px !important;
          border-radius: 12px !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.3s ease !important;
          box-shadow: 0 4px 20px rgba(75, 108, 183, 0.3) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          letter-spacing: 0.3px !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          width: 300px !important;
          height: 60px !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .location-btn:hover, .main-location-btn:hover, .section-btn:hover, .sub-location-btn:hover, .location2-btn:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 8px 30px rgba(75, 108, 183, 0.4) !important;
          background: linear-gradient(135deg, rgb(106, 17, 203) 0%, rgb(75, 108, 183) 100%) !important;
        }
        .location-btn:active, .main-location-btn:active, .section-btn:active, .sub-location-btn:active, .location2-btn:active {
          transform: translateY(-1px) !important;
          box-shadow: 0 4px 20px rgba(75, 108, 183, 0.3) !important;
        }
      `}</style>
      
      {/* First Heading */}
      {/* <div className="heading-section">
        <div className="heading-content">
          <i className="fas fa-image heading-icon"></i>
          <h1>Advanced Image Editor</h1>
          <p>Edit your images with drawing and cropping tools</p>
          {selectedInspectionId && (
            <p className="text-sm text-gray-600 mt-1">
              Inspection ID: {selectedInspectionId}
            </p>
          )}
        </div>
      </div> */}

      {/* Action Options Bar */}
      <div className="action-bar">
        {/* Done button for annotation mode */}
        {returnTo && checklistId && (
          <button 
            className="action-btn done-btn"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              backgroundColor: '#059669',
              color: 'white',
              padding: '8px 20px',
              fontWeight: '600',
              fontSize: '14px',
              marginLeft: 'auto',
              marginRight: '10px'
            }}
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-check" style={{ marginRight: '8px' }}></i>
                Done
              </>
            )}
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
            {activeMode === 'crop' 
              ? (hasCropFrame ? 'Apply' : '') 
              : ''
            }
          </span>
        </button>
        
        {/* Arrow button with dropdown */}
        <div className="arrow-button-container" ref={drawingDropdownRef}>
          <button 
            className={`action-btn arrow-btn ${activeMode === 'arrow' ? 'active' : ''}`}
            onClick={() => handleActionClick('arrow')}
          >
            <i className="fas fa-pencil-alt"></i>
            <span className="btn-text">{activeMode === 'arrow' ? '' : ''}</span>
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
              <div className="color-sync-notice">
                
              </div>
            </div>
          )}
        </div>

        {/* Circle button with dropdown */}
        <div className="circle-button-container" ref={circleDropdownRef}>
          <button 
            className={`action-btn circle-btn ${activeMode === 'circle' ? 'active' : ''}`}
            onClick={() => handleActionClick('circle')}
          >
           <i className="far fa-circle thick-circle"></i>




            <span className="btn-text">{activeMode === 'circle' ? '' : ''}</span>
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
              <div className="color-sync-notice">
                
              </div>
            </div>
          )}
        </div>

        {/* Square button with dropdown */}
        <div className="square-button-container" ref={squareDropdownRef}>
          <button 
            className={`action-btn square-btn ${activeMode === 'square' ? 'active' : ''}`}
            onClick={() => handleActionClick('square')}
          >
            <i className="far fa-square thick-square"></i> 
            <span className="btn-text">{activeMode === 'square' ? '' : ''}</span>
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
              <div className="color-sync-notice">
                
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
      <div className="image-upload-area">
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

      {/* Second Heading */}
      {/* <div className="heading-section">
        <div className="heading-content">
          <i className="fas fa-edit heading-icon"></i>
          <h2>Image Description</h2>
          <p>Add details about your edited image</p>
        </div>
      </div> */}

       {/* Description Box - Only show for defect workflow (but not in defect-main annotate mode) */}
       {!returnTo && !checklistId && !isDefectMainMode && (
         <div className="description-box">
           <textarea
             placeholder="Describe your edited image here..."
             value={description}
             onChange={(e) => setDescription(e.target.value)}
           />

           {/* 360° Photo Checkbox */}
           <div style={{
             display: 'flex',
             alignItems: 'center',
             gap: '10px',
             marginTop: '12px',
             padding: '12px',
             background: 'linear-gradient(135deg, rgba(75, 108, 183, 0.1) 0%, rgba(106, 17, 203, 0.1) 100%)',
             borderRadius: '8px',
             border: '1px solid rgba(75, 108, 183, 0.2)'
           }}>
             <input
               type="checkbox"
               id="threeSixtyCheckbox"
               checked={isThreeSixty}
               onChange={(e) => setIsThreeSixty(e.target.checked)}
               style={{
                 width: '18px',
                 height: '18px',
                 cursor: 'pointer',
                 accentColor: '#4b6cb7'
               }}
             />
             <label
               htmlFor="threeSixtyCheckbox"
               style={{
                 fontSize: '15px',
                 fontWeight: '500',
                 color: '#2d3748',
                 cursor: 'pointer',
                 userSelect: 'none',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '6px'
               }}
             >
               <i className="fas fa-sync-alt" style={{ color: '#4b6cb7' }}></i>
               This is a 360° photo
             </label>
           </div>
         </div>
       )}

      {/* Submit Section - Only show for defect workflow, additional location mode, or defect-main annotate mode */}
      {(!returnTo && !checklistId) || isAdditionalLocationMode || isDefectMainMode ? (
        <div className="submit-section">
          <div className="submit-controls">

          {/* Location Button with Dropdown - Hide in defect-main annotate mode */}
          {!isDefectMainMode && (
          <div className="location-button-container">
            <button
              className="location-btn location2-btn"
              onClick={() => setShowLocationDropdown2(!showLocationDropdown2)}
              style={{
                background: 'linear-gradient(135deg, rgb(75, 108, 183) 0%, rgb(106, 17, 203) 100%) !important',
                color: 'white !important',
                padding: '18px 24px !important',
                borderRadius: '12px !important',
                fontSize: '16px !important',
                fontWeight: '600 !important',
                cursor: 'pointer !important',
                transition: 'all 0.3s ease !important',
                boxShadow: '0 4px 20px rgba(75, 108, 183, 0.3) !important',
                display: 'flex !important',
                alignItems: 'center !important',
                justifyContent: 'space-between !important',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif !important',
                letterSpacing: '0.3px !important',
                border: '1px solid rgba(255, 255, 255, 0.1) !important',
                width: '300px !important',
                height: '60px !important',
                whiteSpace: 'nowrap !important',
                overflow: 'hidden !important',
                textOverflow: 'ellipsis !important'
              }}
            >
              <div className="btn-content">
                <i className="fas fa-map-marker-alt"></i>
                <span>{selectedLocation2 || 'Location'}</span>
              </div>
              <i className={`fas fa-chevron-down ${showLocationDropdown2 ? 'rotate' : ''}`}></i>
            </button>
            
            {showLocationDropdown2 && (
              <div className="location-dropdown location2-dropdown" ref={locationDropdownRef2}>
                <div className="location-search-container">
                  <input
                    type="text"
                    placeholder="Search locations..."
                    value={locationSearch2}
                    onChange={(e) => setLocationSearch2(e.target.value)}
                    className="location-search-input"
                  />
                </div>
                 <div className="location-options">
                   {filteredLocations.map(locationItem => (
                     <div 
                       key={locationItem}
                       className={`location-option ${selectedLocation2 === locationItem ? 'selected' : ''}`}
                       onClick={() => {
                         setSelectedLocation2(locationItem);
                         setShowLocationDropdown2(false);
                         setLocationSearch2('');
                       }}
                     >
                       <i className="fas fa-map-marker-alt"></i>
                       <span>{locationItem}</span>
                     </div>
                   ))}
                 </div>
              </div>
            )}
          </div>
          )}

          {/* Section and Subsection - Hide in additional location mode and defect-main annotate mode */}
          {!isAdditionalLocationMode && !isDefectMainMode && (
            <>
          {/* Section Button with Dropdown */}
          <div className="location-button-container">
            <button 
              className="location-btn section-btn"
              onClick={() => setShowLocationDropdown(!showLocationDropdown)}
              style={{
                background: 'linear-gradient(135deg, rgb(75, 108, 183) 0%, rgb(106, 17, 203) 100%) !important',
                color: 'white !important',
                padding: '18px 24px !important',
                borderRadius: '12px !important',
                fontSize: '16px !important',
                fontWeight: '600 !important',
                cursor: 'pointer !important',
                transition: 'all 0.3s ease !important',
                boxShadow: '0 4px 20px rgba(75, 108, 183, 0.3) !important',
                display: 'flex !important',
                alignItems: 'center !important',
                justifyContent: 'space-between !important',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif !important',
                letterSpacing: '0.3px !important',
                border: '1px solid rgba(255, 255, 255, 0.1) !important',
                width: '300px !important',
                height: '60px !important',
                whiteSpace: 'nowrap !important',
                overflow: 'hidden !important',
                textOverflow: 'ellipsis !important'
              }}
            >
              <div className="btn-content">
              <i className="fas fa-map-marker-alt"></i>
              <span>{selectedLocation || 'Section'}</span>
              </div>
              <i className={`fas fa-chevron-down ${showLocationDropdown ? 'rotate' : ''}`}></i>
            </button>
            
            {showLocationDropdown && (
              <div className="location-dropdown" ref={locationDropdownRef}>
                <div className="location-search-container">
                  <input
                    type="text"
                    placeholder="Search location..."
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    className="location-search-input"
                  />
                </div>
                 <div className="location-options">
                   {filteredSections.map(sectionItem => (
                     <div 
                       key={sectionItem}
                       className={`location-option ${selectedLocation === sectionItem ? 'selected' : ''}`}
                       onClick={() => {
                         setSelectedLocation(sectionItem);
                         setShowLocationDropdown(false);
                         setLocationSearch('');
                         setSelectedSubLocation(''); // Reset sub-location when main location changes
                         setSubLocationSearch(''); // Reset sub-location search
                         setShowSubLocationDropdown(false); // Hide sub-location dropdown initially
                       }}
                     >
                       <i className="fas fa-map-marker-alt"></i>
                       <span>{sectionItem}</span>
                     </div>
                   ))}
                 </div>
              </div>
            )}
          </div>

          {/* Sub-Location Dropdown */}
          <div className="location-button-container">
            <button 
              className={`location-btn sub-location-btn ${!selectedLocation ? 'disabled' : ''}`}
              onClick={() => selectedLocation && setShowSubLocationDropdown(!showSubLocationDropdown)}
              disabled={!selectedLocation}
              style={{
                background: 'linear-gradient(135deg, rgb(75, 108, 183) 0%, rgb(106, 17, 203) 100%) !important',
                color: 'white !important',
                padding: '18px 24px !important',
                borderRadius: '12px !important',
                fontSize: '16px !important',
                fontWeight: '600 !important',
                cursor: 'pointer !important',
                transition: 'all 0.3s ease !important',
                boxShadow: '0 4px 20px rgba(75, 108, 183, 0.3) !important',
                display: 'flex !important',
                alignItems: 'center !important',
                justifyContent: 'space-between !important',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif !important',
                letterSpacing: '0.3px !important',
                border: '1px solid rgba(255, 255, 255, 0.1) !important',
                width: '300px !important',
                height: '60px !important',
                whiteSpace: 'nowrap !important',
                overflow: 'hidden !important',
                textOverflow: 'ellipsis !important',
                opacity: !selectedLocation ? '0.5 !important' : '1 !important'
              }}
            >
              <div className="btn-content">
                <i className="fas fa-layer-group"></i>
                <span>{selectedSubLocation || 'Sub Section'}</span>
              </div>
              <i className={`fas fa-chevron-down ${showSubLocationDropdown ? 'rotate' : ''}`}></i>
            </button>
            
            {showSubLocationDropdown && selectedLocation && (
              <div className="location-dropdown sub-location-dropdown" ref={subLocationDropdownRef}>
                <div className="location-search-container">
                  <input
                    type="text"
                    placeholder="Search sub-location..."
                    value={subLocationSearch}
                    onChange={(e) => setSubLocationSearch(e.target.value)}
                    className="location-search-input"
                  />
                </div>
                 <div className="location-options">
                   {filteredSubsections.map(subLocation => (
                     <div 
                       key={subLocation}
                       className={`location-option ${selectedSubLocation === subLocation ? 'selected' : ''}`}
                       onClick={() => {
                         setSelectedSubLocation(subLocation);
                         setShowSubLocationDropdown(false);
                         setSubLocationSearch('');
                       }}
                     >
                       <i className="fas fa-layer-group"></i>
                       <span>{subLocation}</span>
                     </div>
                   ))}
                 </div>
              </div>
            )}
          </div>
          </>
          )}

          {/* Submit Button - Change text based on mode */}
          <button className="submit-btn" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                {isDefectMainMode ? 'Saving...' : isAdditionalLocationMode ? 'Adding Photo...' : 'Processing...'}
              </>
            ) : (
              isDefectMainMode ? 'Save Changes' : isAdditionalLocationMode ? 'Add Photo' : 'Submit'
            )}
          </button>
        </div>
        </div>
      ) : null}
    </div>
  );
}

export default function ImageEditorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <ImageEditorPageContent />
    </Suspense>
  );
}