"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import HeaderImageUploader from './HeaderImageUploader';
import LocationSearch from './LocationSearch';
import FileUpload from './FileUpload';
import { LOCATION_OPTIONS } from '../constants/locations';
import dynamic from 'next/dynamic';

const InformationSections = dynamic(() => import('./InformationSections'), { 
  ssr: false,
  loading: () => (
    <div style={{ 
      width: '100%', 
      padding: '40px 20px',
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '12px',
      gap: '16px'
    }}>
      <div style={{
        width: '50px',
        height: '50px',
        border: '4px solid rgba(255, 255, 255, 0.3)',
        borderTopColor: 'white',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <p style={{ color: 'white', fontSize: '16px', fontWeight: 600 }}>
        Loading Information Sections...
      </p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
});
const ThreeSixtyViewer = dynamic(() => import('./ThreeSixtyViewer'), { 
  ssr: false,
  loading: () => (
    <div style={{ 
      width: '100%', 
      height: '400px', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#000',
      borderRadius: '8px'
    }}>
      <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', color: 'white' }}></i>
    </div>
  )
});

interface Defect {
  _id: string;
  inspection_id: string;
  image: string;
  location: string;
  section: string;
  subsection: string;
  defect_description: string;
  defect_short_description: string;
  materials: string;
  material_total_cost: number;
  labor_type: string;
  labor_rate: number;
  hours_required: number;
  recommendation: string;
  color?: string;
  type: string;
  thumbnail: string;
  video: string;
  isThreeSixty?: boolean; // 360° photo flag
  additional_images?: Array<{ url: string; location: string; isThreeSixty?: boolean }>; // Multiple location photos (supports 360)
  base_cost?: number; // Base cost from AI analysis
}

interface DefectEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  inspectionId: string;
  inspectionName: string;
  _isPlaying?: boolean; 
}

export default function DefectEditModal({ isOpen, onClose, inspectionId, inspectionName }: DefectEditModalProps) {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<Defect>>({});
  const [inspectionDetails, setInspectionDetails] = useState<{headerImage?: string, headerText?: string, headerName?: string, headerAddress?: string, hidePricing?: boolean}>({});
  const [savingHeaderImage, setSavingHeaderImage] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'defects' | 'information'>('defects');
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Additional images state
  const [uploadingLocationPhoto, setUploadingLocationPhoto] = useState(false);
  const [newLocationPhoto, setNewLocationPhoto] = useState<{ url: string; location: string } | null>(null);
  
  // Scroll to top button state
  const [showScrollTop, setShowScrollTop] = useState(false);
  const modalBodyRef = useRef<HTMLDivElement | null>(null);

  // Bulk add state for additional location photos
  const [bulkAddOpen, setBulkAddOpen] = useState<boolean>(false);
  const [bulkItems, setBulkItems] = useState<Array<{ file: File; preview: string; location: string; isThreeSixty: boolean }>>([]);
  const [bulkSaving, setBulkSaving] = useState<boolean>(false);

  // Custom locations state
  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const allLocationOptions = [...LOCATION_OPTIONS, ...customLocations];

  // Note: Previously used a forced re-render counter for LocationSearch. Removed to keep
  // the component truly controlled by value props and avoid wiping user selections.



  // Fetch inspection details
  const fetchInspectionDetails = async () => {
    try {
      const response = await fetch(`/api/inspections/${inspectionId}`);
      if (response.ok) {
        const data = await response.json();
        setInspectionDetails(data);
      } else {
        console.error('Failed to fetch inspection details');
      }
    } catch (error) {
      console.error('Error fetching inspection details:', error);
    }
  };

  // Ensure all media (images/videos) load reliably through our proxy
  const getProxiedSrc = useCallback((url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('/api/proxy-image?')) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }, []);

  // Fallback handler: if direct URL fails, retry via proxy, else use placeholder
  const handleImgError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    const current = img.getAttribute('src') || '';
    if (current && !current.startsWith('/api/proxy-image?') && !current.startsWith('data:')) {
      img.src = `/api/proxy-image?url=${encodeURIComponent(current)}`;
    } else {
      img.src = '/placeholder-image.jpg';
    }
  }, []);

  // Fetch defects and inspection details when modal opens
  useEffect(() => {
    if (isOpen && inspectionId) {
      fetchDefects();
      fetchInspectionDetails();
      
      // Flag to prevent showing the alert multiple times
      let hasAlerted = false;
      
      // Check for pending annotation and switch to Information Sections tab
      const checkForPendingAnnotation = () => {
        const pending = localStorage.getItem('pendingAnnotation');
        if (pending && !hasAlerted) {
          try {
            const annotation = JSON.parse(pending);
            if (annotation.inspectionId === inspectionId) {
              console.log('🔄 Switching to Information Sections tab for pending annotation');
              setActiveTab('information');
              // Show success notification immediately - don't wait for processing
              alert('✅ Image saved successfully!');
              hasAlerted = true; // Set flag to prevent duplicate alerts
            }
          } catch (e) {
            console.error('Error parsing pending annotation:', e);
          }
        }
      };
      
      // Check immediately
      checkForPendingAnnotation();
      
      // Also poll for 3 seconds to handle race condition where image-editor saves after modal opens
      let pollCount = 0;
      const maxPolls = 6; // 3 seconds (6 checks * 500ms)
      
      const pollInterval = setInterval(() => {
        pollCount++;
        if (pollCount >= maxPolls) {
          clearInterval(pollInterval);
          return;
        }
        
        const pending = localStorage.getItem('pendingAnnotation');
        if (pending && !hasAlerted) {
          try {
            const annotation = JSON.parse(pending);
            if (annotation.inspectionId === inspectionId) {
              console.log('📡 Polling detected pending annotation');
              setActiveTab('information');
              alert('✅ Image saved successfully!');
              hasAlerted = true;
              clearInterval(pollInterval);
            }
          } catch (e) {
            console.error('Error in polling:', e);
          }
        }
      }, 500);
      
      // Listen for additional location photo notifications (from image editor)
      const applyPendingAdditionalPhoto = () => {
        try {
          const pending = localStorage.getItem('pendingAdditionalLocationPhoto');
          if (!pending) return;
          const data = JSON.parse(pending);
          if (data && data.inspectionId === inspectionId && data.defectId) {
            // Optimistically update UI without a full refetch
            setDefects(prev => prev.map(d => {
              if (d._id !== data.defectId) return d;
              const nextImages = [...(d.additional_images || [])];
              // Avoid duplicates
              if (!nextImages.some((img) => img.url === data.photo?.url)) {
                nextImages.push({ url: data.photo?.url, location: data.photo?.location || '', isThreeSixty: !!data.photo?.isThreeSixty });
              }
              return { ...d, additional_images: nextImages };
            }));

            // If currently editing this defect, also reflect in editedValues
            setEditedValues(prev => {
              if (!editingId || editingId !== data.defectId) return prev;
              const curr = defects.find(d => d._id === editingId);
              const baseArr = (prev.additional_images as any) || curr?.additional_images || [];
              const nextArr = [...baseArr];
              if (!nextArr.some((img: any) => img.url === data.photo?.url)) {
                nextArr.push({ url: data.photo?.url, location: data.photo?.location || '', isThreeSixty: !!data.photo?.isThreeSixty });
              }
              return { ...prev, additional_images: nextArr };
            });

            // Clear the flag so it doesn't re-apply
            localStorage.removeItem('pendingAdditionalLocationPhoto');
          }
        } catch (e) {
          console.error('Error applying pending additional photo:', e);
        }
      };

      // Listen for edited additional photo notifications (from image editor)
      const applyPendingEditedAdditionalPhoto = () => {
        try {
          const pending = localStorage.getItem('pendingEditedAdditionalLocationPhoto');
          if (!pending) return;
          const data = JSON.parse(pending);
          if (data && data.inspectionId === inspectionId && data.defectId) {
            const { defectId, index, oldUrl, newUrl } = data as { defectId: string; index?: number; oldUrl?: string; newUrl: string };

            // Update defects list optimistically
            setDefects(prev => prev.map(d => {
              if (d._id !== defectId) return d;
              const nextImages = [...(d.additional_images || [])];
              let replaced = false;
              if (typeof index === 'number' && nextImages[index]) {
                nextImages[index] = { ...nextImages[index], url: newUrl };
                replaced = true;
              } else if (oldUrl) {
                const idx = nextImages.findIndex(img => img.url === oldUrl);
                if (idx >= 0) {
                  nextImages[idx] = { ...nextImages[idx], url: newUrl };
                  replaced = true;
                }
              }
              return { ...d, additional_images: nextImages };
            }));

            // If currently editing this defect, also reflect in editedValues
            setEditedValues(prev => {
              if (!editingId || editingId !== defectId) return prev;
              const curr = defects.find(d => d._id === editingId);
              const baseArr = (prev.additional_images as any) || curr?.additional_images || [];
              const nextArr = [...baseArr];
              let updated = false;
              if (typeof index === 'number' && nextArr[index]) {
                nextArr[index] = { ...nextArr[index], url: newUrl };
                updated = true;
              } else if (oldUrl) {
                const idx = nextArr.findIndex((img: any) => img.url === oldUrl);
                if (idx >= 0) {
                  nextArr[idx] = { ...nextArr[idx], url: newUrl };
                  updated = true;
                }
              }
              return updated ? { ...prev, additional_images: nextArr } : prev;
            });

            // Clear the flag so it doesn't re-apply
            localStorage.removeItem('pendingEditedAdditionalLocationPhoto');
          }
        } catch (e) {
          console.error('Error applying edited additional photo:', e);
        }
      };

      // Apply pending main defect image update from image editor
      const applyPendingMainImageUpdate = () => {
        try {
          const pending = localStorage.getItem('pendingDefectMainImageUpdate');
          if (!pending) return;
          const data = JSON.parse(pending);
          if (data && data.inspectionId === inspectionId && data.defectId && data.newImageUrl) {
            const { defectId, newImageUrl } = data;

            // Update defects list optimistically
            setDefects(prev => prev.map(d => {
              if (d._id !== defectId) return d;
              return { ...d, image: newImageUrl };
            }));

            // If currently editing this defect, also update editedValues
            setEditedValues(prev => {
              if (!editingId || editingId !== defectId) return prev;
              return { ...prev, image: newImageUrl };
            });

            // Clear the flag so it doesn't re-apply
            localStorage.removeItem('pendingDefectMainImageUpdate');
          }
        } catch (e) {
          console.error('Error applying main image update:', e);
        }
      };

      // Immediate check on open
      applyPendingAdditionalPhoto();
      applyPendingEditedAdditionalPhoto();
      applyPendingMainImageUpdate();

      // Listen to storage events (in case image editor tab updates it while this stays open)
      const onStorage = (e: StorageEvent) => {
        if (e.key === 'pendingAdditionalLocationPhoto' && e.newValue) {
          applyPendingAdditionalPhoto();
        }
        if (e.key === 'pendingEditedAdditionalLocationPhoto' && e.newValue) {
          applyPendingEditedAdditionalPhoto();
        }
        if (e.key === 'pendingDefectMainImageUpdate' && e.newValue) {
          applyPendingMainImageUpdate();
        }
      };
      window.addEventListener('storage', onStorage);

      // Also refresh on window focus
      const onFocus = () => {
        applyPendingAdditionalPhoto();
        applyPendingEditedAdditionalPhoto();
        applyPendingMainImageUpdate();
      };
      window.addEventListener('focus', onFocus);

      return () => {
        clearInterval(pollInterval);
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('focus', onFocus);
      };
    } else if (!isOpen) {
      // Reset tab to defects when modal closes
      setActiveTab('defects');
    }
  }, [isOpen, inspectionId]);

  // Scroll detection for "Back to Top" button
  useEffect(() => {
    const modalBody = modalBodyRef.current;
    if (!modalBody) return;

    const handleScroll = () => {
      // Show button when scrolled more than 300px
      if (modalBody.scrollTop > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    modalBody.addEventListener('scroll', handleScroll);
    return () => modalBody.removeEventListener('scroll', handleScroll);
  }, [isOpen]);

  // Scroll to top function
  const scrollToTop = () => {
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };


  const fetchDefects = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/defects/${inspectionId}`);
    if (response.ok) {
        const data = await response.json();
        // Ensure data is an array and has proper structure
        const safeData = Array.isArray(data) ? data : [];
        setDefects(safeData);
      } else {
        console.error('Failed to fetch defects');
        setDefects([]);
      }
    } catch (error) {
      console.error('Error fetching defects:', error);
      setDefects([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDefect = async (defectId: string) => {
    if (!confirm('Are you sure you want to delete this defect?')) {
      return;
    }

    console.log(defectId)

    try {
      setDeleting(defectId);
      const response = await fetch(`/api/defects/${defectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDefects(prev => prev.filter(defect => defect._id !== defectId));
      } else {
        alert('Failed to delete defect. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting defect:', error);
      alert('Error deleting defect. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Calculate total cost based on base_cost × image count
  const calculateTotalCost = (defect: Defect): number => {
    // Base cost includes materials + labor from first AI analysis
    const materialCost = defect.base_cost || defect.material_total_cost || 0;
    const laborCost = (defect.labor_rate || 0) * (defect.hours_required || 0);
    const baseCost = materialCost + laborCost;
    
    // Multiply by number of location photos (main + additional)
    const imageCount = 1 + (defect.additional_images?.length || 0);
    return baseCost * imageCount;
  };

  // Handler: Add new location photo
  const handleAddLocationPhoto = () => {
    if (!editingId) return;
    const defect = defects.find(d => d._id === editingId);
    if (!defect) return;
    
    // No upper limit for number of location photos

    // Redirect to image editor with defect context
    const params = new URLSearchParams({
      inspectionId: inspectionId,
      mode: 'additional-location',
      defectId: editingId,
    });
    window.open(`/image-editor?${params.toString()}`, '_blank');
  };

  // Handler: Remove location photo
  const handleRemoveLocationPhoto = async (index: number) => {
    if (!editingId) return;
    const defect = defects.find(d => d._id === editingId);
    if (!defect || !defect.additional_images) return;

    const updatedImages = defect.additional_images.filter((_, i) => i !== index);
        
    // Update via API
    try {
      const response = await fetch(`/api/defects/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_id: defect.inspection_id,
          additional_images: updatedImages,
          material_total_cost: (defect.base_cost || defect.material_total_cost) * (1 + updatedImages.length),
        }),
      });

      if (response.ok) {
        // Update local state
        setDefects(prev =>
          prev.map(d =>
            d._id === editingId
              ? { ...d, additional_images: updatedImages, material_total_cost: (d.base_cost || d.material_total_cost) * (1 + updatedImages.length) }
              : d
          )
        );
        setEditedValues(prev => ({
          ...prev,
          additional_images: updatedImages,
        }));
      }
    } catch (error) {
      console.error('Error removing location photo:', error);
      alert('Failed to remove photo');
    }
  };

  // Handler: Add new custom location
  const handleAddNewLocation = (newLocation: string) => {
    if (!customLocations.includes(newLocation) && !LOCATION_OPTIONS.includes(newLocation)) {
      setCustomLocations(prev => [...prev, newLocation]);
    }
  };

  // Handler: Annotate main defect image
  const handleAnnotateMainImage = (defect: Defect) => {
    if (!defect.image) {
      alert('No image to annotate');
      return;
    }

    localStorage.setItem('editorMode', 'defect-main');
    localStorage.setItem('editingDefectId', defect._id);
    localStorage.setItem('editingInspectionId', inspectionId);

    window.open(
      `/image-editor?src=${encodeURIComponent(defect.image)}&mode=defect-main&defectId=${defect._id}&inspectionId=${inspectionId}`,
      '_blank'
    );
  };

  // Handler: Update location for additional image
  const handleUpdateLocationForImage = async (index: number, newLocation: string) => {
    console.log('🔄 handleUpdateLocationForImage called:', { index, newLocation, editingId });
    
    if (!editingId) return;
    const defect = defects.find(d => d._id === editingId);
    if (!defect || !defect.additional_images) return;

    console.log('Current defect.additional_images:', defect.additional_images);

    // First, update the editedValues immediately for instant UI feedback
    setEditedValues(prev => {
      const currentImages = (prev.additional_images as any) || defect.additional_images || [];
      const updatedImages = currentImages.map((img: any, i: number) =>
        i === index ? { ...img, location: newLocation } : img
      );
      console.log('Updated editedValues.additional_images:', updatedImages);
      return {
        ...prev,
        additional_images: updatedImages,
      };
    });
    
  // No forced re-render; LocationSearch is controlled via value props

    // Then update defects state
    const updatedImages = defect.additional_images.map((img, i) =>
      i === index ? { ...img, location: newLocation } : img
    );

    setDefects(prev =>
      prev.map(d =>
        d._id === editingId ? { ...d, additional_images: updatedImages } : d
      )
    );

    // Finally, persist to backend
    try {
      const response = await fetch(`/api/defects/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_id: defect.inspection_id,
          additional_images: updatedImages,
        }),
      });

      if (!response.ok) {
        console.error('Failed to update location on server');
        // Optionally: revert the change if server update fails
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  const setHeaderImage = async (imageUrl: string) => {
    try {
      console.log('🚀 setHeaderImage called with URL:', imageUrl);
      setSavingHeaderImage(true);
      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ headerImage: imageUrl }),
      });

      console.log('📡 API response status:', response.status);
      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ API response data:', responseData);
        setInspectionDetails(prev => ({ ...prev, headerImage: imageUrl }));
        console.log('✅ Updated inspectionDetails with headerImage:', imageUrl);
        alert('Header image updated successfully');
      } else {
        const errorData = await response.json();
        console.error('❌ API error response:', errorData);
        alert('Failed to update header image');
      }
    } catch (error) {
      console.error('❌ Error updating header image:', error);
      alert('Error updating header image');
    } finally {
      setSavingHeaderImage(false);
    }
  };
  
  const setHeaderName = async (text: string) => {
    try {
      setInspectionDetails(prev => ({ ...prev, headerName: text }));
      await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ headerName: text })
      });
    } catch(e){ console.error('Error updating header name', e); }
  };
  const setHeaderAddress = async (text: string) => {
    try {
      setInspectionDetails(prev => ({ ...prev, headerAddress: text }));
      await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ headerAddress: text })
      });
    } catch(e){ console.error('Error updating header address', e); }
  };

  const toggleHidePricing = async (hide: boolean) => {
    try {
      setInspectionDetails(prev => ({ ...prev, hidePricing: hide }));
      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidePricing: hide })
      });
      
      if (response.ok) {
        console.log('✅ Hide pricing setting updated:', hide);
      } else {
        console.error('❌ Failed to update hide pricing setting');
        // Revert on error
        setInspectionDetails(prev => ({ ...prev, hidePricing: !hide }));
      }
    } catch (e) {
      console.error('Error updating hide pricing setting:', e);
      // Revert on error
      setInspectionDetails(prev => ({ ...prev, hidePricing: !hide }));
    }
  };

  // calculateTotalCost is now defined earlier in the file (line ~234) to include image count multiplication

  const startEditing = (defect: Defect) => {
    setEditingId(defect._id);
    setEditedValues({ ...defect });
    setLastSaved(null);
  };

  const cancelEditing = () => {
    // Clear any pending auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setEditingId(null);
    setEditedValues({});
    setLastSaved(null);
  };

  const handleFieldChange = (field: keyof Defect, value: string) => {
    setEditedValues(prev => {
      let parsed: any = value;
      if (field === 'material_total_cost' || field === 'labor_rate' || field === 'hours_required') {
        const num = parseFloat(value);
        parsed = isNaN(num) ? 0 : num;
      }
      return { ...prev, [field]: parsed };
    });
    
    // Trigger auto-save with debounce
    triggerAutoSave();
  };

  // Auto-save function with debouncing
  const triggerAutoSave = useCallback(() => {
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set new timer to save after 1 second of inactivity
    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();
    }, 1000);
  }, [editingId, editedValues, defects]);

  const performAutoSave = async () => {
    if (!editingId) return;
    const index = defects.findIndex(d => d._id === editingId);
    if (index === -1) return;
  
    const updated: Defect = { ...defects[index], ...(editedValues as Defect) };
  
    setAutoSaving(true);
    
    try {
      const response = await fetch(`/api/defects/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_id: updated.inspection_id,
          defect_description: updated.defect_description,
          materials: updated.materials,
          material_total_cost: updated.material_total_cost,
          location: updated.location,
          labor_type: updated.labor_type,
          labor_rate: updated.labor_rate,
          hours_required: updated.hours_required,
          recommendation: updated.recommendation,
          additional_images: updated.additional_images, // Save additional images
          base_cost: updated.base_cost, // Save base cost
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Auto-save error:", errorData.error);
        return;
      }
  
      const result = await response.json();
      console.log("✅ Auto-saved successfully:", result.message);
  
      // Update local state
      setDefects(prev =>
        prev.map(d => (d._id === editingId ? updated : d))
      );
      
      // Update last saved timestamp
      const now = new Date();
      setLastSaved(now.toLocaleTimeString());
      
    } catch (err) {
      console.error("Auto-save error:", err);
    } finally {
      setAutoSaving(false);
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const saveEdited = async () => {
    if (!editingId) return;
    const index = defects.findIndex(d => d._id === editingId);
    if (index === -1) return;
  
    const updated: Defect = { ...defects[index], ...(editedValues as Defect) };
  
    // Log all values for the edited defect
    console.log('Edited defect values:', updated);
  
    try {
      // Call API to persist changes
      const response = await fetch(`/api/defects/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_id: updated.inspection_id, // required
          defect_description: updated.defect_description,
          materials: updated.materials,
          material_total_cost: updated.material_total_cost,
          location: updated.location,
          labor_type: updated.labor_type,
          labor_rate: updated.labor_rate,
          hours_required: updated.hours_required,
          recommendation: updated.recommendation,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error updating defect:", errorData.error);
        alert(`Update failed: ${errorData.error}`);
        return;
      }
  
      const result = await response.json();
      console.log("✅ Defect updated successfully:", result.message);
  
      // Update local state so UI reflects new values
      setDefects(prev =>
        prev.map(d => (d._id === editingId ? updated : d))
      );
  
      setEditingId(null);
      setEditedValues({});
    } catch (err) {
      console.error("Unexpected error while saving defect:", err);
      alert("Something went wrong while saving changes.");
    }
  };
  

  const getDisplayDefect = (defect: Defect): Defect => {
    if (editingId === defect._id) {
      // Deep merge: if editedValues has additional_images, use it; otherwise use defect's
      const merged = { ...defect, ...(editedValues as Partial<Defect>) } as Defect;
      
      // Ensure additional_images from editedValues takes priority
      if (editedValues.additional_images !== undefined) {
        merged.additional_images = editedValues.additional_images as any;
      }
      
      console.log('getDisplayDefect merged:', merged.additional_images);
      return merged;
    }
    return defect;
  };

  if (!isOpen) return null;

  return (
    <div 
      className="modal-overlay"
      onClick={onClose}
    >
      <div 
        className="modal-content defect-edit-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-body" ref={modalBodyRef}>
          <div className="modal-header">
            <h2>Edit Inspection - {inspectionName}</h2>
            <button className="modal-close-btn" onClick={onClose}>
              <i className="fas fa-times"></i>
            </button>
          </div>

          {/* Tabs */}
          <div className="modal-tabs-container" style={{ padding: '0 1.5rem', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setActiveTab('defects')}
                style={{
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'defects' ? '3px solid #dc2626' : '3px solid transparent',
                  fontWeight: 600,
                  color: activeTab === 'defects' ? '#dc2626' : '#6b7280',
                  cursor: 'pointer'
                }}
              >
                Defects
              </button>
              <button
                onClick={() => setActiveTab('information')}
                style={{
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'none',
                  borderBottom: activeTab === 'information' ? '3px solid #dc2626' : '3px solid transparent',
                  fontWeight: 600,
                  color: activeTab === 'information' ? '#dc2626' : '#6b7280',
                  cursor: 'pointer'
                }}
              >
                Information Sections
              </button>
            </div>
          </div>

          <div style={{ padding: '24px' }}>
          {activeTab === 'defects' && (
            <>
              {/* Header Image Upload */}
              <div className="header-image-section">
                <h3>Report Header Image</h3>
                <p className="section-description">Upload a custom image to use as the header for this inspection report.</p>
                
                <div className="header-image-container">
                  <HeaderImageUploader 
                    currentImage={inspectionDetails.headerImage}
                    headerName={inspectionDetails.headerName || (inspectionDetails.headerText ? inspectionDetails.headerText.split('\n')[0] : '')}
                    headerAddress={inspectionDetails.headerAddress || (inspectionDetails.headerText ? inspectionDetails.headerText.split('\n').slice(1).join(' ') : '')}
                    onImageUploaded={(imageUrl) => setHeaderImage(imageUrl)}
                    onImageRemoved={() => setHeaderImage('')}
                    onHeaderNameChanged={(text) => setHeaderName(text)}
                    onHeaderAddressChanged={(text) => setHeaderAddress(text)}
                    getProxiedSrc={getProxiedSrc}
                  />
                </div>
              </div>
              
              {/* Report Settings */}
              <div className="header-image-section" style={{ marginTop: '1.5rem' }}>
                <h3>Report Settings</h3>
                <p className="section-description">Configure how this inspection report is displayed.</p>
                
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.75rem',
                    cursor: 'pointer',
                    padding: '0.75rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '0.375rem',
                    border: '1px solid #e5e7eb'
                  }}>
                    <input
                      type="checkbox"
                      checked={inspectionDetails.hidePricing || false}
                      onChange={(e) => toggleHidePricing(e.target.checked)}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        accentColor: '#8230c9'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#111827', marginBottom: '0.25rem' }}>
                        Hide Pricing
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                        Hide cost estimates, materials cost, labor cost, hours, and total cost in all report formats (web, PDF, HTML export)
                      </div>
                    </div>
                  </label>
                </div>
              </div>
              
              <div className="section-divider"></div>
              <h3>Manage Defects</h3>
              
              {loading ? (
                <div className="loading-container">
                  <div className="loading-spinner"></div>
                  <p>Loading defects...</p>
                </div>
              ) : defects.length === 0 ? (
                <div className="empty-state">
                  <i className="fas fa-exclamation-triangle empty-icon"></i>
                  <h3>No Defects Found</h3>
                  <p>This inspection has no defects recorded.</p>
                </div>
              ) : (
                <div className="defects-list">
                  {defects.map((defect, index) => {
                    const displayDefect = getDisplayDefect(defect);
                    const isEditing = editingId === defect._id;
                    return (
                      <div key={defect._id} className="defect-card">
                        <div className="defect-header">
                          <h3>Defect #{index + 1}</h3>
                          <div className="defect-actions">
                            {!isEditing && (
                              <button
                                className="professional-edit-btn"
                                onClick={() => startEditing(defect)}
                                title="Edit defect"
                              >
                                <i className="fas fa-edit"></i>
                              </button>
                            )}
                            {isEditing && (
                              <>
                                <div className="auto-save-indicator" style={{ 
                                  marginRight: '10px', 
                                  fontSize: '13px',
                                  color: autoSaving ? '#f59e0b' : '#10b981',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}>
                                  {autoSaving ? (
                                    <>
                                      <i className="fas fa-spinner fa-spin"></i>
                                      <span>Saving...</span>
                                    </>
                                  ) : lastSaved ? (
                                    <>
                                      <i className="fas fa-check-circle"></i>
                                      <span>Saved at {lastSaved}</span>
                                    </>
                                  ) : (
                                    <>
                                      <i className="fas fa-info-circle"></i>
                                      <span>Auto-save enabled</span>
                                    </>
                                  )}
                                </div>
                                <button 
                                  className="cancel-defect-btn" 
                                  onClick={cancelEditing}
                                  title="Done editing"
                                  style={{ background: '#10b981' }}
                                >
                                  <i className="fas fa-check"></i>
                                </button>
                              </>
                            )}
                            <button
                              className="delete-defect-btn"
                              onClick={() => handleDeleteDefect(defect._id)}
                              disabled={deleting === defect._id}
                            >
                              {deleting === defect._id ? (
                                <i className="fas fa-spinner fa-spin"></i>
                              ) : (
                                <i className="fas fa-trash"></i>
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="defect-content">
                          <div className="defect-image">
                            {displayDefect.isThreeSixty && displayDefect.image ? (
                              <ThreeSixtyViewer
                                imageUrl={getProxiedSrc(displayDefect.image)}
                                alt={`360° view - ${displayDefect.defect_short_description || 'defect'}`}
                                height="400px"
                              />
                            ) : displayDefect.type === "video" && displayDefect.video ? (
                              <>
                                {playingVideoId !== displayDefect._id ? (
                                  <img
                                    src={getProxiedSrc(displayDefect.thumbnail) || "/placeholder-image.jpg"}
                                    alt="Video thumbnail"
                                    style={{ maxWidth: "100%", maxHeight: "200px", cursor: "pointer" }}
                                    onError={handleImgError}
                                    onClick={() => setPlayingVideoId(displayDefect._id)}
                                  />
                                ) : (
                                  <video
                                    src={getProxiedSrc(displayDefect.video)}
                                    controls
                                    autoPlay
                                    style={{ maxWidth: "100%", maxHeight: "200px" }}
                                  />
                                )}
                              </>
                            ) : (
                              <img
                                src={
                                  getProxiedSrc(displayDefect.image) ||
                                  getProxiedSrc(displayDefect.thumbnail) ||
                                  "/placeholder-image.jpg"
                                }
                                alt="Defect"
                                onError={handleImgError}
                              />
                            )}
                            {displayDefect.image && !displayDefect.isThreeSixty && displayDefect.type !== "video" && (
                              <button
                                onClick={() => handleAnnotateMainImage(displayDefect)}
                                style={{
                                  marginTop: '8px',
                                  padding: '6px 12px',
                                  fontSize: '0.75rem',
                                  borderRadius: '4px',
                                  border: '1px solid #8b5cf6',
                                  backgroundColor: '#8b5cf6',
                                  color: 'white',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  width: '100%',
                                }}
                              >
                                <i className="fas fa-pencil-alt" style={{ marginRight: '6px' }}></i>
                                Annotate
                              </button>
                            )}
                          </div>
                          <div className="defect-details">
                            <div className="detail-row">
                              <strong>Location:</strong>{' '}
                              {isEditing ? (
                                <LocationSearch
                                  options={allLocationOptions}
                                  value={editedValues.location ?? displayDefect.location ?? ''}
                                  onChangeAction={(val) => handleFieldChange('location', val)}
                                  placeholder="Select location…"
                                  width={220}
                                />
                              ) : (
                                displayDefect.location || 'Not specified'
                              )}
                            </div>
                            <div className="detail-row">
                              <strong>Section:</strong>{' '}
                              {isEditing ? (
                                <input
                                  className="defect-input"
                                  type="text"
                                  value={editedValues.section ?? displayDefect.section ?? ''}
                                  onChange={(e) => handleFieldChange('section', e.target.value)}
                                />
                              ) : (
                                displayDefect.section || 'Not specified'
                              )}
                            </div>
                            <div className="detail-row">
                              <strong>Subsection:</strong>{' '}
                              {isEditing ? (
                                <input
                                  className="defect-input"
                                  type="text"
                                  value={editedValues.subsection ?? displayDefect.subsection ?? ''}
                                  onChange={(e) => handleFieldChange('subsection', e.target.value)}
                                />
                              ) : (
                                displayDefect.subsection || 'Not specified'
                              )}
                            </div>
                            <div className="detail-row">
                              <strong>Description:</strong>{' '}
                              {isEditing ? (
                                <textarea
                                  className="defect-input"
                                  value={editedValues.defect_description ?? displayDefect.defect_description ?? ''}
                                  onChange={(e) => handleFieldChange('defect_description', e.target.value)}
                                />
                              ) : (
                                displayDefect.defect_description || 'No description available'
                              )}
                            </div>
                            
                            {/* Pricing Information - Hidden when hidePricing is enabled */}
                            {!inspectionDetails.hidePricing && (
                              <>
                                <div className="detail-row">
                                  <strong>Materials:</strong>{' '}
                                  {isEditing ? (
                                    <input
                                      className="defect-input"
                                      type="text"
                                      value={editedValues.materials ?? displayDefect.materials ?? ''}
                                      onChange={(e) => handleFieldChange('materials', e.target.value)}
                                    />
                                  ) : (
                                    displayDefect.materials || 'No materials specified'
                                  )}
                                </div>
                                <div className="detail-row">
                                  <strong>Material Cost:</strong>{' '}
                                  {isEditing ? (
                                    <input
                                      className="defect-input"
                                      type="number"
                                      step="0.01"
                                      value={String(editedValues.material_total_cost ?? displayDefect.material_total_cost ?? 0)}
                                      onChange={(e) => handleFieldChange('material_total_cost', e.target.value)}
                                    />
                                  ) : (
                                    formatCurrency(displayDefect.material_total_cost || 0)
                                  )}
                                </div>
                                <div className="detail-row">
                                  <strong>Labor:</strong>{' '}
                                  {isEditing ? (
                                    <input
                                      className="defect-input"
                                      type="text"
                                      value={editedValues.labor_type ?? displayDefect.labor_type ?? ''}
                                      onChange={(e) => handleFieldChange('labor_type', e.target.value)}
                                    />
                                  ) : (
                                    displayDefect.labor_type || 'Not specified'
                                  )}{' '}
                                  {isEditing ? (
                                    <>
                                      at
                                      <input
                                        className="defect-input"
                                        style={{ width: 100, marginLeft: 6, marginRight: 6 }}
                                        type="number"
                                        step="0.01"
                                        value={String(editedValues.labor_rate ?? displayDefect.labor_rate ?? 0)}
                                        onChange={(e) => handleFieldChange('labor_rate', e.target.value)}
                                      />
                                      /hr
                                    </>
                                  ) : (
                                    <> at {formatCurrency(displayDefect.labor_rate || 0)}/hr</>
                                  )}
                                </div>
                                <div className="detail-row">
                                  <strong>Hours:</strong>{' '}
                                  {isEditing ? (
                                    <input
                                      className="defect-input"
                                      type="number"
                                      step="0.1"
                                      value={String(editedValues.hours_required ?? displayDefect.hours_required ?? 0)}
                                      onChange={(e) => handleFieldChange('hours_required', e.target.value)}
                                    />
                                  ) : (
                                    displayDefect.hours_required || 0
                                  )}
                                </div>
                              </>
                            )}
                            
                            <div className="detail-row">
                              <strong>Recommendation:</strong>{' '}
                              {isEditing ? (
                                <textarea
                                  className="defect-input"
                                  value={editedValues.recommendation ?? displayDefect.recommendation ?? ''}
                                  onChange={(e) => handleFieldChange('recommendation', e.target.value)}
                                />
                              ) : (
                                displayDefect.recommendation || 'No recommendation available'
                              )}
                            </div>

                            {/* Additional Location Photos Section */}
                            {isEditing && (
                              <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #dee2e6', maxWidth: '100%', width: '100%', marginLeft: 'auto', marginRight: 'auto', boxSizing: 'border-box', overflowX: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                  <strong style={{ fontSize: '0.95rem', color: '#495057' }}>
                                    📍 Additional Location Photos ({displayDefect.additional_images?.length || 0})
                                  </strong>
                                  <button
                                    onClick={() => setBulkAddOpen((v) => !v)}
                                    style={{
                                      padding: '0.6rem 1.2rem',
                                      backgroundColor: '#4f46e5',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      fontSize: '0.9rem',
                                      fontWeight: 600,
                                      boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)',
                                      transition: 'all 0.2s ease',
                                      maxWidth: '100%',
                                      whiteSpace: 'normal',
                                      wordBreak: 'break-word',
                                      textAlign: 'center',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = '#4338ca';
                                      e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = '#4f46e5';
                                      e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                  >
                                    {bulkAddOpen ? 'Close' : 'Add Another Locations For This Defect'}
                                  </button>
                                </div>

                                {bulkAddOpen && (
                                  <div style={{
                                    marginBottom: '1rem',
                                    padding: '0.75rem',
                                    background: '#f8fafc',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: 8,
                                    maxWidth: '100%',
                                    width: '100%',
                                    marginLeft: 'auto',
                                    marginRight: 'auto',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    boxSizing: 'border-box'
                                  }}>
                                    <p style={{ margin: '0 0 8px 0', color: '#374151', fontWeight: 600, textAlign: 'center', width: '100%' }}>Select multiple photos and set a location for each:</p>
                                    <FileUpload
                                      onFilesSelect={(files) => {
                                        const mapped = files.map((file) => ({
                                          file,
                                          preview: URL.createObjectURL(file),
                                          location: '',
                                          isThreeSixty: false,
                                        }));
                                        setBulkItems((prev) => [...prev, ...mapped]);
                                      }}
                                    />
                                    {bulkItems.length > 0 && (
                                      <div className="bulk-items-list" style={{ marginTop: 12, width: '100%' }}>
                                        {bulkItems.map((item, i) => (
                                          <div key={i} className="bulk-item-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', background: 'transparent', border: 'none', borderRadius: 0, padding: '12px 0', boxSizing: 'border-box' }}>
                                            <img src={item.preview} alt={`bulk-${i}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                                            <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                                              <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 4, fontWeight: 500 }}>Location</label>
                                              <LocationSearch
                                                options={allLocationOptions}
                                                onAddNew={handleAddNewLocation}
                                                value={item.location}
                                                onChangeAction={(val) => setBulkItems((prev) => {
                                                  const copy = [...prev];
                                                  copy[i] = { ...copy[i], location: val };
                                                  return copy;
                                                })}
                                                placeholder="Type to search…"
                                                width="100%"
                                              />
                                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, color: '#374151', fontWeight: 500 }}>
                                                <input type="checkbox" checked={item.isThreeSixty} onChange={(e) => setBulkItems((prev) => {
                                                  const copy = [...prev];
                                                  copy[i] = { ...copy[i], isThreeSixty: e.target.checked };
                                                  return copy;
                                                })} />
                                                This is a 360° photo
                                              </label>
                                            </div>
                                            <button
                                              onClick={() => setBulkItems((prev) => prev.filter((_, idx) => idx !== i))}
                                              className="remove-btn"
                                              style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.85rem', fontWeight: 500, boxShadow: '0 2px 4px rgba(220, 38, 38, 0.2)', marginTop: 8 }}
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        ))}
                                        <div className="bulk-items-actions" style={{ justifyContent: 'center', width: '100%', marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                          <button
                                            disabled={bulkSaving || bulkItems.length === 0}
                                            onClick={async () => {
                                              if (!editingId) return;
                                              const defect = defects.find(d => d._id === editingId);
                                              if (!defect) return;
                                              setBulkSaving(true);
                                              try {
                                                const updatedImages = [...(defect.additional_images || [])];
                                                for (const item of bulkItems) {
                                                  const fd = new FormData();
                                                  fd.append('file', item.file);
                                                  const uploadRes = await fetch('/api/r2api', { method: 'POST', body: fd });
                                                  if (!uploadRes.ok) throw new Error('Upload failed');
                                                  const { url } = await uploadRes.json();
                                                  updatedImages.push({ url, location: item.location || defect.location || '', isThreeSixty: item.isThreeSixty });
                                                }
                                                // Persist via PATCH
                                                const resp = await fetch(`/api/defects/${editingId}`, {
                                                  method: 'PATCH',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({ inspection_id: defect.inspection_id, additional_images: updatedImages })
                                                });
                                                if (!resp.ok) throw new Error('Failed to save');
                                                // Update local state
                                                setDefects(prev => prev.map(d => d._id === editingId ? { ...d, additional_images: updatedImages } : d));
                                                setEditedValues(prev => ({ ...prev, additional_images: updatedImages }));
                                                setBulkItems([]);
                                                setBulkAddOpen(false);
                                              } catch (e) {
                                                alert('Failed to add photos. Please try again.');
                                                console.error(e);
                                              } finally {
                                                setBulkSaving(false);
                                              }
                                            }}
                                            style={{ padding: '0.5rem 0.9rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
                                          >
                                            {bulkSaving ? 'Saving…' : 'Add All'}
                                          </button>
                                          <button onClick={() => { setBulkItems([]); setBulkAddOpen(false); }} style={{ padding: '0.5rem 0.9rem', background: '#e5e7eb', color: '#111827', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {displayDefect.additional_images && displayDefect.additional_images.length > 0 && (
                                  <div className="additional-items-list">
                                    {displayDefect.additional_images.map((img, idx) => {
                                      // Debug: Log the current location value
                                      console.log(`Additional image ${idx} location:`, img.location);
                                      const locationValue = img.location || "";
                                      return (
                                      <div key={`${img.url}-${idx}`} className="additional-item-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', padding: '12px 0', backgroundColor: 'transparent', borderRadius: 0, border: 'none', boxSizing: 'border-box' }}>
                                        <img 
                                          src={getProxiedSrc(img.url)} 
                                          alt={`Location ${idx + 2}`}
                                          onError={handleImgError}
                                          style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
                                        />
                                        <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                                          <label style={{ display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: '0.25rem', fontWeight: 500 }}>
                                            Location:
                                          </label>
                                          <LocationSearch
                                            key={`location-${displayDefect._id}-${idx}-${img.url}`}
                                            options={LOCATION_OPTIONS}
                                            value={locationValue}
                                            onChangeAction={(val) => {
                                              console.log(`Location changed for index ${idx}:`, val);
                                              handleUpdateLocationForImage(idx, val);
                                            }}
                                            placeholder="Type to search…"
                                            width="100%"
                                          />
                                        </div>
                                        <button
                                          onClick={() => {
                                            const editorUrl = `/image-editor/?inspectionId=${encodeURIComponent(inspectionId)}&imageUrl=${encodeURIComponent(img.url)}&mode=edit-additional&defectId=${encodeURIComponent(displayDefect._id)}&index=${idx}`;
                                            window.open(editorUrl, '_blank');
                                          }}
                                          className="annotate-btn"
                                          style={{
                                            padding: '0.5rem 1rem',
                                            backgroundColor: '#10b981',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            flexShrink: 0,
                                            whiteSpace: 'nowrap',
                                            fontWeight: 500,
                                            boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                                            marginRight: '8px',
                                            marginTop: 8
                                          }}
                                          title="Annotate this photo"
                                        >
                                          Annotate
                                        </button>
                                        <button
                                          onClick={() => handleRemoveLocationPhoto(idx)}
                                          className="remove-btn"
                                          style={{
                                            padding: '0.5rem 1rem',
                                            backgroundColor: '#dc3545',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            fontSize: '0.85rem',
                                            flexShrink: 0,
                                            whiteSpace: 'nowrap',
                                            fontWeight: 500,
                                            boxShadow: '0 2px 4px rgba(220, 53, 69, 0.2)',
                                            marginTop: 8
                                          }}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                      );
                                    })}
                                  </div>
                                )}
                                
                                {(!displayDefect.additional_images || displayDefect.additional_images.length === 0) && (
                                  <p style={{ color: '#6c757d', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>
                                    No additional location photos yet. Click "Add Location Photo" to add photos from different locations with the same defect.
                                  </p>
                                )}
                              </div>
                            )}

                            {!inspectionDetails.hidePricing && (
                              <div className="detail-row total-cost">
                                <strong>Total Cost:</strong>{' '}
                                {formatCurrency(
                                  calculateTotalCost({
                                    ...displayDefect,
                                    material_total_cost: Number(
                                      isEditing
                                        ? editedValues.material_total_cost ?? displayDefect.material_total_cost ?? 0
                                        : displayDefect.material_total_cost ?? 0
                                    ),
                                    labor_rate: Number(
                                      isEditing
                                        ? editedValues.labor_rate ?? displayDefect.labor_rate ?? 0
                                        : displayDefect.labor_rate ?? 0
                                    ),
                                    hours_required: Number(
                                      isEditing
                                        ? editedValues.hours_required ?? displayDefect.hours_required ?? 0
                                        : displayDefect.hours_required ?? 0
                                    ),
                                  } as Defect)
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {activeTab === 'information' && (
            <InformationSections inspectionId={inspectionId} />
          )}
          </div>

          {/* Floating Scroll to Top Button */}
          {showScrollTop && (
            <button
              onClick={scrollToTop}
              style={{
                position: 'fixed',
                bottom: '100px',
                right: '40px',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                transition: 'all 0.3s ease',
                zIndex: 1000,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.1)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(220, 38, 38, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.4)';
              }}
              title="Back to Top"
            >
              <i className="fas fa-arrow-up"></i>
            </button>
          )}

          <div className="modal-footer">
            <button className="modal-btn secondary-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
