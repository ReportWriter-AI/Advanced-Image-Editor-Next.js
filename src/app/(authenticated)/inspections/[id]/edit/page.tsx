"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import HeaderImageUploader from '../../../../../../components/HeaderImageUploader';
import LocationSearch from '../../../../../../components/LocationSearch';
import FileUpload from '../../../../../../components/FileUpload';
import { LOCATION_OPTIONS } from '../../../../../../constants/locations';
import dynamic from 'next/dynamic';
import { ArrowLeft, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactSelect from 'react-select';
import AsyncSelect from 'react-select/async';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { splitCommaSeparated } from '@/lib/utils';
import TaskDialog from '../_components/TaskDialog';
import TaskCommentsDialog from '../_components/TaskCommentsDialog';
import ServiceSelectionDialog from './_components/ServiceSelectionDialog';
import EventsManager from '@/components/EventsManager';

const InformationSections = dynamic(() => import('../../../../../../components/InformationSections'), { 
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

const ThreeSixtyViewer = dynamic(() => import('../../../../../../components/ThreeSixtyViewer'), { 
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
  isThreeSixty?: boolean;
  additional_images?: Array<{ url: string; location: string; isThreeSixty?: boolean }>;
  base_cost?: number;
  annotations?: any[];
  originalImage?: string;
}

export default function InspectionEditPage() {
  const router = useRouter();
  const params = useParams();
  const inspectionId = params.id as string;

  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedValues, setEditedValues] = useState<Partial<Defect>>({});
  const [inspectionDetails, setInspectionDetails] = useState<{
    headerImage?: string;
    headerText?: string;
    headerName?: string;
    headerAddress?: string;
    hidePricing?: boolean;
    date?: string;
    inspector?: any;
    inspectorId?: string;
    clients?: any[];
    agents?: any[];
    listingAgent?: any[];
    orderId?: number;
    referralSource?: string;
    discountCode?: any;
    discountCodeId?: string;
    token?: string;
    customData?: Record<string, any>;
    internalNotes?: string;
    clientNote?: string;
    services?: Array<{
      serviceId: string;
      serviceName: string;
      addOns?: Array<{ name: string; addFee?: number; addHours?: number }>;
    }>;
    requestedAddons?: any[];
    closingDate?: {
      date?: string;
      lastModifiedBy?: {
        _id: string;
        firstName: string;
        lastName: string;
      };
      lastModifiedAt?: string;
    };
    endOfInspectionPeriod?: {
      date?: string;
      lastModifiedBy?: {
        _id: string;
        firstName: string;
        lastName: string;
      };
      lastModifiedAt?: string;
    };
    officeNotes?: Array<{
      _id: string;
      content: string;
      createdAt: string;
      createdBy: {
        _id: string;
        firstName: string;
        lastName: string;
        profileImageUrl?: string;
      };
    }>;
  }>({});
  const [savingHeaderImage, setSavingHeaderImage] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'defects' | 'information' | 'details'>('details');
  const [autoSaving, setAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Auto-save for inspection details
  const [detailsAutoSaving, setDetailsAutoSaving] = useState(false);
  const [detailsLastSaved, setDetailsLastSaved] = useState<string | null>(null);
  const detailsAutoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [uploadingLocationPhoto, setUploadingLocationPhoto] = useState(false);
  const [newLocationPhoto, setNewLocationPhoto] = useState<{ url: string; location: string } | null>(null);
  
  const [showScrollTop, setShowScrollTop] = useState(false);
  const pageBodyRef = useRef<HTMLDivElement | null>(null);

  const [bulkAddOpen, setBulkAddOpen] = useState<boolean>(false);
  const [bulkItems, setBulkItems] = useState<Array<{ file: File; preview: string; location: string; isThreeSixty: boolean }>>([]);
  const [bulkSaving, setBulkSaving] = useState<boolean>(false);

  const [customLocations, setCustomLocations] = useState<string[]>([]);
  const allLocationOptions = [...LOCATION_OPTIONS, ...customLocations];

  // States for form data options (for Details tab)
  const [inspectors, setInspectors] = useState<{ value: string; label: string }[]>([]);
  const [discountCodes, setDiscountCodes] = useState<any[]>([]);
  const [referralSourceOptions, setReferralSourceOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [customFieldsDefinitions, setCustomFieldsDefinitions] = useState<any[]>([]);

  // Office notes states
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [deletingClientNote, setDeletingClientNote] = useState<boolean>(false);

  // Tasks states
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [selectedTaskForComments, setSelectedTaskForComments] = useState<any>(null);
  const [companyUsers, setCompanyUsers] = useState<Array<{ value: string; label: string; user: any }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [officeNoteToDelete, setOfficeNoteToDelete] = useState<string | null>(null);
  const [clientNoteToDelete, setClientNoteToDelete] = useState<boolean>(false);
  const [serviceToDelete, setServiceToDelete] = useState<{ serviceIndex: number; serviceName: string } | null>(null);
  const [addonToDelete, setAddonToDelete] = useState<{ serviceIndex: number; addonIndex: number; addonName: string; serviceName: string } | null>(null);
  const [deletingService, setDeletingService] = useState(false);
  const [deletingAddon, setDeletingAddon] = useState(false);

  // Events state
  const [events, setEvents] = useState<any[]>([]);

  // Agreements state
  const [agreements, setAgreements] = useState<any[]>([]);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  const [availableAgreements, setAvailableAgreements] = useState<Array<{ value: string; label: string }>>([]);
  const [loadingAvailableAgreements, setLoadingAvailableAgreements] = useState(false);
  const [agreementToDelete, setAgreementToDelete] = useState<string | null>(null);
  const [deletingAgreement, setDeletingAgreement] = useState(false);
  const [addAgreementDialogOpen, setAddAgreementDialogOpen] = useState(false);

  // Service selection dialog state
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);

  // Payment state
  const [paymentInfo, setPaymentInfo] = useState<{
    subtotal: number;
    discountAmount: number;
    total: number;
    amountPaid: number;
    remainingBalance: number;
    isPaid: boolean;
    currency: string;
    paymentHistory?: Array<{
      amount: number;
      paidAt: string;
      stripePaymentIntentId?: string;
      currency?: string;
      paymentMethod?: string;
    }>;
  } | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);

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

  // Fetch form data options for Details tab
  const fetchFormDataOptions = async () => {
    try {
      const [formDataRes, discountCodesRes, reusableDropdownsRes, customFieldsRes] = await Promise.all([
        fetch('/api/inspections/form-data', { credentials: 'include' }),
        fetch('/api/discount-codes', { credentials: 'include' }),
        fetch('/api/reusable-dropdowns', { credentials: 'include' }),
        fetch('/api/scheduling-options/custom-fields', { credentials: 'include' }),
      ]);

      if (formDataRes.ok) {
        const data = await formDataRes.json();
        setInspectors(data.inspectors || []);
      }

      if (discountCodesRes.ok) {
        const data = await discountCodesRes.json();
        const activeCodes = (data.discountCodes || []).filter((code: any) => code.active);
        setDiscountCodes(activeCodes);
      }

      if (reusableDropdownsRes.ok) {
        const data = await reusableDropdownsRes.json();
        const referralSourceValues = splitCommaSeparated(data.referralSources || '');
        setReferralSourceOptions(
          referralSourceValues.map((value) => ({
            value,
            label: value,
          }))
        );
      }

      if (customFieldsRes.ok) {
        const data = await customFieldsRes.json();
        setCustomFieldsDefinitions(data.customFields || []);
      }
    } catch (error) {
      console.error('Error fetching form data options:', error);
    }
  };

  // Fetch agreements from inspection
  const fetchAgreements = async () => {
    try {
      setLoadingAgreements(true);
      
      // Get inspection details with agreements populated
      const inspectionResponse = await fetch(`/api/inspections/${inspectionId}`);
      if (!inspectionResponse.ok) {
        console.error('Failed to fetch inspection for agreements');
        setAgreements([]);
        return;
      }
      
      const inspectionData = await inspectionResponse.json();
      const agreements = inspectionData.agreements || [];
      
      // Agreements are already populated from the API, so we can use them directly
      setAgreements(agreements);
    } catch (error) {
      console.error('Error fetching agreements:', error);
      setAgreements([]);
    } finally {
      setLoadingAgreements(false);
    }
  };

  // Fetch available agreements from company
  const fetchAvailableAgreements = async () => {
    try {
      setLoadingAvailableAgreements(true);
      const response = await fetch('/api/agreements', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        const agreementsList = (data.agreements || []).map((agreement: any) => ({
          value: agreement._id,
          label: agreement.name || 'Unnamed Agreement',
        }));
        setAvailableAgreements(agreementsList);
      } else {
        console.error('Failed to fetch available agreements');
        setAvailableAgreements([]);
      }
    } catch (error) {
      console.error('Error fetching available agreements:', error);
      setAvailableAgreements([]);
    } finally {
      setLoadingAvailableAgreements(false);
    }
  };

  // Fetch payment information
  const fetchPaymentInfo = async () => {
    try {
      setLoadingPayment(true);
      const response = await fetch(`/api/inspections/${inspectionId}/payment`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setPaymentInfo(data);
      } else {
        console.error('Failed to fetch payment info');
        setPaymentInfo(null);
      }
    } catch (error) {
      console.error('Error fetching payment info:', error);
      setPaymentInfo(null);
    } finally {
      setLoadingPayment(false);
    }
  };

  const getProxiedSrc = useCallback((url?: string | null) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('/api/proxy-image?')) return url;
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }, []);

  const handleImgError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    const current = img.getAttribute('src') || '';
    if (current && !current.startsWith('/api/proxy-image?') && !current.startsWith('data:')) {
      img.src = `/api/proxy-image?url=${encodeURIComponent(current)}`;
    } else {
      img.src = '/placeholder-image.jpg';
    }
  }, []);

  // Fetch defects and inspection details when page loads
  useEffect(() => {
    if (inspectionId) {
      fetchDefects();
      fetchInspectionDetails();
      fetchFormDataOptions();
      fetchTasks();
      fetchCompanyUsers();
      fetchAgreements();
      fetchAvailableAgreements();
      fetchPaymentInfo();
      
      // Get current user ID
      fetch('/api/auth/verify-token', {
        method: 'POST',
        credentials: 'include',
      })
        .then(res => res.json())
        .then(data => {
          if (data.user?.id) {
            setCurrentUserId(data.user.id);
          }
        })
        .catch(err => console.error('Error getting current user:', err));
      
      let hasAlerted = false;
      
      const checkForPendingAnnotation = () => {
        const pending = localStorage.getItem('pendingAnnotation');
        if (pending && !hasAlerted) {
          try {
            const annotation = JSON.parse(pending);
            if (annotation.inspectionId === inspectionId) {
              console.log('🔄 Switching to Information Sections tab for pending annotation');
              setActiveTab('information');
              alert('✅ Image saved successfully!');
              hasAlerted = true;
            }
          } catch (e) {
            console.error('Error parsing pending annotation:', e);
          }
        }
      };
      
      checkForPendingAnnotation();
      
      let pollCount = 0;
      const maxPolls = 6;
      
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
      
      const applyPendingAdditionalPhoto = () => {
        try {
          const pending = localStorage.getItem('pendingAdditionalLocationPhoto');
          if (!pending) return;
          const data = JSON.parse(pending);
          if (data && data.inspectionId === inspectionId && data.defectId) {
            setDefects(prev => prev.map(d => {
              if (d._id !== data.defectId) return d;
              const nextImages = [...(d.additional_images || [])];
              if (!nextImages.some((img) => img.url === data.photo?.url)) {
                nextImages.push({ url: data.photo?.url, location: data.photo?.location || '', isThreeSixty: !!data.photo?.isThreeSixty });
              }
              return { ...d, additional_images: nextImages };
            }));

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

            localStorage.removeItem('pendingAdditionalLocationPhoto');
          }
        } catch (e) {
          console.error('Error applying pending additional photo:', e);
        }
      };

      const applyPendingEditedAdditionalPhoto = () => {
        try {
          const pending = localStorage.getItem('pendingEditedAdditionalLocationPhoto');
          if (!pending) return;
          const data = JSON.parse(pending);
          if (data && data.inspectionId === inspectionId && data.defectId) {
            const { defectId, index, oldUrl, newUrl } = data as { defectId: string; index?: number; oldUrl?: string; newUrl: string };

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

            localStorage.removeItem('pendingEditedAdditionalLocationPhoto');
          }
        } catch (e) {
          console.error('Error applying edited additional photo:', e);
        }
      };

      const applyPendingMainImageUpdate = () => {
        try {
          const pending = localStorage.getItem('pendingDefectMainImageUpdate');
          if (!pending) return;
          const data = JSON.parse(pending);
          if (data && data.inspectionId === inspectionId && data.defectId && data.newImageUrl) {
            const { defectId, newImageUrl } = data;

            setDefects(prev => prev.map(d => {
              if (d._id !== defectId) return d;
              return { ...d, image: newImageUrl };
            }));

            setEditedValues(prev => {
              if (!editingId || editingId !== defectId) return prev;
              return { ...prev, image: newImageUrl };
            });

            localStorage.removeItem('pendingDefectMainImageUpdate');
          }
        } catch (e) {
          console.error('Error applying main image update:', e);
        }
      };

      applyPendingAdditionalPhoto();
      applyPendingEditedAdditionalPhoto();
      applyPendingMainImageUpdate();

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
    }
  }, [inspectionId]);

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchDefects = async () => {
    try {
      setLoading(true);
      console.log('📥 Fetching defects for inspection:', inspectionId);
      const response = await fetch(`/api/defects/${inspectionId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Fetched defects:', data.length);

        data.forEach((defect: any, idx: number) => {
          console.log(`Defect ${idx}:`, {
            id: defect._id,
            hasAnnotations: !!defect.annotations,
            annotationsCount: defect.annotations?.length || 0,
            hasOriginalImage: !!defect.originalImage
          });
        });

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

  const calculateTotalCost = (defect: Defect): number => {
    const materialCost = defect.base_cost || defect.material_total_cost || 0;
    const laborCost = (defect.labor_rate || 0) * (defect.hours_required || 0);
    const baseCost = materialCost + laborCost;
    
    const imageCount = 1 + (defect.additional_images?.length || 0);
    return baseCost * imageCount;
  };

  const handleAddLocationPhoto = () => {
    if (!editingId) return;
    const defect = defects.find(d => d._id === editingId);
    if (!defect) return;
    
    const params = new URLSearchParams({
      inspectionId: inspectionId,
      mode: 'additional-location',
      defectId: editingId,
    });
    window.open(`/image-editor?${params.toString()}`, '_blank');
  };

  const handleRemoveLocationPhoto = async (index: number) => {
    if (!editingId) return;
    const defect = defects.find(d => d._id === editingId);
    if (!defect || !defect.additional_images) return;

    const updatedImages = defect.additional_images.filter((_, i) => i !== index);
        
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

  const handleAddNewLocation = (newLocation: string) => {
    if (!customLocations.includes(newLocation) && !LOCATION_OPTIONS.includes(newLocation)) {
      setCustomLocations(prev => [...prev, newLocation]);
    }
  };

  const handleAnnotateMainImage = (defect: Defect) => {
    if (!defect.image) {
      alert('No image to annotate');
      return;
    }

    console.log('🎨 handleAnnotateMainImage called for defect:', defect._id);
    console.log('📊 Defect data:', {
      hasAnnotations: !!defect.annotations,
      annotationsCount: defect.annotations?.length || 0,
      hasOriginalImage: !!defect.originalImage,
      originalImage: defect.originalImage,
      currentImage: defect.image
    });

    localStorage.setItem('editorMode', 'defect-main');
    localStorage.setItem('editingDefectId', defect._id);
    localStorage.setItem('editingInspectionId', inspectionId);

    if (defect.annotations && defect.annotations.length > 0) {
      console.log('✅ Saving annotations to localStorage:', defect.annotations);
      localStorage.setItem('defectAnnotations', JSON.stringify(defect.annotations));
    } else {
      console.log('⚠️ No annotations found in defect, removing from localStorage');
      localStorage.removeItem('defectAnnotations');
    }

    const imageToEdit = defect.originalImage || defect.image;
    console.log('🖼️ Image to edit:', imageToEdit);
    localStorage.setItem('defectOriginalImage', imageToEdit);

    window.open(
      `/image-editor?src=${encodeURIComponent(imageToEdit)}&mode=defect-main&defectId=${defect._id}&inspectionId=${inspectionId}`,
      '_blank'
    );
  };

  const handleUpdateLocationForImage = async (index: number, newLocation: string) => {
    console.log('🔄 handleUpdateLocationForImage called:', { index, newLocation, editingId });
    
    if (!editingId) return;
    const defect = defects.find(d => d._id === editingId);
    if (!defect || !defect.additional_images) return;

    console.log('Current defect.additional_images:', defect.additional_images);

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
    
    const updatedImages = defect.additional_images.map((img, i) =>
      i === index ? { ...img, location: newLocation } : img
    );

    setDefects(prev =>
      prev.map(d =>
        d._id === editingId ? { ...d, additional_images: updatedImages } : d
      )
    );

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
        setInspectionDetails(prev => ({ ...prev, hidePricing: !hide }));
      }
    } catch (e) {
      console.error('Error updating hide pricing setting:', e);
      setInspectionDetails(prev => ({ ...prev, hidePricing: !hide }));
    }
  };

  // Update handlers for Inspection Details tab
  const updateInspector = async (inspectorId: string | undefined) => {
    try {
      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspector: inspectorId || null })
      });
      
      if (response.ok) {
        // Refresh inspection details to get updated data
        await fetchInspectionDetails();
      } else {
        console.error('Failed to update inspector');
      }
    } catch (e) {
      console.error('Error updating inspector:', e);
    }
  };

  const updateClients = async (clientIds: string[]) => {
    try {
      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clients: clientIds })
      });
      
      if (response.ok) {
        await fetchInspectionDetails();
      } else {
        console.error('Failed to update clients');
      }
    } catch (e) {
      console.error('Error updating clients:', e);
    }
  };

  const updateAgents = async (agentIds: string[]) => {
    try {
      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agents: agentIds })
      });
      
      if (response.ok) {
        await fetchInspectionDetails();
      } else {
        console.error('Failed to update agents');
      }
    } catch (e) {
      console.error('Error updating agents:', e);
    }
  };

  const updateListingAgents = async (agentIds: string[]) => {
    try {
      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingAgent: agentIds })
      });
      
      if (response.ok) {
        await fetchInspectionDetails();
      } else {
        console.error('Failed to update listing agents');
      }
    } catch (e) {
      console.error('Error updating listing agents:', e);
    }
  };

  const triggerDetailsAutoSave = useCallback(() => {
    if (detailsAutoSaveTimerRef.current) {
      clearTimeout(detailsAutoSaveTimerRef.current);
    }
    
    detailsAutoSaveTimerRef.current = setTimeout(() => {
      performDetailsAutoSave();
    }, 2000);
  }, [inspectionDetails, inspectionId, currentUserId]);

  const performDetailsAutoSave = async () => {
    setDetailsAutoSaving(true);
    
    try {
      const updatePayload: any = {};
      
      if (inspectionDetails.referralSource !== undefined) {
        updatePayload.referralSource = inspectionDetails.referralSource || null;
      }
      if (inspectionDetails.discountCodeId !== undefined) {
        updatePayload.discountCode = inspectionDetails.discountCodeId || null;
      }
      if (inspectionDetails.customData !== undefined) {
        updatePayload.customData = inspectionDetails.customData;
      }
      if (inspectionDetails.internalNotes !== undefined) {
        updatePayload.internalNotes = inspectionDetails.internalNotes || null;
      }
      if (inspectionDetails.closingDate !== undefined && inspectionDetails.closingDate !== null) {
        updatePayload.closingDate = {
          date: inspectionDetails.closingDate.date || null,
          lastModifiedBy: currentUserId || inspectionDetails.closingDate.lastModifiedBy?._id || null,
          lastModifiedAt: new Date(),
        };
      }
      if (inspectionDetails.endOfInspectionPeriod !== undefined && inspectionDetails.endOfInspectionPeriod !== null) {
        updatePayload.endOfInspectionPeriod = {
          date: inspectionDetails.endOfInspectionPeriod.date || null,
          lastModifiedBy: currentUserId || inspectionDetails.endOfInspectionPeriod.lastModifiedBy?._id || null,
          lastModifiedAt: new Date(),
        };
      }

      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
      
      if (response.ok) {
        const now = new Date();
        setDetailsLastSaved(now.toLocaleTimeString());
        await fetchInspectionDetails();
        // Refresh payment info if discount code or services might have changed
        if (updatePayload.discountCode !== undefined) {
          await fetchPaymentInfo();
        }
      }
    } catch (e) {
      console.error('Error auto-saving inspection details:', e);
    } finally {
      setDetailsAutoSaving(false);
    }
  };

  const updateReferralSource = (source: string | undefined) => {
    setInspectionDetails(prev => ({ ...prev, referralSource: source }));
    triggerDetailsAutoSave();
  };

  const updateDiscountCode = (codeId: string | undefined) => {
    setInspectionDetails(prev => ({ ...prev, discountCodeId: codeId }));
    triggerDetailsAutoSave();
  };

  const updateCustomField = (fieldKey: string, value: any) => {
    setInspectionDetails(prev => ({
      ...prev,
      customData: {
        ...(prev.customData || {}),
        [fieldKey]: value,
      },
    }));
    triggerDetailsAutoSave();
  };

  const updateInternalNotes = (notes: string) => {
    setInspectionDetails(prev => ({ ...prev, internalNotes: notes }));
    triggerDetailsAutoSave();
  };

  const updateClosingDate = async (date: string) => {
    if (!currentUserId) return;
    
    const dateValue = date ? new Date(date + 'T00:00:00') : null;
    
    const newClosingDate = dateValue ? {
      date: dateValue.toISOString(),
      lastModifiedBy: {
        _id: currentUserId,
        firstName: '',
        lastName: '',
      },
      lastModifiedAt: new Date().toISOString(),
    } : {
      date: undefined,
      lastModifiedBy: {
        _id: currentUserId,
        firstName: '',
        lastName: '',
      },
      lastModifiedAt: new Date().toISOString(),
    };
    
    setInspectionDetails(prev => ({
      ...prev,
      closingDate: newClosingDate,
    }));

    setDetailsAutoSaving(true);
    try {
      const updatePayload = {
        closingDate: {
          date: dateValue ? dateValue.toISOString() : null,
          lastModifiedBy: currentUserId,
          lastModifiedAt: new Date(),
        }
      };

      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
      
      if (response.ok) {
        const now = new Date();
        setDetailsLastSaved(now.toLocaleTimeString());
        toast.success('Closing date saved successfully');
        await fetchInspectionDetails();
      } else {
        toast.error('Failed to save closing date');
      }
    } catch (e) {
      toast.error('Error saving closing date');
    } finally {
      setDetailsAutoSaving(false);
    }
  };

  const updateEndOfInspectionPeriod = async (date: string) => {
    if (!currentUserId) return;
    
    const dateValue = date ? new Date(date + 'T00:00:00') : null;
    
    const newEndOfInspectionPeriod = dateValue ? {
      date: dateValue.toISOString(),
      lastModifiedBy: {
        _id: currentUserId,
        firstName: '',
        lastName: '',
      },
      lastModifiedAt: new Date().toISOString(),
    } : {
      date: undefined,
      lastModifiedBy: {
        _id: currentUserId,
        firstName: '',
        lastName: '',
      },
      lastModifiedAt: new Date().toISOString(),
    };
    
    setInspectionDetails(prev => ({
      ...prev,
      endOfInspectionPeriod: newEndOfInspectionPeriod,
    }));

    setDetailsAutoSaving(true);
    try {
      const updatePayload = {
        endOfInspectionPeriod: {
          date: dateValue ? dateValue.toISOString() : null,
          lastModifiedBy: currentUserId,
          lastModifiedAt: new Date(),
        }
      };

      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });
      
      if (response.ok) {
        const now = new Date();
        setDetailsLastSaved(now.toLocaleTimeString());
        toast.success('End of inspection period saved successfully');
        await fetchInspectionDetails();
      } else {
        toast.error('Failed to save end of inspection period');
      }
    } catch (e) {
      toast.error('Error saving end of inspection period');
    } finally {
      setDetailsAutoSaving(false);
    }
  };

  // Tasks functions
  const fetchTasks = async () => {
    setLoadingTasks(true);
    try {
      const response = await fetch(`/api/inspections/${inspectionId}/tasks`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      } else {
        console.error('Failed to fetch tasks');
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoadingTasks(false);
    }
  };

  const fetchCompanyUsers = async () => {
    try {
      const response = await fetch('/api/team', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        const users = (data.team || []).map((user: any) => ({
          value: user._id,
          label: `${user.firstName} ${user.lastName}`,
          user,
        }));
        setCompanyUsers(users);
      }
    } catch (error) {
      console.error('Error fetching company users:', error);
    }
  };

  const handleCreateTask = () => {
    setEditingTask(null);
    setTaskDialogOpen(true);
  };

  const handleEditTask = (task: any) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      const response = await fetch(`/api/inspections/${inspectionId}/tasks/${taskToDelete}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTasks(tasks.filter(t => t._id !== taskToDelete));
        setTaskToDelete(null);
      } else {
        const errorData = await response.json();
        alert(`Failed to delete task: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/inspections/${inspectionId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(tasks.map(t => t._id === taskId ? data.task : t));
      } else {
        const errorData = await response.json();
        alert(`Failed to update status: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const handleViewComments = (task: any) => {
    setSelectedTaskForComments(task);
    setCommentsDialogOpen(true);
  };

  const handleTaskSaved = () => {
    fetchTasks();
  };

  const getTaskTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      Confirm: 'bg-blue-100 text-blue-800 border-blue-200',
      Inquiry: 'bg-purple-100 text-purple-800 border-purple-200',
      Networking: 'bg-green-100 text-green-800 border-green-200',
      Scheduling: 'bg-orange-100 text-orange-800 border-orange-200',
      Other: 'bg-gray-100 text-gray-800 border-gray-200',
    };
    return colors[type] || colors.Other;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'On Hold': 'text-amber-600',
      'In Progress': 'text-blue-600',
      'Complete': 'text-green-600',
    };
    return colors[status] || '';
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date();
  };

  // Office Notes functions
  const handleAddOfficeNote = async () => {
    if (!newNoteContent.trim()) {
      alert('Please enter a note');
      return;
    }

    setSavingNote(true);
    try {
      const response = await fetch(`/api/inspections/${inspectionId}/office-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        // Add the new note to the state
        setInspectionDetails(prev => ({
          ...prev,
          officeNotes: [data.note, ...(prev.officeNotes || [])],
        }));
        setNewNoteContent('');
      } else {
        const errorData = await response.json();
        alert(`Failed to add note: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding office note:', error);
      alert('Failed to add note. Please try again.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteOfficeNote = async () => {
    if (!officeNoteToDelete) return;

    setDeletingNoteId(officeNoteToDelete);
    try {
      const response = await fetch(`/api/inspections/${inspectionId}/office-notes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: officeNoteToDelete }),
      });

      if (response.ok) {
        // Remove the note from the state
        setInspectionDetails(prev => ({
          ...prev,
          officeNotes: (prev.officeNotes || []).filter(note => note._id !== officeNoteToDelete),
        }));
        setOfficeNoteToDelete(null);
      } else {
        const errorData = await response.json();
        alert(`Failed to delete note: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting office note:', error);
      alert('Failed to delete note. Please try again.');
    } finally {
      setDeletingNoteId(null);
    }
  };

  const handleDeleteClientNote = async () => {
    setDeletingClientNote(true);
    try {
      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientNote: null }),
      });

      if (response.ok) {
        // Remove the client note from the state
        setInspectionDetails(prev => ({
          ...prev,
          clientNote: undefined,
        }));
        setClientNoteToDelete(false);
        toast.success('Customer note deleted successfully');
      } else {
        const errorData = await response.json();
        toast.error(`Failed to delete note: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting customer note:', error);
      toast.error('Failed to delete note. Please try again.');
    } finally {
      setDeletingClientNote(false);
    }
  };

  // Addon request handlers
  const handleApproveAddon = async (requestIndex: number) => {
    try {
      // @ts-ignore
      const request = inspectionDetails.requestedAddons?.filter((req: any) => req.status === 'pending')[requestIndex];
      
      if (!request) {
        toast.error('Request not found');
        return;
      }

      // Find the service in the inspection
      // @ts-ignore
      const serviceIndex = inspectionDetails.services?.findIndex(
        (s: any) => s.serviceId?.toString() === request.serviceId?.toString()
      );

      if (serviceIndex === -1 || serviceIndex === undefined) {
        toast.error('Service not found in inspection');
        return;
      }

      // Update the request status and add addon to service
      // @ts-ignore
      const updatedRequestedAddons = [...(inspectionDetails.requestedAddons || [])];
      const actualRequestIndex = updatedRequestedAddons.findIndex(
        (req: any) => req.serviceId?.toString() === request.serviceId?.toString() && 
                      req.addonName === request.addonName && 
                      req.status === 'pending'
      );

      if (actualRequestIndex === -1) {
        toast.error('Request not found');
        return;
      }

      updatedRequestedAddons[actualRequestIndex] = {
        ...updatedRequestedAddons[actualRequestIndex],
        status: 'approved',
        processedAt: new Date().toISOString(),
      };

      // Add addon to service
      // @ts-ignore
      const updatedServices = [...(inspectionDetails.services || [])];
      if (!updatedServices[serviceIndex].addOns) {
        updatedServices[serviceIndex].addOns = [];
      }

      updatedServices[serviceIndex].addOns.push({
        name: request.addonName,
        addFee: request.addFee,
        addHours: request.addHours,
      });

      // Update in database
      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedAddons: updatedRequestedAddons,
          services: updatedServices,
        }),
      });

      if (response.ok) {
        setInspectionDetails(prev => ({
          ...prev,
          requestedAddons: updatedRequestedAddons,
          services: updatedServices,
        }));
        // Refresh payment info
        await fetchPaymentInfo();
        toast.success('Add-on approved and added to service');
      } else {
        const errorData = await response.json();
        toast.error(`Failed to approve: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error approving addon:', error);
      toast.error('Failed to approve add-on. Please try again.');
    }
  };

  const handleRejectAddon = async (requestIndex: number) => {
    try {
      // @ts-ignore
      const request = inspectionDetails.requestedAddons?.filter((req: any) => req.status === 'pending')[requestIndex];
      
      if (!request) {
        toast.error('Request not found');
        return;
      }

      // Update the request status
      // @ts-ignore
      const updatedRequestedAddons = [...(inspectionDetails.requestedAddons || [])];
      const actualRequestIndex = updatedRequestedAddons.findIndex(
        (req: any) => req.serviceId?.toString() === request.serviceId?.toString() && 
                      req.addonName === request.addonName && 
                      req.status === 'pending'
      );

      if (actualRequestIndex === -1) {
        toast.error('Request not found');
        return;
      }

      updatedRequestedAddons[actualRequestIndex] = {
        ...updatedRequestedAddons[actualRequestIndex],
        status: 'rejected',
        processedAt: new Date().toISOString(),
      };

      // Update in database
      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestedAddons: updatedRequestedAddons,
        }),
      });

      if (response.ok) {
        setInspectionDetails(prev => ({
          ...prev,
          requestedAddons: updatedRequestedAddons,
        }));
        // Refresh payment info (in case it was previously approved)
        await fetchPaymentInfo();
        toast.info('Add-on request rejected');
      } else {
        const errorData = await response.json();
        toast.error(`Failed to reject: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error rejecting addon:', error);
      toast.error('Failed to reject add-on. Please try again.');
    }
  };

  const handleSaveServices = async (selectedServices: Array<{
    serviceId: string;
    serviceName: string;
    addOns: Array<{ name: string; addFee?: number; addHours?: number }>;
  }>) => {
    try {
      // @ts-ignore
      const existingServices = [...(inspectionDetails.services || [])];
      const updatedServices = [...existingServices];
      
      selectedServices.forEach(selectedService => {
        const serviceIdString = typeof selectedService.serviceId === 'string' 
          ? selectedService.serviceId 
          : String(selectedService.serviceId);
        
        // Find if this service already exists
        const existingServiceIndex = updatedServices.findIndex(s => {
          const existingId = typeof s.serviceId === 'string' 
            ? s.serviceId 
            : String(s.serviceId);
          return existingId === serviceIdString;
        });
        
        if (existingServiceIndex >= 0) {
          // Service exists - merge addons
          const existingService = updatedServices[existingServiceIndex];
          const existingAddons = existingService.addOns || [];
          const existingAddonNames = new Set(
            existingAddons.map((a: any) => a.name.toLowerCase())
          );
          
          // Add only new addons that don't already exist
          const newAddons = selectedService.addOns.filter(addon => 
            !existingAddonNames.has(addon.name.toLowerCase())
          );
          
          if (newAddons.length > 0) {
            updatedServices[existingServiceIndex] = {
              ...existingService,
              addOns: [...existingAddons, ...newAddons]
            };
          }
        } else {
          // New service - add it
          updatedServices.push(selectedService);
        }
      });
      
      // Update in database
      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: updatedServices }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save services');
      }
      
      // Update local state
      setInspectionDetails(prev => ({
        ...prev,
        services: updatedServices
      }));
      
      // Refresh payment info
      await fetchPaymentInfo();
      
      const newServicesCount = selectedServices.filter(s => {
        const serviceIdString = typeof s.serviceId === 'string' ? s.serviceId : String(s.serviceId);
        return !existingServices.some(existing => {
          const existingId = typeof existing.serviceId === 'string' 
            ? existing.serviceId 
            : String(existing.serviceId);
          return existingId === serviceIdString;
        });
      }).length;
      
      const addonsCount = selectedServices.reduce((sum, s) => sum + s.addOns.length, 0);
      
      if (newServicesCount > 0 && addonsCount > 0) {
        toast.success(`${newServicesCount} service${newServicesCount > 1 ? 's' : ''} and ${addonsCount} addon${addonsCount > 1 ? 's' : ''} added successfully`);
      } else if (newServicesCount > 0) {
        toast.success(`${newServicesCount} service${newServicesCount > 1 ? 's' : ''} added successfully`);
      } else if (addonsCount > 0) {
        toast.success(`${addonsCount} addon${addonsCount > 1 ? 's' : ''} added successfully`);
      } else {
        toast.success('Updated successfully');
      }
    } catch (error: any) {
      console.error('Error saving services:', error);
      toast.error(error.message || 'Failed to save services');
    }
  };

  const handleDeleteService = async () => {
    if (!serviceToDelete) return;

    // @ts-ignore
    const currentServices = inspectionDetails.services || [];
    
    // Validation: An inspection must have at least 1 service
    if (currentServices.length <= 1) {
      toast.error('An inspection must have at least one service. Cannot delete the last service.');
      setServiceToDelete(null);
      return;
    }

    setDeletingService(true);
    try {
      // @ts-ignore
      const updatedServices = [...(inspectionDetails.services || [])];
      updatedServices.splice(serviceToDelete.serviceIndex, 1);

      // Double-check validation before sending to API
      if (updatedServices.length === 0) {
        throw new Error('An inspection must have at least one service');
      }

      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: updatedServices }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete service');
      }

      setInspectionDetails(prev => ({
        ...prev,
        services: updatedServices
      }));

      // Refresh payment info
      await fetchPaymentInfo();

      toast.success(`Service "${serviceToDelete.serviceName}" and all its add-ons deleted successfully`);
      setServiceToDelete(null);
    } catch (error: any) {
      console.error('Error deleting service:', error);
      toast.error(error.message || 'Failed to delete service');
    } finally {
      setDeletingService(false);
    }
  };

  const handleDeleteAddon = async () => {
    if (!addonToDelete) return;

    setDeletingAddon(true);
    try {
      // @ts-ignore
      const updatedServices = [...(inspectionDetails.services || [])];
      const service = updatedServices[addonToDelete.serviceIndex];
      
      if (service && service.addOns) {
        const updatedAddons = [...service.addOns];
        updatedAddons.splice(addonToDelete.addonIndex, 1);
        updatedServices[addonToDelete.serviceIndex] = {
          ...service,
          addOns: updatedAddons
        };
      }

      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ services: updatedServices }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete add-on');
      }

      setInspectionDetails(prev => ({
        ...prev,
        services: updatedServices
      }));

      // Refresh payment info
      await fetchPaymentInfo();

      toast.success(`Add-on "${addonToDelete.addonName}" deleted successfully`);
      setAddonToDelete(null);
    } catch (error: any) {
      console.error('Error deleting add-on:', error);
      toast.error(error.message || 'Failed to delete add-on');
    } finally {
      setDeletingAddon(false);
    }
  };

  // Agreement management functions
  const handleAddAgreement = async (agreementId: string) => {
    try {
      // Check if agreement already exists in inspection (prevent duplicates)
      const existingAgreementIds = agreements.map((a: any) => {
        // Handle both formatted (from formatInspection) and raw (from API) structures
        const id = a._id || a.agreementId?._id || a.agreementId;
        return id?.toString();
      });
      
      if (existingAgreementIds.includes(agreementId)) {
        toast.error('This agreement is already added to the inspection');
        return;
      }

      // Get current agreements from inspection
      const currentAgreements = agreements.map((a: any) => {
        // Handle both formatted and raw structures
        const id = a._id || a.agreementId?._id || a.agreementId;
        return {
          agreementId: id?.toString() || a.agreementId,
          isSigned: a.isSigned || false,
          inputData: a.inputData || {},
        };
      });

      // Add new agreement
      const updatedAgreements = [
        ...currentAgreements,
        {
          agreementId,
          isSigned: false,
          inputData: {},
        },
      ];

      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreements: updatedAgreements }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add agreement');
      }

      // Refresh agreements list
      await fetchAgreements();
      toast.success('Agreement added successfully');
      setAddAgreementDialogOpen(false);
    } catch (error: any) {
      console.error('Error adding agreement:', error);
      toast.error(error.message || 'Failed to add agreement');
    }
  };

  const handleDeleteAgreement = async () => {
    if (!agreementToDelete) return;

    setDeletingAgreement(true);
    try {
      // Get current agreements and remove the one to delete
      const updatedAgreements = agreements
        .map((a: any) => {
          // Handle both formatted and raw structures
          const id = a._id || a.agreementId?._id || a.agreementId;
          return {
            agreementId: id?.toString() || a.agreementId,
            isSigned: a.isSigned || false,
            inputData: a.inputData || {},
          };
        })
        .filter((a: any) => a.agreementId !== agreementToDelete);

      const response = await fetch(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreements: updatedAgreements }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete agreement');
      }

      // Refresh agreements list
      await fetchAgreements();
      toast.success('Agreement removed successfully');
      setAgreementToDelete(null);
    } catch (error: any) {
      console.error('Error deleting agreement:', error);
      toast.error(error.message || 'Failed to delete agreement');
    } finally {
      setDeletingAgreement(false);
    }
  };

  const startEditing = (defect: Defect) => {
    setEditingId(defect._id);
    setEditedValues({ ...defect });
    setLastSaved(null);
  };

  const cancelEditing = () => {
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
    
    triggerAutoSave();
  };

  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
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
          additional_images: updated.additional_images,
          base_cost: updated.base_cost,
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Auto-save error:", errorData.error);
        return;
      }
  
      const result = await response.json();
      console.log("✅ Auto-saved successfully:", result.message);
  
      setDefects(prev =>
        prev.map(d => (d._id === editingId ? updated : d))
      );
      
      const now = new Date();
      setLastSaved(now.toLocaleTimeString());
      
    } catch (err) {
      console.error("Auto-save error:", err);
    } finally {
      setAutoSaving(false);
    }
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (detailsAutoSaveTimerRef.current) {
        clearTimeout(detailsAutoSaveTimerRef.current);
      }
    };
  }, []);

  const saveEdited = async () => {
    if (!editingId) return;
    const index = defects.findIndex(d => d._id === editingId);
    if (index === -1) return;
  
    const updated: Defect = { ...defects[index], ...(editedValues as Defect) };
  
    console.log('Edited defect values:', updated);
  
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
      const merged = { ...defect, ...(editedValues as Partial<Defect>) } as Defect;
      
      if (editedValues.additional_images !== undefined) {
        merged.additional_images = editedValues.additional_images as any;
      }
      
      console.log('getDisplayDefect merged:', merged.additional_images);
      return merged;
    }
    return defect;
  };

  return (
    <div className="container mx-auto py-6">
      {/* Header with back button */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/inspections')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Inspections
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Inspection</h1>
            <p className="text-muted-foreground mt-1">ID: {inspectionId.slice(-8)}</p>
          </div>
        </div>
        
        {/* Client View Actions */}
        {inspectionDetails.token && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const clientViewUrl = `${window.location.origin}/inspection/${inspectionId}?token=${inspectionDetails.token}`;
                window.open(clientViewUrl, '_blank');
              }}
              className="flex items-center gap-2"
            >
              <i className="fas fa-external-link-alt"></i>
              Client View
            </Button>
            <Button
              onClick={() => {
                const clientViewUrl = `${window.location.origin}/inspection/${inspectionId}?token=${inspectionDetails.token}`;
                navigator.clipboard.writeText(clientViewUrl).then(() => {
                  toast.success('Link copied to clipboard!');
                }).catch(() => {
                  toast.error('Failed to copy link');
                });
              }}
              className="flex items-center gap-2"
            >
              <i className="fas fa-copy"></i>
              Copy Link
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-3 border-b-2 font-semibold transition-colors ${
              activeTab === 'details'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Inspection Details
          </button>
          <button
            onClick={() => setActiveTab('defects')}
            className={`px-4 py-3 border-b-2 font-semibold transition-colors ${
              activeTab === 'defects'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Defects
          </button>
          <button
            onClick={() => setActiveTab('information')}
            className={`px-4 py-3 border-b-2 font-semibold transition-colors ${
              activeTab === 'information'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Information Sections
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-card rounded-lg border p-6">
        {activeTab === 'defects' && (
          <>
            {/* Header Image Upload */}
            <div className="header-image-section mb-8">
              <h3 className="text-xl font-semibold mb-2">Report Header Image</h3>
              <p className="text-sm text-muted-foreground mb-4">Upload a custom image to use as the header for this inspection report.</p>
              
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
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-2">Report Settings</h3>
              <p className="text-sm text-muted-foreground mb-4">Configure how this inspection report is displayed.</p>
              
              <div className="mt-4">
                <label className="flex items-center gap-3 p-3 bg-muted rounded-md border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inspectionDetails.hidePricing || false}
                    onChange={(e) => toggleHidePricing(e.target.checked)}
                    className="w-5 h-5 cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">
                      Hide Pricing
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Hide cost estimates, materials cost, labor cost, hours, and total cost in all report formats (web, PDF, HTML export)
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="border-t my-6"></div>
            <h3 className="text-xl font-semibold mb-4">Manage Defects</h3>
            
            {loading ? (
              <div className="loading-container flex flex-col items-center justify-center py-12">
                <div className="loading-spinner border-4 border-t-4 border-gray-200 border-t-primary rounded-full w-12 h-12 animate-spin mb-4"></div>
                <p>Loading defects...</p>
              </div>
            ) : defects.length === 0 ? (
              <div className="empty-state text-center py-12">
                <i className="fas fa-exclamation-triangle empty-icon text-4xl text-muted-foreground mb-4"></i>
                <h3 className="text-xl font-semibold mb-2">No Defects Found</h3>
                <p className="text-muted-foreground">This inspection has no defects recorded.</p>
              </div>
            ) : (
              <div className="defects-list space-y-6">
                {defects.map((defect, index) => {
                  const displayDefect = getDisplayDefect(defect);
                  const isEditing = editingId === defect._id;
                  return (
                    <div key={defect._id} className="defect-card border rounded-lg p-6">
                      <div className="defect-header flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Defect #{index + 1}</h3>
                        <div className="defect-actions flex items-center gap-2">
                          {!isEditing && (
                            <button
                              className="professional-edit-btn px-3 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                              onClick={() => startEditing(defect)}
                              title="Edit defect"
                            >
                              <i className="fas fa-edit"></i>
                            </button>
                          )}
                          {isEditing && (
                            <>
                              <div className="auto-save-indicator mr-2 text-xs flex items-center gap-2">
                                {autoSaving ? (
                                  <>
                                    <i className="fas fa-spinner fa-spin"></i>
                                    <span>Saving...</span>
                                  </>
                                ) : lastSaved ? (
                                  <>
                                    <i className="fas fa-check-circle text-green-600"></i>
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
                                className="cancel-defect-btn px-3 py-2 rounded-md bg-green-600 text-white hover:bg-green-700" 
                                onClick={cancelEditing}
                                title="Done editing"
                              >
                                <i className="fas fa-check"></i>
                              </button>
                            </>
                          )}
                          <button
                            className="delete-defect-btn px-3 py-2 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

                      <div className="defect-content grid md:grid-cols-2 gap-6">
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
                                  className="max-w-full max-h-[200px] cursor-pointer rounded-md"
                                  onError={handleImgError}
                                  onClick={() => setPlayingVideoId(displayDefect._id)}
                                />
                              ) : (
                                <video
                                  src={getProxiedSrc(displayDefect.video)}
                                  controls
                                  autoPlay
                                  className="max-w-full max-h-[200px] rounded-md"
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
                              className="rounded-md w-full"
                            />
                          )}
                          {displayDefect.image && !displayDefect.isThreeSixty && displayDefect.type !== "video" && (
                            <button
                              onClick={() => handleAnnotateMainImage(displayDefect)}
                              className="mt-2 w-full px-3 py-2 text-sm rounded-md border border-purple-600 bg-purple-600 text-white font-semibold hover:bg-purple-700"
                            >
                              <i className="fas fa-pencil-alt mr-2"></i>
                              Annotate
                            </button>
                          )}
                        </div>
                        <div className="defect-details space-y-3">
                          <div className="detail-row">
                            <strong className="block text-sm font-semibold mb-1">Location:</strong>
                            {isEditing ? (
                              <LocationSearch
                                options={allLocationOptions}
                                value={editedValues.location ?? displayDefect.location ?? ''}
                                onChangeAction={(val) => handleFieldChange('location', val)}
                                placeholder="Select location…"
                                width={220}
                              />
                            ) : (
                              <span className="text-sm">{displayDefect.location || 'Not specified'}</span>
                            )}
                          </div>
                          <div className="detail-row">
                            <strong className="block text-sm font-semibold mb-1">Section:</strong>
                            {isEditing ? (
                              <Input
                                type="text"
                                value={editedValues.section ?? displayDefect.section ?? ''}
                                onChange={(e) => handleFieldChange('section', e.target.value)}
                              />
                            ) : (
                              <span className="text-sm">{displayDefect.section || 'Not specified'}</span>
                            )}
                          </div>
                          <div className="detail-row">
                            <strong className="block text-sm font-semibold mb-1">Subsection:</strong>
                            {isEditing ? (
                              <Input
                                type="text"
                                value={editedValues.subsection ?? displayDefect.subsection ?? ''}
                                onChange={(e) => handleFieldChange('subsection', e.target.value)}
                              />
                            ) : (
                              <span className="text-sm">{displayDefect.subsection || 'Not specified'}</span>
                            )}
                          </div>
                          <div className="detail-row">
                            <strong className="block text-sm font-semibold mb-1">Description:</strong>
                            {isEditing ? (
                              <Textarea
                                className="min-h-[80px]"
                                value={editedValues.defect_description ?? displayDefect.defect_description ?? ''}
                                onChange={(e) => handleFieldChange('defect_description', e.target.value)}
                              />
                            ) : (
                              <p className="text-sm">{displayDefect.defect_description || 'No description available'}</p>
                            )}
                          </div>
                          
                          {!inspectionDetails.hidePricing && (
                            <>
                              <div className="detail-row">
                                <strong className="block text-sm font-semibold mb-1">Materials:</strong>
                                {isEditing ? (
                                  <Input
                                    type="text"
                                    value={editedValues.materials ?? displayDefect.materials ?? ''}
                                    onChange={(e) => handleFieldChange('materials', e.target.value)}
                                  />
                                ) : (
                                  <span className="text-sm">{displayDefect.materials || 'No materials specified'}</span>
                                )}
                              </div>
                              <div className="detail-row">
                                <strong className="block text-sm font-semibold mb-1">Material Cost:</strong>
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={String(editedValues.material_total_cost ?? displayDefect.material_total_cost ?? 0)}
                                    onChange={(e) => handleFieldChange('material_total_cost', e.target.value)}
                                  />
                                ) : (
                                  <span className="text-sm">{formatCurrency(displayDefect.material_total_cost || 0)}</span>
                                )}
                              </div>
                              <div className="detail-row">
                                <strong className="block text-sm font-semibold mb-1">Labor:</strong>
                                {isEditing ? (
                                  <div className="flex items-center gap-2">
                                    <Input
                                      className="flex-1"
                                      type="text"
                                      value={editedValues.labor_type ?? displayDefect.labor_type ?? ''}
                                      onChange={(e) => handleFieldChange('labor_type', e.target.value)}
                                    />
                                    <span className="text-sm">at</span>
                                    <Input
                                      className="w-24"
                                      type="number"
                                      step="0.01"
                                      value={String(editedValues.labor_rate ?? displayDefect.labor_rate ?? 0)}
                                      onChange={(e) => handleFieldChange('labor_rate', e.target.value)}
                                    />
                                    <span className="text-sm">/hr</span>
                                  </div>
                                ) : (
                                  <span className="text-sm">{displayDefect.labor_type || 'Not specified'} at {formatCurrency(displayDefect.labor_rate || 0)}/hr</span>
                                )}
                              </div>
                              <div className="detail-row">
                                <strong className="block text-sm font-semibold mb-1">Hours:</strong>
                                {isEditing ? (
                                  <Input
                                    type="number"
                                    step="0.1"
                                    value={String(editedValues.hours_required ?? displayDefect.hours_required ?? 0)}
                                    onChange={(e) => handleFieldChange('hours_required', e.target.value)}
                                  />
                                ) : (
                                  <span className="text-sm">{displayDefect.hours_required || 0}</span>
                                )}
                              </div>
                            </>
                          )}
                          
                          <div className="detail-row">
                            <strong className="block text-sm font-semibold mb-1">Recommendation:</strong>
                            {isEditing ? (
                              <Textarea
                                className="min-h-[80px]"
                                value={editedValues.recommendation ?? displayDefect.recommendation ?? ''}
                                onChange={(e) => handleFieldChange('recommendation', e.target.value)}
                              />
                            ) : (
                              <p className="text-sm">{displayDefect.recommendation || 'No recommendation available'}</p>
                            )}
                          </div>

                          {/* Additional Location Photos Section */}
                          {isEditing && (
                            <div className="mt-6 p-4 bg-muted rounded-md border">
                              <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
                                <strong className="text-sm">
                                  📍 Additional Location Photos ({displayDefect.additional_images?.length || 0})
                                </strong>
                                <button
                                  onClick={() => setBulkAddOpen((v) => !v)}
                                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90"
                                >
                                  {bulkAddOpen ? 'Close' : 'Add Another Locations For This Defect'}
                                </button>
                              </div>

                              {bulkAddOpen && (
                                <div className="mb-4 p-3 bg-card border rounded-md">
                                  <p className="mb-2 text-sm font-semibold">Select multiple photos and set a location for each:</p>
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
                                    <div className="bulk-items-list mt-3 space-y-3">
                                      {bulkItems.map((item, i) => (
                                        <div key={i} className="bulk-item-row flex flex-wrap gap-3 items-center py-3 border-b">
                                          <img src={item.preview} alt={`bulk-${i}`} className="w-20 h-20 object-cover rounded-md shadow-sm" />
                                          <div className="flex-1 min-w-[260px]">
                                            <label className="block text-xs mb-1 font-medium">Location</label>
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
                                            <label className="inline-flex items-center gap-2 mt-2 text-xs">
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
                                            className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      ))}
                                      <div className="bulk-items-actions flex justify-center gap-2 mt-3">
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
                                              const resp = await fetch(`/api/defects/${editingId}`, {
                                                method: 'PATCH',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ inspection_id: defect.inspection_id, additional_images: updatedImages })
                                              });
                                              if (!resp.ok) throw new Error('Failed to save');
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
                                          className="px-4 py-2 bg-green-600 text-white rounded-md font-semibold disabled:opacity-50"
                                        >
                                          {bulkSaving ? 'Saving…' : 'Add All'}
                                        </button>
                                        <button onClick={() => { setBulkItems([]); setBulkAddOpen(false); }} className="px-4 py-2 bg-muted text-foreground rounded-md">Cancel</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {displayDefect.additional_images && displayDefect.additional_images.length > 0 && (
                                <div className="additional-items-list space-y-3">
                                  {displayDefect.additional_images.map((img, idx) => {
                                    console.log(`Additional image ${idx} location:`, img.location);
                                    const locationValue = img.location || "";
                                    return (
                                    <div key={`${img.url}-${idx}`} className="additional-item-row flex flex-wrap gap-3 items-center py-3 border-b">
                                      <img 
                                        src={getProxiedSrc(img.url)} 
                                        alt={`Location ${idx + 2}`}
                                        onError={handleImgError}
                                        className="w-20 h-20 object-cover rounded-md shadow-sm"
                                      />
                                      <div className="flex-1 min-w-[260px]">
                                        <label className="block text-xs mb-1 font-medium">
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
                                        className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium mr-2"
                                        title="Annotate this photo"
                                      >
                                        Annotate
                                      </button>
                                      <button
                                        onClick={() => handleRemoveLocationPhoto(idx)}
                                        className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm font-medium"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {(!displayDefect.additional_images || displayDefect.additional_images.length === 0) && (
                                <p className="text-xs text-muted-foreground italic">
                                  No additional location photos yet. Click "Add Location Photo" to add photos from different locations with the same defect.
                                </p>
                              )}
                            </div>
                          )}

                          {!inspectionDetails.hidePricing && (
                            <div className="detail-row pt-4 border-t">
                              <strong className="block text-sm font-semibold mb-1">Total Cost:</strong>
                              <span className="text-lg font-bold">
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
                              </span>
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
        {activeTab === 'details' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Grid - 1/3 width on desktop */}
            <div className="space-y-6 lg:col-span-1 order-2 lg:order-1">
              {/* Inspector Section */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold text-lg mb-4">Inspector</h3>
                {inspectionDetails.inspector ? (
                  <div className="p-4 bg-card border rounded-lg hover:shadow-sm transition-shadow">
                    <div className="flex items-start gap-3">
                      {inspectionDetails.inspector.photoUrl ? (
                        <img 
                          src={inspectionDetails.inspector.photoUrl} 
                          alt={`${inspectionDetails.inspector.firstName} ${inspectionDetails.inspector.lastName}`}
                          className="w-14 h-14 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(`${inspectionDetails.inspector.firstName} ${inspectionDetails.inspector.lastName}`) + '&background=8230c9&color=fff';
                          }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xl shadow-md">
                          {`${inspectionDetails.inspector.firstName?.charAt(0) || ''}${inspectionDetails.inspector.lastName?.charAt(0) || ''}`.toUpperCase() || 'I'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-lg mb-1.5">
                          {inspectionDetails.inspector.firstName} {inspectionDetails.inspector.lastName}
                        </p>
                        <div className="space-y-1">
                          {inspectionDetails.inspector.email && (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <i className="fas fa-envelope w-4 text-xs"></i>
                              <span className="truncate">{inspectionDetails.inspector.email}</span>
                            </p>
                          )}
                          {inspectionDetails.inspector.phone && (
                            <p className="text-sm text-muted-foreground flex items-center gap-2">
                              <i className="fas fa-phone w-4 text-xs"></i>
                              {inspectionDetails.inspector.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                      <i className="fas fa-user-tie text-2xl text-muted-foreground"></i>
                    </div>
                    <p className="text-sm text-muted-foreground">No inspector assigned</p>
                  </div>
                )}
              </div>

              {/* Combined People Section */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold text-lg mb-4">People</h3>
                
                {/* Clients */}
                {inspectionDetails.clients && inspectionDetails.clients.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-border"></div>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Clients ({inspectionDetails.clients.length})</h4>
                      <div className="h-px flex-1 bg-border"></div>
                    </div>
                    <div className="space-y-3">
                      {inspectionDetails.clients.map((client, index) => (
                        <div key={client._id || index} className="p-4 bg-card border rounded-lg hover:shadow-sm transition-shadow">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                              {client.isCompany 
                                ? client.companyName?.charAt(0)?.toUpperCase() || 'C'
                                : `${client.firstName?.charAt(0) || ''}${client.lastName?.charAt(0) || ''}`.toUpperCase() || 'C'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-base mb-1">
                                {client.isCompany ? client.companyName : `${client.firstName} ${client.lastName}`}
                              </p>
                              <div className="space-y-0.5">
                                {client.email && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <i className="fas fa-envelope w-4 text-xs"></i>
                                    <span className="truncate">{client.email}</span>
                                  </p>
                                )}
                                {client.phone && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <i className="fas fa-phone w-4 text-xs"></i>
                                    {client.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Client's Agents */}
                {inspectionDetails.agents && inspectionDetails.agents.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-border"></div>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Client's Agents ({inspectionDetails.agents.length})</h4>
                      <div className="h-px flex-1 bg-border"></div>
                    </div>
                    <div className="space-y-3">
                      {inspectionDetails.agents.map((agent, index) => (
                        <div key={agent._id || index} className="p-4 bg-card border rounded-lg hover:shadow-sm transition-shadow">
                          <div className="flex items-start gap-3">
                            {agent.photoUrl ? (
                              <img 
                                src={agent.photoUrl} 
                                alt={`${agent.firstName} ${agent.lastName}`}
                                className="w-12 h-12 rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(`${agent.firstName} ${agent.lastName}`) + '&background=8230c9&color=fff';
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                                {`${agent.firstName?.charAt(0) || ''}${agent.lastName?.charAt(0) || ''}`.toUpperCase() || 'A'}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-base mb-1">{agent.firstName} {agent.lastName}</p>
                              <div className="space-y-0.5">
                                {agent.email && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <i className="fas fa-envelope w-4 text-xs"></i>
                                    <span className="truncate">{agent.email}</span>
                                  </p>
                                )}
                                {agent.phone && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <i className="fas fa-phone w-4 text-xs"></i>
                                    {agent.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Listing Agents */}
                {inspectionDetails.listingAgent && inspectionDetails.listingAgent.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-border"></div>
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Listing Agents ({inspectionDetails.listingAgent.length})</h4>
                      <div className="h-px flex-1 bg-border"></div>
                    </div>
                    <div className="space-y-3">
                      {inspectionDetails.listingAgent.map((agent, index) => (
                        <div key={agent._id || index} className="p-4 bg-card border rounded-lg hover:shadow-sm transition-shadow">
                          <div className="flex items-start gap-3">
                            {agent.photoUrl ? (
                              <img 
                                src={agent.photoUrl} 
                                alt={`${agent.firstName} ${agent.lastName}`}
                                className="w-12 h-12 rounded-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(`${agent.firstName} ${agent.lastName}`) + '&background=8230c9&color=fff';
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                                {`${agent.firstName?.charAt(0) || ''}${agent.lastName?.charAt(0) || ''}`.toUpperCase() || 'A'}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-base mb-1">{agent.firstName} {agent.lastName}</p>
                              <div className="space-y-0.5">
                                {agent.email && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <i className="fas fa-envelope w-4 text-xs"></i>
                                    <span className="truncate">{agent.email}</span>
                                  </p>
                                )}
                                {agent.phone && (
                                  <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <i className="fas fa-phone w-4 text-xs"></i>
                                    {agent.phone}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {(!inspectionDetails.clients || inspectionDetails.clients.length === 0) && 
                 (!inspectionDetails.agents || inspectionDetails.agents.length === 0) && 
                 (!inspectionDetails.listingAgent || inspectionDetails.listingAgent.length === 0) && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                      <i className="fas fa-users text-2xl text-muted-foreground"></i>
                    </div>
                    <p className="text-sm text-muted-foreground">No clients or agents associated with this inspection</p>
                  </div>
                )}
              </div>

              {/* Agreements Section */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Agreements</h3>
                  <Dialog open={addAgreementDialogOpen} onOpenChange={setAddAgreementDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="sm"
                        disabled={loadingAgreements || deletingAgreement || loadingAvailableAgreements}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add Agreement
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Agreement</DialogTitle>
                      </DialogHeader>
                      <div className="py-4">
                        {loadingAvailableAgreements ? (
                          <div className="flex items-center justify-center py-8">
                            <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                          </div>
                        ) : (() => {
                          const filteredAgreements = availableAgreements.filter((agreement) => {
                            // Filter out already-added agreements
                            const existingAgreementIds = agreements.map((a: any) => {
                              // Handle both formatted and raw structures
                              const id = a._id || a.agreementId?._id || a.agreementId;
                              return id?.toString();
                            });
                            return !existingAgreementIds.includes(agreement.value);
                          });

                          return filteredAgreements.length === 0 ? (
                            <div className="text-center py-8">
                              <p className="text-sm text-muted-foreground">No available agreements to add</p>
                            </div>
                          ) : (
                            <div className="max-h-[60vh] overflow-y-auto space-y-2">
                              {filteredAgreements.map((agreement) => (
                                <button
                                  key={agreement.value}
                                  onClick={() => {
                                    handleAddAgreement(agreement.value);
                                    setAddAgreementDialogOpen(false);
                                  }}
                                  className="w-full text-left p-3 bg-card border rounded-lg hover:bg-muted hover:shadow-sm transition-shadow"
                                >
                                  <p className="text-sm font-medium">{agreement.label}</p>
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                {loadingAgreements ? (
                  <div className="flex items-center justify-center py-8">
                    <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                  </div>
                ) : agreements.length > 0 ? (
                  <div className="space-y-2">
                    {agreements.map((agreement, index) => {
                      // Handle both formatted (from formatInspection) and raw (from API) structures
                      const agreementId = agreement._id || agreement.agreementId?._id || agreement.agreementId;
                      const agreementIdString = agreementId?.toString() || '';
                      const agreementName = agreement.name || agreement.agreementId?.name || 'Unnamed Agreement';
                      return (
                        <div key={agreementIdString || `agreement-${index}`} className="p-3 bg-card border rounded-lg hover:shadow-sm transition-shadow flex items-center justify-between">
                          <p className="text-sm font-medium">{agreementName}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAgreementToDelete(agreementIdString)}
                            disabled={deletingAgreement}
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="Remove agreement"
                          >
                            {deletingAgreement && agreementToDelete === agreementIdString ? (
                              <i className="fas fa-spinner fa-spin text-xs"></i>
                            ) : (
                              <i className="fas fa-trash text-xs"></i>
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                      <i className="fas fa-file-contract text-2xl text-muted-foreground"></i>
                    </div>
                    <p className="text-sm text-muted-foreground">No agreements found</p>
                  </div>
                )}
              </div>

              {/* Services & Add-on Requests Section */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold text-lg mb-4">Services & Add-on Requests</h3>
                
                {/* Current Services */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-md">Current Services</h4>
                    <Button
                      size="sm"
                      onClick={() => setServiceDialogOpen(true)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Services
                    </Button>
                  </div>
                  {/* @ts-ignore */}
                  {inspectionDetails.services && inspectionDetails.services.length > 0 ? (
                    <div className="space-y-3">
                      {/* @ts-ignore */}
                      {inspectionDetails.services.map((service: any, index: number) => {
                        // Find discount code if available
                        const discountCode = inspectionDetails.discountCodeId 
                          ? discountCodes.find((code: any) => code._id === inspectionDetails.discountCodeId)
                          : null;
                        
                        const appliesToServices = discountCode?.appliesToServices || [];
                        const appliesToAddOns = discountCode?.appliesToAddOns || [];
                        
                        const serviceId = service.serviceId;
                        const serviceIdString = typeof serviceId === 'string' ? serviceId : String(serviceId);
                        
                        // Check if service matches discount
                        const serviceMatches = discountCode && appliesToServices.length > 0 && appliesToServices.some((appliedServiceId: any) => {
                          const appliedIdString = typeof appliedServiceId === 'string' 
                            ? appliedServiceId 
                            : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
                          return appliedIdString === serviceIdString;
                        });
                        
                        // Get service base cost if available
                        const serviceBaseCost = service.baseCost || 0;
                        
                        // Calculate service discount
                        let serviceDiscount = 0;
                        if (serviceMatches && serviceBaseCost > 0 && discountCode) {
                          if (discountCode.type === 'percent') {
                            serviceDiscount = serviceBaseCost * (discountCode.value / 100);
                          } else {
                            serviceDiscount = discountCode.value;
                          }
                        }
                        const serviceFinalPrice = Math.max(0, serviceBaseCost - serviceDiscount);
                        
                        // Check if this is the only service (must have at least 1 service)
                        // @ts-ignore
                        const isOnlyService = (inspectionDetails.services || []).length === 1;
                        
                        return (
                          <div key={index} className="p-3 bg-card border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-medium text-sm">{service.serviceName || 'Service'}</p>
                              <div className="flex items-center gap-2">
                                {serviceBaseCost > 0 && (
                                  <div className="text-right text-xs">
                                    <span className={serviceDiscount > 0 ? 'font-medium text-green-600' : 'text-muted-foreground'}>
                                      ${serviceFinalPrice.toFixed(2)}
                                    </span>
                                    {serviceDiscount > 0 && (
                                      <span className="ml-1 text-green-600 text-[10px]">(Discounted)</span>
                                    )}
                                  </div>
                                )}
                                {!isOnlyService && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setServiceToDelete({ serviceIndex: index, serviceName: service.serviceName || 'Service' })}
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Delete service"
                                  >
                                    <i className="fas fa-trash text-xs"></i>
                                  </Button>
                                )}
                              </div>
                            </div>
                            {service.addOns && service.addOns.length > 0 ? (
                              <div className="ml-4 space-y-1">
                                <p className="text-xs text-muted-foreground mb-1">Add-ons:</p>
                                {service.addOns.map((addon: any, addonIndex: number) => {
                                  // Check if add-on matches discount
                                  const addOnMatches = discountCode && appliesToAddOns.length > 0 && appliesToAddOns.some((appliedAddOn: any) => {
                                    const appliedServiceId = appliedAddOn.service;
                                    const appliedServiceIdString = typeof appliedServiceId === 'string'
                                      ? appliedServiceId
                                      : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
                                    const appliedAddOnName = appliedAddOn.addOnName || appliedAddOn.addonName;
                                    
                                    return appliedServiceIdString === serviceIdString &&
                                      appliedAddOnName?.toLowerCase() === addon.name.toLowerCase();
                                  });
                                  
                                  // Calculate add-on discount
                                  const addOnFee = addon.addFee || 0;
                                  let addOnDiscount = 0;
                                  if (addOnMatches && addOnFee > 0 && discountCode) {
                                    if (discountCode.type === 'percent') {
                                      addOnDiscount = addOnFee * (discountCode.value / 100);
                                    } else {
                                      addOnDiscount = discountCode.value;
                                    }
                                  }
                                  const addOnFinalPrice = Math.max(0, addOnFee - addOnDiscount);
                                  
                                  return (
                                    <div key={addonIndex} className="flex items-center justify-between text-xs bg-muted/50 p-2 rounded">
                                      <span>
                                        {addon.name}
                                        {addOnMatches && <span className="ml-2 text-green-600 text-[10px]">(Discounted)</span>}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {addOnFee > 0 ? (
                                          <span className={addOnDiscount > 0 ? 'font-medium text-green-600' : 'text-muted-foreground'}>
                                            ${addOnFinalPrice.toFixed(2)}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">—</span>
                                        )}
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setAddonToDelete({ 
                                            serviceIndex: index, 
                                            addonIndex, 
                                            addonName: addon.name,
                                            serviceName: service.serviceName || 'Service'
                                          })}
                                          className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                          title="Delete add-on"
                                        >
                                          <i className="fas fa-trash text-[10px]"></i>
                                        </Button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground ml-4">No add-ons</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">No services</p>
                    </div>
                  )}
                </div>

                {/* Pending Add-on Requests */}
                <div>
                  <h4 className="font-medium text-md mb-3">Pending Add-on Requests</h4>
                  {/* @ts-ignore */}
                  {inspectionDetails.requestedAddons && inspectionDetails.requestedAddons.filter((req: any) => req.status === 'pending').length > 0 ? (
                    <div className="space-y-3">
                      {/* @ts-ignore */}
                      {inspectionDetails.requestedAddons
                        .filter((req: any) => req.status === 'pending')
                        .map((request: any, index: number) => (
                          <div key={index} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1">
                                <p className="font-medium text-sm">{request.addonName}</p>
                                <p className="text-xs text-muted-foreground">
                                  Requested: {new Date(request.requestedAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right text-xs">
                                <p className="font-medium">${(request.addFee || 0).toFixed(2)}</p>
                                {request.addHours > 0 && (
                                  <p className="text-muted-foreground">{request.addHours}h</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 mt-3">
                              <Button
                                size="sm"
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleApproveAddon(index)}
                              >
                                <i className="fas fa-check mr-1"></i>
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="flex-1"
                                onClick={() => handleRejectAddon(index)}
                              >
                                <i className="fas fa-times mr-1"></i>
                                Reject
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground">No pending requests</p>
                    </div>
                  )}
                </div>

                {/* Processed Requests */}
                {/* @ts-ignore */}
                {inspectionDetails.requestedAddons && inspectionDetails.requestedAddons.filter((req: any) => req.status !== 'pending').length > 0 && (
                  <div className="mt-6 pt-4 border-t">
                    <h4 className="font-medium text-md mb-3">Processed Requests</h4>
                    <div className="space-y-2">
                      {/* @ts-ignore */}
                      {inspectionDetails.requestedAddons
                        .filter((req: any) => req.status !== 'pending')
                        .map((request: any, index: number) => (
                          <div key={index} className={`p-2 rounded border text-xs ${
                            request.status === 'approved' 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-red-50 border-red-200'
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{request.addonName}</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                request.status === 'approved'
                                  ? 'bg-green-200 text-green-800'
                                  : 'bg-red-200 text-red-800'
                              }`}>
                                {request.status}
                              </span>
                            </div>
                            {request.processedAt && (
                              <p className="text-muted-foreground mt-1">
                                {new Date(request.processedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Payments Section */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold text-lg mb-4">Payments</h3>
                
                {loadingPayment ? (
                  <div className="flex items-center justify-center py-8">
                    <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                  </div>
                ) : paymentInfo ? (
                  <div className="space-y-3">
                    {paymentInfo.subtotal > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Subtotal:</span>
                        <span className="text-sm font-medium">{formatCurrency(paymentInfo.subtotal)}</span>
                      </div>
                    )}
                    
                    {paymentInfo.discountAmount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Discount
                          {inspectionDetails.discountCodeId && (() => {
                            const discountCode = discountCodes.find((code: any) => code._id === inspectionDetails.discountCodeId);
                            return discountCode ? ` (${discountCode.code})` : '';
                          })()}:
                        </span>
                        <span className="text-sm font-medium text-green-600">-{formatCurrency(paymentInfo.discountAmount)}</span>
                      </div>
                    )}
                    
                    <div className="pt-3 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold">Total Amount:</span>
                        <span className="text-xl font-bold text-primary">{formatCurrency(paymentInfo.total)}</span>
                      </div>
                    </div>

                    {paymentInfo.amountPaid > 0 && (
                      <div className="pt-2 border-t">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Amount Paid:</span>
                          <span className="text-sm font-medium text-green-600">{formatCurrency(paymentInfo.amountPaid)}</span>
                        </div>
                      </div>
                    )}

                    {paymentInfo.remainingBalance > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Remaining Balance:</span>
                        <span className="text-sm font-medium text-orange-600">{formatCurrency(paymentInfo.remainingBalance)}</span>
                      </div>
                    )}
                    
                    <div className="pt-3 border-t">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            Paid {formatCurrency(paymentInfo.amountPaid)} of {formatCurrency(paymentInfo.total)} amount
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium border">
                          {paymentInfo.isPaid ? (
                            <>
                              <i className="fas fa-check-circle text-green-600"></i>
                              <span className="text-green-700">Paid</span>
                            </>
                          ) : paymentInfo.amountPaid > 0 ? (
                            <>
                              <i className="fas fa-clock text-yellow-600"></i>
                              <span className="text-yellow-700">Partially Paid</span>
                            </>
                          ) : (
                            <>
                              <i className="fas fa-clock text-orange-600"></i>
                              <span className="text-orange-700">Unpaid</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Payment History */}
                    {paymentInfo.paymentHistory && paymentInfo.paymentHistory.length > 0 && (
                      <div className="pt-4 border-t mt-4">
                        <h4 className="text-sm font-semibold mb-3">Payment History</h4>
                        <div className="space-y-2">
                          {paymentInfo.paymentHistory.map((payment, index) => (
                            <div key={index} className="p-3 bg-card border rounded-lg text-sm">
                              <div className="flex justify-between items-start mb-1">
                                <span className="font-medium">{formatCurrency(payment.amount)}</span>
                                <span className="text-muted-foreground text-xs">
                                  {new Date(payment.paidAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                              {payment.paymentMethod && (
                                <div className="text-xs text-muted-foreground">
                                  Method: {payment.paymentMethod}
                                </div>
                              )}
                              {payment.stripePaymentIntentId && (
                                <div className="text-xs text-muted-foreground font-mono">
                                  ID: {payment.stripePaymentIntentId.slice(-12)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">Unable to load payment information</p>
                  </div>
                )}
              </div>

            </div>
            
            {/* Right Grid - Combined Card - 2/3 width on desktop */}
            <div className="space-y-6 lg:col-span-2 order-1 lg:order-2">
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-lg">Inspection Information</h3>
                  <div className="text-xs flex items-center gap-2">
                    {detailsAutoSaving ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>Saving...</span>
                      </>
                    ) : detailsLastSaved ? (
                      <>
                        <i className="fas fa-check-circle text-green-600"></i>
                        <span>Saved at {detailsLastSaved}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Order ID and Referral Source - Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Order ID */}
                  <div>
                    <Label htmlFor="orderId" className="text-sm font-semibold mb-2 block">Order ID</Label>
                    <Input
                      id="orderId"
                      value={inspectionDetails.orderId || 'N/A'}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Auto-generated
                    </p>
                  </div>

                  {/* Referral Source */}
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">Referral Source</Label>
                    <ReactSelect
                      value={inspectionDetails.referralSource ? { value: inspectionDetails.referralSource, label: inspectionDetails.referralSource } : null}
                      onChange={(option) => updateReferralSource(option?.value)}
                      options={referralSourceOptions}
                      isClearable
                      placeholder="Select referral source..."
                      className="react-select-container"
                      classNamePrefix="react-select"
                    />
                  </div>
                </div>

                {/* Custom Fields */}
                {customFieldsDefinitions.length > 0 && (
                  <>
                    <div className="border-t my-4"></div>
                    <div className="mb-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customFieldsDefinitions.map((field) => {
                          const value = inspectionDetails.customData?.[field.fieldKey];

                          return (
                            <div key={field.fieldKey} className="space-y-2">
                              {field.fieldType !== 'Checkbox' && (
                                <Label htmlFor={`custom-${field.fieldKey}`} className="text-sm block truncate" title={field.name}>
                                  {field.name}
                                  {field.requiredForOnlineScheduler && <span className="text-destructive ml-1">*</span>}
                                </Label>
                              )}
                              
                              {field.fieldType === 'Text' && (
                                <Input
                                  id={`custom-${field.fieldKey}`}
                                  value={value || ''}
                                  onChange={(e) => updateCustomField(field.fieldKey, e.target.value)}
                                  placeholder={`Enter ${field.name.toLowerCase()}...`}
                                />
                              )}

                              {field.fieldType === 'Number' && (
                                <Input
                                  id={`custom-${field.fieldKey}`}
                                  type="number"
                                  value={value || ''}
                                  onChange={(e) => updateCustomField(field.fieldKey, e.target.value)}
                                  placeholder={`Enter ${field.name.toLowerCase()}...`}
                                />
                              )}

                              {field.fieldType === 'Paragraph' && (
                                <Textarea
                                  id={`custom-${field.fieldKey}`}
                                  value={value || ''}
                                  onChange={(e) => updateCustomField(field.fieldKey, e.target.value)}
                                  placeholder={`Enter ${field.name.toLowerCase()}...`}
                                  rows={3}
                                />
                              )}

                              {field.fieldType === 'Checkbox' && (
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`custom-${field.fieldKey}`}
                                    checked={value || false}
                                    onCheckedChange={(checked) => updateCustomField(field.fieldKey, checked === true)}
                                  />
                                  <Label htmlFor={`custom-${field.fieldKey}`} className="text-sm font-normal cursor-pointer truncate flex-1 min-w-0" title={field.name}>
                                    {field.name}
                                    {field.requiredForOnlineScheduler && <span className="text-destructive ml-1">*</span>}
                                  </Label>
                                </div>
                              )}

                              {field.fieldType === 'Dropdown' && (
                                <Select
                                  value={value || ''}
                                  onValueChange={(val) => updateCustomField(field.fieldKey, val)}
                                >
                                  <SelectTrigger id={`custom-${field.fieldKey}`}>
                                    <SelectValue placeholder={`Select ${field.name.toLowerCase()}...`} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(field.dropdownOptions || []).map((option: string, idx: number) => (
                                      <SelectItem key={idx} value={option}>
                                        {option}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}

                              {(field.fieldType === 'Date' || field.fieldType === 'Date & Time') && (
                                <Input
                                  id={`custom-${field.fieldKey}`}
                                  type={field.fieldType === 'Date & Time' ? 'datetime-local' : 'date'}
                                  value={value || ''}
                                  onChange={(e) => updateCustomField(field.fieldKey, e.target.value)}
                                />
                              )}

                              {field.fieldType === 'Calendar' && (
                                <Input
                                  id={`custom-${field.fieldKey}`}
                                  value={value || ''}
                                  onChange={(e) => updateCustomField(field.fieldKey, e.target.value)}
                                  placeholder={`Enter ${field.name.toLowerCase()}...`}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* Discount Code - Below Custom Fields */}
                <div className="border-t my-4"></div>
                <div className="mb-6">
                  <Label className="text-sm font-semibold mb-2 block">Discount Code</Label>
                  <ReactSelect
                    value={inspectionDetails.discountCodeId ? discountCodes.map(code => ({
                      value: code._id,
                      label: `${code.code} (${code.type === 'percent' ? `${code.value}%` : `$${code.value}`})`,
                      discountCode: code,
                    })).find(opt => opt.value === inspectionDetails.discountCodeId) || null : null}
                    onChange={(option: any) => updateDiscountCode(option?.value)}
                    options={discountCodes.map(code => ({
                      value: code._id,
                      label: `${code.code} (${code.type === 'percent' ? `${code.value}%` : `$${code.value}`})`,
                      discountCode: code,
                    }))}
                    isClearable
                    placeholder="Select a discount code..."
                    className="react-select-container"
                    classNamePrefix="react-select"
                  />
                </div>
              </div>

              {/* Notes Section - Combined Card */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold text-lg mb-4">Notes</h3>
                
                {/* Internal Notes */}
                <div className="space-y-2 mb-6">
                  <Label htmlFor="internalNotes" className="text-sm font-semibold">Internal Notes</Label>
                  <Textarea
                    id="internalNotes"
                    value={inspectionDetails.internalNotes || ''}
                    onChange={(e) => updateInternalNotes(e.target.value)}
                    placeholder="Enter internal notes..."
                    rows={6}
                    className="resize-none"
                  />
                </div>

                <div className="border-t my-6"></div>

                {/* Office Notes */}
                <div>
                  <h4 className="text-sm font-semibold mb-4">Office Notes</h4>
                  
                  {/* Add New Note */}
                  <div className="mb-6 space-y-2">
                    <Textarea
                      id="newOfficeNote"
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="Enter a new office note..."
                      rows={4}
                      className="resize-none"
                    />
                    <Button
                      onClick={handleAddOfficeNote}
                      disabled={savingNote || !newNoteContent.trim()}
                      className="w-full sm:w-auto"
                    >
                      {savingNote ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Adding Note...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-plus mr-2"></i>
                          Add Note
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Display Existing Notes */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-px flex-1 bg-border"></div>
                      <h5 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Previous Notes ({inspectionDetails.officeNotes?.length || 0})
                      </h5>
                      <div className="h-px flex-1 bg-border"></div>
                    </div>

                    {inspectionDetails.officeNotes && inspectionDetails.officeNotes.length > 0 ? (
                      <div className="space-y-3">
                        {inspectionDetails.officeNotes.map((note) => (
                          <div key={note._id} className="p-4 bg-card border rounded-lg hover:shadow-sm transition-shadow">
                            <div className="flex items-start gap-3 mb-3">
                              {note.createdBy?.profileImageUrl ? (
                                <img 
                                  src={note.createdBy.profileImageUrl} 
                                  alt={`${note.createdBy.firstName} ${note.createdBy.lastName}`}
                                  className="w-10 h-10 rounded-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(`${note.createdBy.firstName} ${note.createdBy.lastName}`) + '&background=8230c9&color=fff';
                                  }}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-sm">
                                  {`${note.createdBy?.firstName?.charAt(0) || ''}${note.createdBy?.lastName?.charAt(0) || ''}`.toUpperCase() || 'U'}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="font-semibold text-sm">
                                    {note.createdBy?.firstName} {note.createdBy?.lastName}
                                  </p>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setOfficeNoteToDelete(note._id)}
                                    disabled={deletingNoteId === note._id}
                                    className="h-7 px-2 text-xs"
                                  >
                                    {deletingNoteId === note._id ? (
                                      <i className="fas fa-spinner fa-spin"></i>
                                    ) : (
                                      <>
                                        <i className="fas fa-trash mr-1"></i>
                                        Delete
                                      </>
                                    )}
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">
                                  {new Date(note.createdAt).toLocaleString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {note.content}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {/* Customer Note from Online Scheduling */}
                        {inspectionDetails.clientNote && (
                          <div className="p-4 bg-card border rounded-lg hover:shadow-sm transition-shadow border-blue-200 bg-blue-50/30">
                            <div className="flex items-start gap-3 mb-3">
                              {inspectionDetails.clients && inspectionDetails.clients.length > 0 && inspectionDetails.clients[0].photoUrl ? (
                                <img 
                                  src={inspectionDetails.clients[0].photoUrl} 
                                  alt={inspectionDetails.clients[0].isCompany ? inspectionDetails.clients[0].companyName : `${inspectionDetails.clients[0].firstName} ${inspectionDetails.clients[0].lastName}`}
                                  className="w-10 h-10 rounded-full object-cover"
                                  onError={(e) => {
                                    const client = inspectionDetails.clients![0];
                                    const name = client.isCompany ? client.companyName : `${client.firstName} ${client.lastName}`;
                                    e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=3b82f6&color=fff';
                                  }}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                                  {inspectionDetails.clients && inspectionDetails.clients.length > 0
                                    ? inspectionDetails.clients[0].isCompany
                                      ? inspectionDetails.clients[0].companyName?.charAt(0)?.toUpperCase() || 'C'
                                      : `${inspectionDetails.clients[0].firstName?.charAt(0) || ''}${inspectionDetails.clients[0].lastName?.charAt(0) || ''}`.toUpperCase() || 'C'
                                    : 'C'}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div>
                                    <p className="font-semibold text-sm">
                                      {inspectionDetails.clients && inspectionDetails.clients.length > 0
                                        ? inspectionDetails.clients[0].isCompany
                                          ? inspectionDetails.clients[0].companyName
                                          : `${inspectionDetails.clients[0].firstName} ${inspectionDetails.clients[0].lastName}`
                                        : 'Client'}
                                    </p>
                                    <p className="text-xs text-blue-600 font-medium">Customer Note (from online scheduling)</p>
                                  </div>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setClientNoteToDelete(true)}
                                    disabled={deletingClientNote}
                                    className="h-7 px-2 text-xs"
                                  >
                                    {deletingClientNote ? (
                                      <i className="fas fa-spinner fa-spin"></i>
                                    ) : (
                                      <>
                                        <i className="fas fa-trash mr-1"></i>
                                        Delete
                                      </>
                                    )}
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">
                                  {inspectionDetails.date ? new Date(inspectionDetails.date).toLocaleString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  }) : 'Date not available'}
                                </p>
                                <p className="text-sm whitespace-pre-wrap break-words">
                                  {inspectionDetails.clientNote}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : inspectionDetails.clientNote ? (
                      <div className="space-y-3">
                        {/* Customer Note from Online Scheduling (when no office notes exist) */}
                        <div className="p-4 bg-card border rounded-lg hover:shadow-sm transition-shadow border-blue-200 bg-blue-50/30">
                          <div className="flex items-start gap-3 mb-3">
                            {inspectionDetails.clients && inspectionDetails.clients.length > 0 && inspectionDetails.clients[0].photoUrl ? (
                              <img 
                                src={inspectionDetails.clients[0].photoUrl} 
                                alt={inspectionDetails.clients[0].isCompany ? inspectionDetails.clients[0].companyName : `${inspectionDetails.clients[0].firstName} ${inspectionDetails.clients[0].lastName}`}
                                className="w-10 h-10 rounded-full object-cover"
                                onError={(e) => {
                                  const client = inspectionDetails.clients![0];
                                  const name = client.isCompany ? client.companyName : `${client.firstName} ${client.lastName}`;
                                  e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=3b82f6&color=fff';
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                                {inspectionDetails.clients && inspectionDetails.clients.length > 0
                                  ? inspectionDetails.clients[0].isCompany
                                    ? inspectionDetails.clients[0].companyName?.charAt(0)?.toUpperCase() || 'C'
                                    : `${inspectionDetails.clients[0].firstName?.charAt(0) || ''}${inspectionDetails.clients[0].lastName?.charAt(0) || ''}`.toUpperCase() || 'C'
                                  : 'C'}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div>
                                  <p className="font-semibold text-sm">
                                    {inspectionDetails.clients && inspectionDetails.clients.length > 0
                                      ? inspectionDetails.clients[0].isCompany
                                        ? inspectionDetails.clients[0].companyName
                                        : `${inspectionDetails.clients[0].firstName} ${inspectionDetails.clients[0].lastName}`
                                      : 'Client'}
                                  </p>
                                  <p className="text-xs text-blue-600 font-medium">Customer Note (from online scheduling)</p>
                                </div>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setClientNoteToDelete(true)}
                                  disabled={deletingClientNote}
                                  className="h-7 px-2 text-xs"
                                >
                                  {deletingClientNote ? (
                                    <i className="fas fa-spinner fa-spin"></i>
                                  ) : (
                                    <>
                                      <i className="fas fa-trash mr-1"></i>
                                      Delete
                                    </>
                                  )}
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">
                                {inspectionDetails.date ? new Date(inspectionDetails.date).toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }) : 'Date not available'}
                              </p>
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {inspectionDetails.clientNote}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                          <i className="fas fa-sticky-note text-2xl text-muted-foreground"></i>
                        </div>
                        <p className="text-sm text-muted-foreground">No office notes yet</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Associated Tasks Section */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Associated Tasks</h3>
                  <Button onClick={handleCreateTask} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </div>

                {loadingTasks ? (
                  <div className="flex items-center justify-center py-12">
                    <i className="fas fa-spinner fa-spin text-2xl text-muted-foreground"></i>
                  </div>
                ) : tasks.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Created</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Assigned To</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Comments</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((task) => (
                          <TableRow key={task._id}>
                            <TableCell className="text-sm">
                              {new Date(task.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getTaskTypeBadgeColor(task.taskType)}`}>
                                {task.taskType}
                              </span>
                            </TableCell>
                            <TableCell className="max-w-xs truncate" title={task.title}>
                              {task.title}
                            </TableCell>
                            <TableCell>
                              <span className={isOverdue(task.dueDate) && task.status !== 'Complete' ? 'text-red-600 font-semibold' : ''}>
                                {new Date(task.dueDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {task.assignedTo?.profileImageUrl ? (
                                  <img 
                                    src={task.assignedTo.profileImageUrl} 
                                    alt={`${task.assignedTo.firstName} ${task.assignedTo.lastName}`}
                                    className="w-6 h-6 rounded-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(`${task.assignedTo.firstName} ${task.assignedTo.lastName}`) + '&background=8230c9&color=fff';
                                    }}
                                  />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white font-semibold text-xs">
                                    {`${task.assignedTo?.firstName?.charAt(0) || ''}${task.assignedTo?.lastName?.charAt(0) || ''}`.toUpperCase() || 'U'}
                                  </div>
                                )}
                                <span className="text-sm">
                                  {task.assignedTo?.firstName} {task.assignedTo?.lastName}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={task.status}
                                onValueChange={(value) => handleStatusChange(task._id, value)}
                              >
                                <SelectTrigger className={`w-32 ${getStatusColor(task.status)}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="On Hold">On Hold</SelectItem>
                                  <SelectItem value="In Progress">In Progress</SelectItem>
                                  <SelectItem value="Complete">Complete</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {task.commentCount > 0 ? (
                                <button
                                  onClick={() => handleViewComments(task)}
                                  className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 hover:bg-blue-200 transition-colors"
                                >
                                  <i className="fas fa-comment mr-1"></i>
                                  {task.commentCount}
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">No comments</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditTask(task)}
                                  className="h-8 px-2"
                                >
                                  <i className="fas fa-edit"></i>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setTaskToDelete(task._id)}
                                  className="h-8 px-2 text-destructive hover:text-destructive"
                                >
                                  <i className="fas fa-trash"></i>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-muted flex items-center justify-center">
                      <i className="fas fa-tasks text-2xl text-muted-foreground"></i>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">No tasks yet</p>
                    <Button onClick={handleCreateTask} variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Create your first task
                    </Button>
                  </div>
                )}
              </div>

              {/* Events Section */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <EventsManager
                  mode="edit"
                  inspectionId={inspectionId}
                  inspectors={companyUsers}
                  defaultDate={inspectionDetails.date ? new Date(inspectionDetails.date) : undefined}
                  defaultInspector={
                    inspectionDetails.inspector
                      ? {
                          value: inspectionDetails.inspector._id,
                          label: `${inspectionDetails.inspector.firstName} ${inspectionDetails.inspector.lastName}`,
                        }
                      : null
                  }
                  events={events}
                  onEventsChange={setEvents}
                />
              </div>

              {/* Important Dates Section */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold text-lg mb-4">Important Dates</h3>
                
                {/* Closing Date */}
                <div className="space-y-2 mb-6">
                  <Label htmlFor="closingDate" className="text-sm font-semibold">Closing Date</Label>
                  <div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full max-w-xs justify-start text-left font-normal ${!inspectionDetails.closingDate?.date && 'text-muted-foreground'}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {inspectionDetails.closingDate?.date ? format(new Date(inspectionDetails.closingDate.date), 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={inspectionDetails.closingDate?.date ? new Date(inspectionDetails.closingDate.date) : undefined}
                            onSelect={(date) => updateClosingDate(date ? format(date, 'yyyy-MM-dd') : '')}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                  </div>
                  {inspectionDetails.closingDate?.date && inspectionDetails.closingDate.lastModifiedBy && inspectionDetails.closingDate.lastModifiedAt ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selected: {new Date(inspectionDetails.closingDate.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}, set by {inspectionDetails.closingDate.lastModifiedBy.firstName} {inspectionDetails.closingDate.lastModifiedBy.lastName} on {new Date(inspectionDetails.closingDate.lastModifiedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })} at {new Date(inspectionDetails.closingDate.lastModifiedAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  ) : inspectionDetails.closingDate?.date ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selected: {new Date(inspectionDetails.closingDate.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1 italic">Not set</p>
                  )}
                </div>

                {/* End of Inspection Period */}
                <div className="space-y-2">
                  <Label htmlFor="endOfInspectionPeriod" className="text-sm font-semibold">End of Inspection Period</Label>
                  <div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={`w-full max-w-xs justify-start text-left font-normal ${!inspectionDetails.endOfInspectionPeriod?.date && 'text-muted-foreground'}`}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {inspectionDetails.endOfInspectionPeriod?.date ? format(new Date(inspectionDetails.endOfInspectionPeriod.date), 'PPP') : 'Pick a date'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={inspectionDetails.endOfInspectionPeriod?.date ? new Date(inspectionDetails.endOfInspectionPeriod.date) : undefined}
                            onSelect={(date) => updateEndOfInspectionPeriod(date ? format(date, 'yyyy-MM-dd') : '')}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                  </div>
                  {inspectionDetails.endOfInspectionPeriod?.date && inspectionDetails.endOfInspectionPeriod.lastModifiedBy && inspectionDetails.endOfInspectionPeriod.lastModifiedAt ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selected: {new Date(inspectionDetails.endOfInspectionPeriod.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}, set by {inspectionDetails.endOfInspectionPeriod.lastModifiedBy.firstName} {inspectionDetails.endOfInspectionPeriod.lastModifiedBy.lastName} on {new Date(inspectionDetails.endOfInspectionPeriod.lastModifiedAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })} at {new Date(inspectionDetails.endOfInspectionPeriod.lastModifiedAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  ) : inspectionDetails.endOfInspectionPeriod?.date ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Selected: {new Date(inspectionDetails.endOfInspectionPeriod.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1 italic">Not set</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          </>
        )}
      </div>

      {/* Task Dialog */}
      <TaskDialog
        open={taskDialogOpen}
        onClose={() => {
          setTaskDialogOpen(false);
          setEditingTask(null);
        }}
        onSave={handleTaskSaved}
        inspectionId={inspectionId}
        task={editingTask}
        companyUsers={companyUsers}
        currentUserId={currentUserId}
      />

      {/* Comments Dialog */}
      <TaskCommentsDialog
        open={commentsDialogOpen}
        onClose={() => {
          setCommentsDialogOpen(false);
          setSelectedTaskForComments(null);
        }}
        task={selectedTaskForComments}
        inspectionId={inspectionId}
        onCommentDeleted={fetchTasks}
      />

      {/* Service Selection Dialog */}
      <ServiceSelectionDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        onSave={handleSaveServices}
        existingServices={inspectionDetails.services || []}
      />

      {/* Delete Task Confirmation Dialog */}
      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task and all its comments? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Office Note Confirmation Dialog */}
      <AlertDialog open={!!officeNoteToDelete} onOpenChange={(open) => !open && setOfficeNoteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteOfficeNote} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Client Note Confirmation Dialog */}
      <AlertDialog open={clientNoteToDelete} onOpenChange={(open) => !open && setClientNoteToDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this customer note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClientNote} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Service Confirmation Dialog */}
      <AlertDialog open={!!serviceToDelete} onOpenChange={(open) => !open && setServiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the service "{serviceToDelete?.serviceName}"? This will also delete all add-ons associated with this service. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingService}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteService} 
              disabled={deletingService}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingService ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Add-on Confirmation Dialog */}
      <AlertDialog open={!!addonToDelete} onOpenChange={(open) => !open && setAddonToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Add-on</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the add-on "{addonToDelete?.addonName}" from the service "{addonToDelete?.serviceName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAddon}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAddon} 
              disabled={deletingAddon}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingAddon ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Agreement Confirmation Dialog */}
      <AlertDialog open={!!agreementToDelete} onOpenChange={(open) => !open && setAgreementToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Agreement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this agreement from the inspection? This will not delete the agreement itself, only remove it from this inspection. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAgreement}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAgreement} 
              disabled={deletingAgreement}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deletingAgreement ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-10 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-50"
          title="Back to Top"
        >
          <i className="fas fa-arrow-up text-xl"></i>
        </button>
      )}
    </div>
  );
}

