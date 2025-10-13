"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import ImageEditor from '../../../components/ImageEditor';
import { useState, useRef, useEffect } from 'react';
import { useAnalysisStore } from '@/lib/store';

export default function ImageEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedInspectionId = searchParams.get('inspectionId') || '';
  const preloadImageUrl = searchParams.get('imageUrl'); // Get existing image URL
  const returnTo = searchParams.get('returnTo'); // Where to return after editing
  const checklistId = searchParams.get('checklistId'); // For information block images
  
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
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedColor, setSelectedColor] = useState('#d63636'); // Default red color - shared across all tools
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [isThreeSixty, setIsThreeSixty] = useState(false); // 360° photo flag



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
      
      // Use Next.js API route to proxy the image to avoid CORS
      const proxyUrl = `/api/r2api?imageUrl=${encodeURIComponent(preloadImageUrl)}`;
      
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

  const handleCropStateChange = (hasFrame: boolean) => {
    setHasCropFrame(hasFrame);
  };

  const handleBackToTable = () => {
    router.push('/');
  };

  const handleSubmit = async () => {
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

        const uploadRes = await fetch('/api/r2api', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errorText = await uploadRes.text();
          console.error('❌ Upload failed:', uploadRes.status, errorText);
          throw new Error(`Failed to upload annotated image: ${uploadRes.status}`);
        }

        const uploadData = await uploadRes.json();
        console.log('✅ Annotated image uploaded:', uploadData.url);

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
      const formData = new FormData();
      formData.append('image', editedFile!);
      formData.append('description', description);
      formData.append('location', selectedLocationValue);
      formData.append('section', selectedSection);
      formData.append('subSection', selectedSubsection);
      formData.append('inspectionId', selectedInspectionId);
      formData.append('selectedColor', selectedColor);
      formData.append('imageUrl', imageDataUrl);
      formData.append('isThreeSixty', isThreeSixty.toString()); // Add 360° flag
      if (videoFile) {
        formData.append('videoFile', videoFile);
        formData.append('thumbnail', thumbnail!);
        formData.append('videoSrc', videoSrc!);
        formData.append('type', 'video');
      } else {
        formData.append('type', 'image');  
      }

      const response = await fetch('/api/llm/analyze-image', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        alert(`Analysis request failed: ${errorText}`);
        return; // ❌ stop here
      }
      
      const result = await response.json();
      console.log('API response:', result);
      
      // Check if the analysis was accepted and started
      if (response.status === 202) {
        // Analysis is processing in the background
        console.log('Analysis started with ID:', result.analysisId);
        
      } else if (!result.analysisId) {
        alert('Analysis did not start correctly. Please try again.');
        return; // ❌ stop here
      }
  

  
      // ✅ Navigate only if job started successfully
      window.location.href = `/image-editor/?inspectionId=${selectedInspectionId}`;
    } catch (error: any) {
      console.error('Submission error:', error);
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
                borderTop: "5px solid #2563eb",
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
        <button className="action-btn back-btn" onClick={handleBackToTable}>
          <i className="fas fa-arrow-left"></i>
        </button>

        {/* Done button for annotation mode */}
        {returnTo && checklistId && (
          <button 
            className="action-btn done-btn"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              backgroundColor: '#10b981',
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
          videoRef={videoRef}
          setIsCameraOpen={setIsCameraOpen}
          isCameraOpen={isCameraOpen}
          setVideoFile={setVideoFile}
          setThumbnail={setThumbnail}
          setVideoSrc={setVideoSrc}
          preloadedImage={currentImage}
          preloadedFile={editedFile}
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

       {/* Description Box - Only show for defect workflow */}
       {!returnTo && !checklistId && (
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

      {/* Submit Section - Only show for defect workflow */}
      {!returnTo && !checklistId && (
        <div className="submit-section">
          <div className="submit-controls">

          {/* Location Button with Dropdown */}
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

          {/* Submit Button */}
          <button className="submit-btn" onClick={handleSubmit}>
            Submit
          </button>
        </div>
      </div>
      )}
    </div>
  );
}