"use client";

import { useSearchParams, useRouter } from 'next/navigation';
import ImageEditor from '../../../../components/ImageEditor';
import { useState, useRef, useEffect, Suspense } from 'react';
import { toast } from 'sonner';
import { useSpeechToText } from '@/src/lib/useSpeechToText';

function ImageEditorPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const selectedInspectionId = searchParams.get('inspectionId') || '';
  const preloadImageUrl = searchParams.get('imageUrl') || searchParams.get('src');
  const returnTo = searchParams.get('returnTo');
  const checklistId = searchParams.get('checklistId');
  const mode = searchParams.get('mode');
  const defectId = searchParams.get('defectId');
  const editIndexParam = searchParams.get('index');
  
  const isAdditionalLocationMode = mode === 'additional-location' && defectId;
  const isEditAdditionalMode = mode === 'edit-additional' && defectId && typeof editIndexParam === 'string';
  const isDefectMainMode = mode === 'defect-main' && defectId;
  
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
  const drawingDropdownRef = useRef<HTMLDivElement>(null);
  const circleDropdownRef = useRef<HTMLDivElement>(null);
  const squareDropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef = useRef<HTMLDivElement>(null);
  const subLocationDropdownRef = useRef<HTMLDivElement>(null);
  const locationDropdownRef2 = useRef<HTMLDivElement>(null);
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

  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const [customSections, setCustomSections] = useState<string[]>([]);
  const [customSubsections, setCustomSubsections] = useState<{ [key: string]: string[] }>({});

  const [inspectionCustomLocations, setInspectionCustomLocations] = useState<string[]>([]);
  const [inspectionCustomSections, setInspectionCustomSections] = useState<string[]>([]);
  const [inspectionCustomSubsections, setInspectionCustomSubsections] = useState<{ [key: string]: string[] }>({});

  const [showAddLocation, setShowAddLocation] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showAddSubSection, setShowAddSubSection] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState('');
  const [newSectionInput, setNewSectionInput] = useState('');
  const [newSubSectionInput, setNewSubSectionInput] = useState('');

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

  // Combine default, template custom, and inspection-specific items, then filter
  const allSections = [...section, ...customSections, ...inspectionCustomSections];
  const filteredSections = allSections.filter(sectionItem =>
    sectionItem.toLowerCase().includes(locationSearch.toLowerCase())
  );

  // Combine default, template, and inspection-specific subsections for selected section
  const allSubsectionsForSection = selectedLocation
    ? [
        ...(subsection[selectedLocation as keyof typeof subsection] || []),
        ...(customSubsections[selectedLocation] || []),
        ...(inspectionCustomSubsections[selectedLocation] || [])
      ]
    : [];
  const filteredSubsections = allSubsectionsForSection.filter(subLocation =>
    subLocation.toLowerCase().includes(subLocationSearch.toLowerCase())
  );

  // Combine default, template custom, and inspection-specific locations
  const allLocations = [...location, ...customLocations, ...inspectionCustomLocations];
  const filteredLocations = allLocations.filter(locationItem =>
    locationItem.toLowerCase().includes(locationSearch2.toLowerCase())
  );

  // Fetch inspection data to get location info for classify API
  useEffect(() => {
    if (selectedInspectionId) {
      const fetchInspection = async () => {
        try {
          const response = await fetch(`/api/inspections/${selectedInspectionId}`);
          if (response.ok) {
            const inspection = await response.json();
            if (inspection && inspection.location) {
              setInspectionState(inspection.location.state || '');
              setInspectionCity(inspection.location.city || '');
              setInspectionZipCode(inspection.location.zip || '');
            }
          }
        } catch (error) {
        }
      };
      fetchInspection();
    }
  }, [selectedInspectionId]);

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
              setSelectedLocation(parentDefect.section || '');
              setSelectedSubLocation(parentDefect.subsection || '');
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
    
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(preloadImageUrl)}`;
      
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
            alert('Failed to load image from object URL. Please try again.');
          };
          img.src = objectUrl;
        })
        .catch(err => {
          alert(`Failed to load image: ${err.message}. Please try again.`);
        });
    }
  }, [preloadImageUrl]);

  // Load annotations from localStorage for defect-main mode
  useEffect(() => {
    if (isDefectMainMode) {
      const annotationsJson = localStorage.getItem('defectAnnotations');
      if (annotationsJson) {
        try {
          const annotations = JSON.parse(annotationsJson);
          setPreloadedAnnotations(annotations);
        } catch (e) {
          console.log(e);
        }
      } else {
        setPreloadedAnnotations([]);
      }
    }
  }, [isDefectMainMode]);

  useEffect(() => {
    try {
      // Load TEMPLATE items (global - all inspections)
      const savedLocations = localStorage.getItem('customLocations');
      const savedSections = localStorage.getItem('customSections');
      const savedSubsections = localStorage.getItem('customSubsections');

      if (savedLocations) setCustomLocations(JSON.parse(savedLocations));
      if (savedSections) setCustomSections(JSON.parse(savedSections));
      if (savedSubsections) setCustomSubsections(JSON.parse(savedSubsections));

      // Load INSPECTION-SPECIFIC items (this inspection only)
      if (selectedInspectionId) {
        const inspLocKey = `inspection_custom_locations_${selectedInspectionId}`;
        const inspSecKey = `inspection_custom_sections_${selectedInspectionId}`;
        const inspSubKey = `inspection_custom_subsections_${selectedInspectionId}`;

        const inspLoc = localStorage.getItem(inspLocKey);
        const inspSec = localStorage.getItem(inspSecKey);
        const inspSub = localStorage.getItem(inspSubKey);

        if (inspLoc) setInspectionCustomLocations(JSON.parse(inspLoc));
        if (inspSec) setInspectionCustomSections(JSON.parse(inspSec));
        if (inspSub) setInspectionCustomSubsections(JSON.parse(inspSub));
      }
    } catch (e) {
      console.log(e);
    }
  }, [selectedInspectionId]);

  // actions for editing images
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

  // Add new location
  const handleAddLocation = (isTemplate: boolean) => {
    if (!newLocationInput.trim()) return;

    const newItem = newLocationInput.trim();

    if (isTemplate) {
      const updated = [...customLocations, newItem];
      setCustomLocations(updated);
      localStorage.setItem('customLocations', JSON.stringify(updated));
    } else {
      const updated = [...inspectionCustomLocations, newItem];
      setInspectionCustomLocations(updated);
      localStorage.setItem(`inspection_custom_locations_${selectedInspectionId}`, JSON.stringify(updated));
    }

    setSelectedLocation2(newItem);
    setNewLocationInput('');
    setShowAddLocation(false);
    setShowLocationDropdown2(false);
  };

  // Add new section
  const handleAddSection = (isTemplate: boolean) => {
    if (!newSectionInput.trim()) return;

    const newItem = newSectionInput.trim();

    if (isTemplate) {
      // Save to Template (all inspections)
      const updated = [...customSections, newItem];
      setCustomSections(updated);
      localStorage.setItem('customSections', JSON.stringify(updated));
      const updatedSubsections = { ...customSubsections, [newItem]: [] };
      setCustomSubsections(updatedSubsections);
      localStorage.setItem('customSubsections', JSON.stringify(updatedSubsections));
    } else {
      const updated = [...inspectionCustomSections, newItem];
      setInspectionCustomSections(updated);
      localStorage.setItem(`inspection_custom_sections_${selectedInspectionId}`, JSON.stringify(updated));
      // Initialize empty subsection array for new section
      const updatedSubsections = { ...inspectionCustomSubsections, [newItem]: [] };
      setInspectionCustomSubsections(updatedSubsections);
      localStorage.setItem(`inspection_custom_subsections_${selectedInspectionId}`, JSON.stringify(updatedSubsections));
    }

    setSelectedLocation(newItem);
    setNewSectionInput('');
    setShowAddSection(false);
    setShowLocationDropdown(false);
  };

  // Add new subsection
  const handleAddSubSection = (isTemplate: boolean) => {
    if (!newSubSectionInput.trim() || !selectedLocation) return;

    const newItem = newSubSectionInput.trim();

    if (isTemplate) {
      // Save to Template (all inspections)
      const updated = { ...customSubsections };
      if (!updated[selectedLocation]) {
        updated[selectedLocation] = [];
      }
      updated[selectedLocation] = [...updated[selectedLocation], newItem];
      setCustomSubsections(updated);
      localStorage.setItem('customSubsections', JSON.stringify(updated));
    } else {
      // Add to This Inspection Only
      const updated = { ...inspectionCustomSubsections };
      if (!updated[selectedLocation]) {
        updated[selectedLocation] = [];
      }
      updated[selectedLocation] = [...updated[selectedLocation], newItem];
      setInspectionCustomSubsections(updated);
      localStorage.setItem(`inspection_custom_subsections_${selectedInspectionId}`, JSON.stringify(updated));
    }

    setSelectedSubLocation(newItem);
    setNewSubSectionInput('');
    setShowAddSubSection(false);
    setShowSubLocationDropdown(false);
  };

  // Delete custom location
  const handleDeleteLocation = (item: string, isTemplate: boolean) => {
    if (isTemplate) {
      const updated = customLocations.filter(loc => loc !== item);
      setCustomLocations(updated);
      localStorage.setItem('customLocations', JSON.stringify(updated));
    } else {
      const updated = inspectionCustomLocations.filter(loc => loc !== item);
      setInspectionCustomLocations(updated);
      localStorage.setItem(`inspection_custom_locations_${selectedInspectionId}`, JSON.stringify(updated));
    }
    if (selectedLocation2 === item) setSelectedLocation2('');
  };

  // Delete custom section
  const handleDeleteSection = (item: string, isTemplate: boolean) => {
    if (isTemplate) {
      const updated = customSections.filter(sec => sec !== item);
      setCustomSections(updated);
      localStorage.setItem('customSections', JSON.stringify(updated));
    } else {
      const updated = inspectionCustomSections.filter(sec => sec !== item);
      setInspectionCustomSections(updated);
      localStorage.setItem(`inspection_custom_sections_${selectedInspectionId}`, JSON.stringify(updated));
    }
    if (selectedLocation === item) setSelectedLocation('');
  };

  // Delete custom subsection
  const handleDeleteSubSection = (item: string, isTemplate: boolean) => {
    if (!selectedLocation) return;

    if (isTemplate) {
      const updated = { ...customSubsections };
      updated[selectedLocation] = updated[selectedLocation].filter(sub => sub !== item);
      setCustomSubsections(updated);
      localStorage.setItem('customSubsections', JSON.stringify(updated));
    } else {
      const updated = { ...inspectionCustomSubsections };
      updated[selectedLocation] = updated[selectedLocation].filter(sub => sub !== item);
      setInspectionCustomSubsections(updated);
      localStorage.setItem(`inspection_custom_subsections_${selectedInspectionId}`, JSON.stringify(updated));
    }
    if (selectedSubLocation === item) setSelectedSubLocation('');
  };

  const handleCropStateChange = (hasFrame: boolean) => {
    setHasCropFrame(hasFrame);
  };


  const handleSubmit = async () => {
    // Special handling for additional location photos
    if (isAdditionalLocationMode && defectId) {
      if (!editedFile) {
        alert('Please upload and edit an image before submitting.');
        return;
      }

      if (!selectedLocation2) {
        alert('Please select a location for this photo.');
        return;
      }

      setIsSubmitting(true);

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
          // Unable to write to localStorage
        }

        
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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Failed to add location photo: ${errorMessage}`);
        setIsSubmitting(false);
      }
      
      return; // Exit early for additional location flow
    }

    // Special handling for editing main defect image
    if (isDefectMainMode && defectId) {
      if (!editedFile) {
        alert('Please upload and edit an image before submitting.');
        return;
      }

      setIsSubmitting(true);

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
        // If there's an original image in localStorage, save it too
        const originalImageUrl = localStorage.getItem('defectOriginalImage');

        const updatePayload = {
          inspection_id: currentDefect.inspection_id,
          image: uploadData.url,
          annotations: currentAnnotations,
          originalImage: originalImageUrl || currentDefect.originalImage || uploadData.url
        };

        const updateRes = await fetch(`/api/defects/${defectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });

        if (!updateRes.ok) {
          const errorText = await updateRes.text();
          throw new Error('Failed to update defect');
        }

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
          // Unable to write to localStorage
        }

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
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Failed to update defect image: ${errorMessage}`);
        setIsSubmitting(false);
      }

      return; // Exit early for main defect image flow
    }

    // Special handling for editing an existing additional location photo
    if (isEditAdditionalMode && defectId) {
      if (!editedFile) {
        alert('Please upload and edit an image before submitting.');
        return;
      }

      setIsSubmitting(true);

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
          // Unable to write to localStorage
        }

        setTimeout(() => {
          window.close();
          setTimeout(() => {
            if (!window.closed) {
              router.push(`/inspection_report/${selectedInspectionId}`);
            }
          }, 100);
        }, 500);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Failed to save edited photo: ${errorMessage}`);
        setIsSubmitting(false);
      }

      return; // Exit early for edit-additional flow
    }

    // Special handling for information block annotation
    if (returnTo && checklistId) {
      if (!editedFile) {
        alert('Please make some changes to the image before saving (draw arrows, circles, etc.).');
        return;
      }

      setIsSubmitting(true);

      try {
        // Upload the annotated image to R2
        const formData = new FormData();
        formData.append('file', editedFile);

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
        } catch (storageError) {
          // Continue anyway - the image was uploaded successfully
        }

        
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
                // Use location.href for full page reload which guarantees:
                // 1. Window focus event fires
                // 2. Polling mechanism starts fresh
                // 3. returnToSection is detected and modal reopens
                window.location.href = returnTo || window.location.origin + '/';
              }
            }, 100);
          } catch (error) {
            // Fallback: reload the page
            window.location.href = returnTo || window.location.origin + '/';
          }
        }, 500);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Failed to save annotated image: ${errorMessage}\n\nPlease try again or check your internet connection.`);
        setIsSubmitting(false);
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
          state: inspectionState, // Pass state for classify API
          city: inspectionCity, // Pass city for classify API
          zipCode: inspectionZipCode, // Pass zipCode for classify API
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        alert(`Analysis request failed: ${errorText}`);
        return; // ❌ stop here
      }
      
      const result = await response.json();
      
      // Show success toast
      toast.success('You can see the details in the report once it is ready');
      
      // Check if the analysis was accepted and started
      if (response.status === 202) {
        // Analysis is processing in the background
        // Wait 3 seconds to let QStash process
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } else if (!result.analysisId) {
        alert('Analysis did not start correctly. Please try again.');
        return; // ❌ stop here
      }
  
  

  // ✅ Navigate only if job started successfully
      window.location.href = `/image-editor/?inspectionId=${selectedInspectionId}`;
    } catch (error: any) {
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
  };

  if (isSubmitting) {
    return (
      <div className="relative inline-block">
          <div className="fixed top-0 left-0 w-full h-full bg-white/70 flex justify-center items-center z-[999]">
            <div className="w-12 h-12 border-[5px] border-gray-200 border-t-[#8230c9] rounded-full animate-spin" />
          </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      
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
            className="action-btn done-btn bg-emerald-600 text-white px-5 py-2 font-semibold text-sm ml-auto mr-2.5"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-check mr-2"></i>
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



       {/* Description Box - Only show for defect workflow (but not in defect-main annotate mode) */}
       {!returnTo && !checklistId && !isDefectMainMode && (
        <>
        
          <p className="mb-2 px-3 py-2 rounded bg-blue-50 border-l-4 border-blue-400 text-blue-800 text-sm font-medium shadow-sm">
            For optimal results, speak clearly and pause between lines. Your dictation will automatically appear in the description below.
          </p>
         <div className="description-box">
           <div className="relative">
             <textarea
               placeholder="Describe your edited image here..."
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               className="pr-12"
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

      {/* Submit Section - Only show for defect workflow, additional location mode, or defect-main annotate mode */}
      {(!returnTo && !checklistId) || isAdditionalLocationMode || isDefectMainMode ? (
        <div className="submit-section">
          <div className="submit-controls">

          {/* Location Button with Dropdown - Hide in defect-main annotate mode */}
          {!isDefectMainMode && (
          <div className="location-button-container">
            <button
              className="location-btn location2-btn bg-gradient-to-br from-[rgb(75,108,183)] to-[rgb(106,17,203)] text-white px-6 py-[18px] rounded-xl text-base font-semibold cursor-pointer transition-all duration-300 shadow-[0_4px_20px_rgba(75,108,183,0.3)] flex items-center justify-between font-['Inter',sans-serif] tracking-[0.3px] border border-white/10 w-[300px] h-[60px] whitespace-nowrap overflow-hidden text-ellipsis hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(75,108,183,0.4)] hover:bg-gradient-to-br hover:from-[rgb(106,17,203)] hover:to-[rgb(75,108,183)] active:-translate-y-px active:shadow-[0_4px_20px_rgba(75,108,183,0.3)]"
              onClick={() => setShowLocationDropdown2(!showLocationDropdown2)}
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
                   {/* Add New Location button */}
                   {!showAddLocation && (
                     <div
                       className="location-option add-new-option border-b border-gray-200 text-[#6a11cb] font-semibold"
                       onClick={() => setShowAddLocation(true)}
                     >
                       <i className="fas fa-plus-circle"></i>
                       <span>Add New Location</span>
                     </div>
                   )}

                   {/* Inline input for adding new location */}
                   {showAddLocation && (
                     <div className="add-new-input-container p-2 border-b border-gray-200">
                       <input
                         type="text"
                         placeholder="Enter new location..."
                         value={newLocationInput}
                         onChange={(e) => setNewLocationInput(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter') handleAddLocation(false);
                           if (e.key === 'Escape') {
                             setShowAddLocation(false);
                             setNewLocationInput('');
                           }
                         }}
                         autoFocus
                         className="location-search-input mb-2"
                       />
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => handleAddLocation(false)}
                          className="w-full py-1.5 px-2 bg-blue-500 text-white border-none rounded cursor-pointer text-[10px] font-semibold leading-tight text-center whitespace-normal"
                          title="Add only to this inspection"
                        >
                          Add To This Inspection
                        </button>
                        <button
                          onClick={() => handleAddLocation(true)}
                          className="w-full py-1.5 px-2 bg-[#6a11cb] text-white border-none rounded cursor-pointer text-[10px] font-semibold leading-tight text-center whitespace-normal"
                          title="Save to template (all inspections)"
                        >
                          Save to Template
                        </button>
                        <button
                          onClick={() => {
                            setShowAddLocation(false);
                            setNewLocationInput('');
                          }}
                          className="w-full py-1 px-2 bg-gray-200 text-gray-700 border-none rounded cursor-pointer text-[10px] font-medium"
                        >
                          Cancel
                        </button>
                        <div className="text-[9px] text-gray-500 py-0.5 leading-tight">
                          💡 Add = only this inspection • Save = all inspections
                        </div>
                      </div>
                     </div>
                   )}

                   {filteredLocations.map(locationItem => {
                     const isTemplateCustom = customLocations.includes(locationItem);
                     const isInspectionCustom = inspectionCustomLocations.includes(locationItem);
                     const isCustom = isTemplateCustom || isInspectionCustom;
                     return (
                       <div
                         key={locationItem}
                         className={`location-option ${selectedLocation2 === locationItem ? 'selected' : ''} flex items-center justify-between`}
                       >
                         <div
                           className="flex-1 flex items-center"
                           onClick={() => {
                             setSelectedLocation2(locationItem);
                             setShowLocationDropdown2(false);
                             setLocationSearch2('');
                           }}
                         >
                           <i className="fas fa-map-marker-alt"></i>
                           <span>{locationItem}</span>
                           {isInspectionCustom && (
                             <span className="text-[10px] ml-1.5 text-blue-500 font-semibold">
                               (This Inspection)
                             </span>
                           )}
                         </div>
                         {isCustom && (
                           <i
                             className="fas fa-trash-alt text-red-500 cursor-pointer py-1 px-2 text-sm"
                             onClick={(e) => {
                               e.stopPropagation();
                               if (confirm(`Delete "${locationItem}"?`)) {
                                 handleDeleteLocation(locationItem, isTemplateCustom);
                               }
                             }}
                             title={isTemplateCustom ? 'Delete from template' : 'Delete from this inspection'}
                           />
                         )}
                       </div>
                     );
                   })}
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
              className="location-btn section-btn bg-gradient-to-br from-[rgb(75,108,183)] to-[rgb(106,17,203)] text-white px-6 py-[18px] rounded-xl text-base font-semibold cursor-pointer transition-all duration-300 shadow-[0_4px_20px_rgba(75,108,183,0.3)] flex items-center justify-between font-['Inter',sans-serif] tracking-[0.3px] border border-white/10 w-[300px] h-[60px] whitespace-nowrap overflow-hidden text-ellipsis hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(75,108,183,0.4)] hover:bg-gradient-to-br hover:from-[rgb(106,17,203)] hover:to-[rgb(75,108,183)] active:-translate-y-px active:shadow-[0_4px_20px_rgba(75,108,183,0.3)]"
              onClick={() => setShowLocationDropdown(!showLocationDropdown)}
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
                   {/* Add New Section button */}
                   {!showAddSection && (
                     <div
                       className="location-option add-new-option border-b border-gray-200 text-[#6a11cb] font-semibold"
                       onClick={() => setShowAddSection(true)}
                     >
                       <i className="fas fa-plus-circle"></i>
                       <span>Add New Section</span>
                     </div>
                   )}

                   {/* Inline input for adding new section */}
                   {showAddSection && (
                     <div className="add-new-input-container p-2 border-b border-gray-200">
                       <input
                         type="text"
                         placeholder="Enter new section..."
                         value={newSectionInput}
                         onChange={(e) => setNewSectionInput(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter') handleAddSection(false);
                           if (e.key === 'Escape') {
                             setShowAddSection(false);
                             setNewSectionInput('');
                           }
                         }}
                         autoFocus
                         className="location-search-input mb-2"
                       />
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => handleAddSection(false)}
                          className="w-full py-1.5 px-2 bg-blue-500 text-white border-none rounded cursor-pointer text-[10px] font-semibold leading-tight text-center whitespace-normal"
                          title="Add only to this inspection"
                        >
                          Add To This Inspection
                        </button>
                        <button
                          onClick={() => handleAddSection(true)}
                          className="w-full py-1.5 px-2 bg-[#6a11cb] text-white border-none rounded cursor-pointer text-[10px] font-semibold leading-tight text-center whitespace-normal"
                          title="Save to template (all inspections)"
                        >
                          Save to Template
                        </button>
                        <button
                          onClick={() => {
                            setShowLocationDropdown(false);
                            setLocationSearch('');
                          }}
                          className="w-full py-1 px-2 bg-gray-200 text-gray-700 border-none rounded cursor-pointer text-[10px] font-medium"
                        >
                          Cancel
                        </button>
                        <div className="text-[9px] text-gray-500 py-0.5 leading-tight">
                          💡 Add = only this inspection • Save = all inspections
                        </div>
                      </div>
                     </div>
                   )}

                   {filteredSections.map(sectionItem => {
                     const isTemplateCustom = customSections.includes(sectionItem);
                     const isInspectionCustom = inspectionCustomSections.includes(sectionItem);
                     const isCustom = isTemplateCustom || isInspectionCustom;
                     return (
                       <div
                         key={sectionItem}
                         className={`location-option ${selectedLocation === sectionItem ? 'selected' : ''} flex items-center justify-between`}
                       >
                         <div
                           className="flex-1 flex items-center"
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
                           {isInspectionCustom && (
                             <span className="text-[10px] ml-1.5 text-blue-500 font-semibold">
                               (This Inspection)
                             </span>
                           )}
                         </div>
                         {isCustom && (
                           <i
                             className="fas fa-trash-alt text-red-500 cursor-pointer py-1 px-2 text-sm"
                             onClick={(e) => {
                               e.stopPropagation();
                               if (confirm(`Delete "${sectionItem}"?`)) {
                                 handleDeleteSection(sectionItem, isTemplateCustom);
                               }
                             }}
                             title={isTemplateCustom ? 'Delete from template' : 'Delete from this inspection'}
                           />
                         )}
                       </div>
                     );
                   })}
                 </div>
              </div>
            )}
          </div>

          {/* Sub-Location Dropdown */}
          <div className="location-button-container">
            <button 
              className={`location-btn sub-location-btn ${!selectedLocation ? 'disabled opacity-50' : ''} bg-gradient-to-br from-[rgb(75,108,183)] to-[rgb(106,17,203)] text-white px-6 py-[18px] rounded-xl text-base font-semibold cursor-pointer transition-all duration-300 shadow-[0_4px_20px_rgba(75,108,183,0.3)] flex items-center justify-between font-['Inter',sans-serif] tracking-[0.3px] border border-white/10 w-[300px] h-[60px] whitespace-nowrap overflow-hidden text-ellipsis hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(75,108,183,0.4)] hover:bg-gradient-to-br hover:from-[rgb(106,17,203)] hover:to-[rgb(75,108,183)] active:-translate-y-px active:shadow-[0_4px_20px_rgba(75,108,183,0.3)]`}
              onClick={() => selectedLocation && setShowSubLocationDropdown(!showSubLocationDropdown)}
              disabled={!selectedLocation}
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
                   {/* Add New Sub-Section button */}
                   {!showAddSubSection && (
                     <div
                       className="location-option add-new-option border-b border-gray-200 text-[#6a11cb] font-semibold"
                       onClick={() => setShowAddSubSection(true)}
                     >
                       <i className="fas fa-plus-circle"></i>
                       <span>Add New Sub-Section</span>
                     </div>
                   )}

                   {/* Inline input for adding new subsection */}
                   {showAddSubSection && (
                     <div className="add-new-input-container p-2 border-b border-gray-200">
                       <input
                         type="text"
                         placeholder="Enter new sub-section..."
                         value={newSubSectionInput}
                         onChange={(e) => setNewSubSectionInput(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter') handleAddSubSection(false);
                           if (e.key === 'Escape') {
                             setShowAddSubSection(false);
                             setNewSubSectionInput('');
                           }
                         }}
                         autoFocus
                         className="location-search-input mb-2"
                       />
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => handleAddSubSection(false)}
                          className="w-full py-1.5 px-2 bg-blue-500 text-white border-none rounded cursor-pointer text-[10px] font-semibold leading-tight text-center whitespace-normal"
                          title="Add only to this inspection"
                        >
                          Add To This Inspection
                        </button>
                        <button
                          onClick={() => handleAddSubSection(true)}
                          className="w-full py-1.5 px-2 bg-[#6a11cb] text-white border-none rounded cursor-pointer text-[10px] font-semibold leading-tight text-center whitespace-normal"
                          title="Save to template (all inspections)"
                        >
                          Save to Template
                        </button>
                        <button
                          onClick={() => {
                            setShowAddSubSection(false);
                            setNewSubSectionInput('');
                          }}
                          className="w-full py-1 px-2 bg-gray-200 text-gray-700 border-none rounded cursor-pointer text-[10px] font-medium"
                        >
                          Cancel
                        </button>
                        <div className="text-[9px] text-gray-500 py-0.5 leading-tight">
                          💡 Add = only this inspection • Save = all inspections
                        </div>
                      </div>
                     </div>
                   )}

                   {filteredSubsections.map(subLocation => {
                     const isTemplateCustom = selectedLocation && customSubsections[selectedLocation]?.includes(subLocation);
                     const isInspectionCustom = selectedLocation && inspectionCustomSubsections[selectedLocation]?.includes(subLocation);
                     const isCustom = isTemplateCustom || isInspectionCustom;
                     return (
                       <div
                         key={subLocation}
                         className={`location-option ${selectedSubLocation === subLocation ? 'selected' : ''} flex items-center justify-between`}
                       >
                         <div
                           className="flex-1 flex items-center"
                           onClick={() => {
                             setSelectedSubLocation(subLocation);
                             setShowSubLocationDropdown(false);
                             setSubLocationSearch('');
                           }}
                         >
                           <i className="fas fa-layer-group"></i>
                           <span>{subLocation}</span>
                           {isInspectionCustom && (
                             <span className="text-[10px] ml-1.5 text-blue-500 font-semibold">
                               (This Inspection)
                             </span>
                           )}
                         </div>
                         {isCustom && (
                           <i
                             className="fas fa-trash-alt text-red-500 cursor-pointer py-1 px-2 text-sm"
                             onClick={(e) => {
                               e.stopPropagation();
                               if (confirm(`Delete "${subLocation}"?`)) {
                                 handleDeleteSubSection(subLocation, !!isTemplateCustom);
                               }
                             }}
                             title={isTemplateCustom ? 'Delete from template' : 'Delete from this inspection'}
                           />
                         )}
                       </div>
                     );
                   })}
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
                <i className="fas fa-spinner fa-spin mr-2"></i>
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