"use client";

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactSelect, { components } from 'react-select';
import AsyncSelect from 'react-select/async';
import { X, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { LocationFields } from '@/components/location/LocationFields';
import CustomFields from '@/components/custom-fields/CustomFields';
import { extractCompanyIdFromSlug } from '@/src/lib/scheduler-utils';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { format } from 'date-fns';
import { getAvailableTimesForDate, type InspectorAvailability } from '@/src/lib/inspection-availability';
import { formatTimeLabel } from '@/src/lib/availability-utils';

// Schema for scheduler form (simplified version)
const schedulerFormSchema = z.object({
  location: z.object({
    address: z.string().min(1, 'Address is required'),
    unit: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    county: z.string().optional(),
    squareFeet: z.string().optional(),
    yearBuild: z.string().optional(),
    foundation: z.string().optional(),
  }),
  customData: z.record(z.string(), z.any()).optional(),
  date: z.date().optional(),
  time: z.string().optional(),
  inspectorId: z.string().optional(),
  client: z.object({
    isCompany: z.boolean(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    companyName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
  }),
  agents: z.array(z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    agency: z.string().optional(),
  })),
  listingAgents: z.array(z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    agency: z.string().optional(),
  })),
  discountCode: z.string().optional(),
  referralSource: z.string().optional(),
  notes: z.string().optional(),
  agreeToTerms: z.boolean(),
});

type SchedulerFormData = z.infer<typeof schedulerFormSchema>;

type Service = {
  _id: string;
  name: string;
  baseCost?: number;
  baseDurationHours?: number;
  addOns: Array<{
    name: string;
    serviceCategory: string;
    description?: string;
    baseCost?: number;
    baseDurationHours: number;
    defaultInspectionEvents: string[];
    orderIndex: number;
  }>;
};

type SelectedService = {
  serviceId: string;
  service: Service;
  addOns: Array<{ name: string; addFee?: number }>;
};

type Inspector = {
  inspectorId: string;
  inspectorName: string;
  inspectorFirstName: string;
  email?: string;
  profileImageUrl?: string;
  availability: InspectorAvailability;
};

export default function SchedulePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [foundationOptions, setFoundationOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('what-where');
  const [validatedTabs, setValidatedTabs] = useState<Set<string>>(new Set(['what-where']));
  const [schedulerEnabled, setSchedulerEnabled] = useState<boolean | null>(null);
  const [addonMenuOpen, setAddonMenuOpen] = useState<Record<number, boolean>>({});
  const [schedulingMinimumHours, setSchedulingMinimumHours] = useState<number>(0);
  const [allowChoiceOfInspectors, setAllowChoiceOfInspectors] = useState<boolean>(true);
  const [hidePricing, setHidePricing] = useState<boolean>(false);
  const [allowRequestNotes, setAllowRequestNotes] = useState<boolean>(false);
  
  // Calendar state
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [selectedInspectorId, setSelectedInspectorId] = useState<string | null>(null);
  const [companyOwnerId, setCompanyOwnerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'openSchedule' | 'timeSlots'>('openSchedule');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    // Get current Sunday
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    const sunday = new Date(today);
    sunday.setDate(diff);
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  });
  const [loadingInspectors, setLoadingInspectors] = useState(false);
  const [discountCodeValid, setDiscountCodeValid] = useState<boolean | null>(null);
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [discountDetails, setDiscountDetails] = useState<any>(null);
  const [referralSourceOptions, setReferralSourceOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);

  const form = useForm<SchedulerFormData>({
    resolver: zodResolver(schedulerFormSchema),
    mode: 'onChange',
    defaultValues: {
      location: {
        address: '',
        unit: '',
        city: '',
        state: '',
        zip: '',
        county: '',
        squareFeet: '',
        yearBuild: '',
        foundation: undefined,
      },
      customData: {},
      date: undefined,
      time: undefined,
      inspectorId: undefined,
      client: {
        isCompany: false,
        firstName: '',
        lastName: '',
        companyName: '',
        email: '',
        phone: '',
      },
      agents: [],
      listingAgents: [],
      discountCode: '',
      referralSource: '',
      notes: '',
      agreeToTerms: false,
    },
  });

  // Extract company ID from slug
  useEffect(() => {
    if (slug) {
      const extractedId = extractCompanyIdFromSlug(slug);
      if (extractedId) {
        setCompanyId(extractedId);
      } else {
        setError('Invalid company URL');
        setLoading(false);
      }
    }
  }, [slug]);

  // Fetch company data and scheduler status
  useEffect(() => {
    if (!companyId) return;

    const fetchCompanyData = async () => {
      try {
        setLoading(true);
        const [companyResponse, schedulerResponse] = await Promise.all([
          fetch(`/api/public/company/${companyId}`),
          fetch(`/api/public/company/${companyId}/scheduler-status`),
        ]);

        if (!companyResponse.ok) {
          if (companyResponse.status === 404) {
            setError('Company not found');
          } else {
            setError('Failed to load company data');
          }
          setLoading(false);
          return;
        }

        const companyData = await companyResponse.json();
        setCompany(companyData.company);

        // Check scheduler status
        if (schedulerResponse.ok) {
          const schedulerData = await schedulerResponse.json();
          setSchedulerEnabled(schedulerData.onlineSchedulerEnabled ?? false);
          setSchedulingMinimumHours(schedulerData.schedulingMinimumHours ?? 0);
          setAllowChoiceOfInspectors(schedulerData.allowChoiceOfInspectors ?? true);
          setHidePricing(schedulerData.hidePricing ?? false);
          setAllowRequestNotes(schedulerData.allowRequestNotes ?? false);
        } else {
          setSchedulerEnabled(false);
          setSchedulingMinimumHours(0);
          setAllowChoiceOfInspectors(true);
          setHidePricing(false);
          setAllowRequestNotes(false);
        }
        
        // Set loading to false after both requests complete
        setLoading(false);
      } catch (err) {
        console.error('Error fetching company:', err);
        setError('Failed to load company data');
        setSchedulerEnabled(false);
        setSchedulingMinimumHours(0);
        setAllowChoiceOfInspectors(true);
        setHidePricing(false);
        setAllowRequestNotes(false);
        setLoading(false);
      }
    };

    fetchCompanyData();
  }, [companyId]);

  // Fetch services
  useEffect(() => {
    if (!companyId) return;

    const fetchServices = async () => {
      try {
        const response = await fetch(`/api/public/company/${companyId}/services`);

        if (response.ok) {
          const data = await response.json();
          setServices(data.services || []);
        }
      } catch (err) {
        console.error('Error fetching services:', err);
      }
    };

    fetchServices();
  }, [companyId]);

  // Fetch foundation and referral source options
  useEffect(() => {
    if (!companyId || !company) return;

    const fetchOptions = async () => {
      try {
        const [foundationRes, referralSourceRes] = await Promise.all([
          fetch(`/api/public/company/${companyId}/foundation-options`),
          fetch(`/api/public/company/${companyId}/referral-sources`),
        ]);

        if (foundationRes.ok) {
          const data = await foundationRes.json();
          setFoundationOptions(data.foundationOptions || []);
        }

        if (referralSourceRes.ok) {
          const data = await referralSourceRes.json();
          setReferralSourceOptions(data.referralSources || []);
        }
      } catch (err) {
        console.error('Error fetching options:', err);
      }
    };

    fetchOptions();
  }, [companyId, company]);

  // Fetch inspectors and availability
  useEffect(() => {
    if (!companyId) return;

    const fetchInspectors = async () => {
      try {
        setLoadingInspectors(true);
        const response = await fetch(`/api/public/company/${companyId}/inspectors`);

        if (response.ok) {
          const data = await response.json();
          setInspectors(data.inspectors || []);
          setCompanyOwnerId(data.companyOwnerId);
          setViewMode(data.viewMode || 'openSchedule');
          
          // Set default inspector to company owner or first inspector
          if (data.companyOwnerId && data.inspectors?.length > 0) {
            const ownerInspector = data.inspectors.find((i: Inspector) => i.inspectorId === data.companyOwnerId);
            if (ownerInspector) {
              setSelectedInspectorId(data.companyOwnerId);
              form.setValue('inspectorId', data.companyOwnerId);
            } else if (data.inspectors.length > 0) {
              setSelectedInspectorId(data.inspectors[0].inspectorId);
              form.setValue('inspectorId', data.inspectors[0].inspectorId);
            }
          } else if (data.inspectors?.length > 0) {
            setSelectedInspectorId(data.inspectors[0].inspectorId);
            form.setValue('inspectorId', data.inspectors[0].inspectorId);
          }
        }
      } catch (err) {
        console.error('Error fetching inspectors:', err);
      } finally {
        setLoadingInspectors(false);
      }
    };

    fetchInspectors();
  }, [companyId, form]);

  // Validate Tab 1 before allowing navigation
  const validateTab1 = async (): Promise<boolean> => {
    const missingFields: string[] = [];

    // Check if at least one service is selected
    if (selectedServices.length === 0) {
      missingFields.push('Service');
    }

    // Trigger form validation only for location and customData fields (not client fields)
    await form.trigger('location');
    await form.trigger('customData');
    const formErrors = form.formState.errors;
    
    // Validate address
    const address = form.getValues('location.address');
    if ((!address || address.trim() === '') || formErrors.location?.address) {
      if (!missingFields.includes('Address')) {
        missingFields.push('Address');
      }
    }

    // Validate required custom fields
    const customData = form.getValues('customData') || {};
    
    // Fetch custom fields to check required ones
    if (companyId) {
      try {
        const response = await fetch(`/api/public/company/${companyId}/custom-fields`);
        if (response.ok) {
          const data = await response.json();
          const requiredFields = (data.customFields || []).filter(
            (field: any) => field.requiredForOnlineScheduler && field.fieldKey
          );

          if (requiredFields.length > 0) {
            // Trigger validation for all required custom fields
            const validationPromises = requiredFields.map((field: any) => 
              form.trigger(`customData.${field.fieldKey}`)
            );
            const validationResults = await Promise.all(validationPromises);

            // Check if any validation failed and collect missing field names
            requiredFields.forEach((field: any, index: number) => {
              const fieldValue = customData[field.fieldKey];
              let isValid = false;

              if (field.fieldType === 'Text' || field.fieldType === 'Paragraph') {
                isValid = fieldValue && typeof fieldValue === 'string' && fieldValue.trim() !== '';
              } else if (field.fieldType === 'Number') {
                isValid = fieldValue !== undefined && fieldValue !== null && fieldValue !== '' && !isNaN(Number(fieldValue));
              } else if (field.fieldType === 'Checkbox') {
                isValid = fieldValue === true;
              } else if (field.fieldType === 'Calendar') {
                isValid = fieldValue && fieldValue !== 'N/A';
              } else if (field.fieldType === 'Dropdown') {
                isValid = fieldValue && fieldValue !== '';
              } else if (field.fieldType === 'Date' || field.fieldType === 'Date & Time') {
                isValid = fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
              }

              if (!isValid || validationResults[index] === false) {
                missingFields.push(field.name);
              }
            });
          }
        }
      } catch (err) {
        console.error('Error validating custom fields:', err);
      }
    }

    // If there are missing fields, show toast with all missing fields
    if (missingFields.length > 0) {
      const fieldsList = missingFields.length === 1 
        ? missingFields[0]
        : missingFields.length === 2
        ? `${missingFields[0]} and ${missingFields[1]}`
        : `${missingFields.slice(0, -1).join(', ')}, and ${missingFields[missingFields.length - 1]}`;
      
      toast.error(`Please fill in the following required fields: ${fieldsList}`, {
        duration: 5000,
      });
      return false;
    }

    // If no missing fields, check if form validation passed
    const formIsValid = Object.keys(formErrors).length === 0;
    return formIsValid;
  };

  const validateTab2 = (): boolean => {
    const date = form.getValues('date');
    const time = form.getValues('time');
    const inspectorId = form.getValues('inspectorId');

    if (!date || !time || !inspectorId) {
      toast.error('Please select a date and time for your inspection', {
        duration: 5000,
      });
      return false;
    }

    return true;
  };

  const validateTab3 = async (): Promise<boolean> => {
    const client = form.getValues('client');
    const missingFields: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validate client fields based on isCompany
    if (client.isCompany) {
      // Validate company name (required for companies)
      if (!client.companyName || client.companyName.trim() === '') {
        missingFields.push('Company Name');
      }
    } else {
      // Validate client first name (required)
      if (!client.firstName || client.firstName.trim() === '') {
        missingFields.push('First Name');
      }

      // Validate client last name (required)
      if (!client.lastName || client.lastName.trim() === '') {
        missingFields.push('Last Name');
      }
    }

    // Validate client email (required)
    if (!client.email || client.email.trim() === '') {
      missingFields.push('Email');
    } else {
      // Validate email format
      if (!emailRegex.test(client.email)) {
        toast.error('Please enter a valid email address', {
          duration: 5000,
        });
        return false;
      }
    }

    // Validate client phone (required)
    if (!client.phone || client.phone.trim() === '') {
      missingFields.push('Phone');
    }

    // Validate agents - if any agent field is filled, email is required
    const agents = form.getValues('agents');
    for (let index = 0; index < agents.length; index++) {
      const agent = agents[index];
      const hasAnyField = 
        (agent.firstName && agent.firstName.trim() !== '') ||
        (agent.lastName && agent.lastName.trim() !== '') ||
        (agent.phone && agent.phone.trim() !== '') ||
        (agent.agency && agent.agency.trim() !== '');
      
      if (hasAnyField) {
        if (!agent.email || agent.email.trim() === '') {
          missingFields.push(`Agent ${index + 1} Email`);
        } else if (!emailRegex.test(agent.email)) {
          toast.error(`Please enter a valid email address for Agent ${index + 1}`, {
            duration: 5000,
          });
          return false;
        }
      }
    }

    // Validate listing agents - if any listing agent field is filled, email is required
    const listingAgents = form.getValues('listingAgents');
    for (let index = 0; index < listingAgents.length; index++) {
      const agent = listingAgents[index];
      const hasAnyField = 
        (agent.firstName && agent.firstName.trim() !== '') ||
        (agent.lastName && agent.lastName.trim() !== '') ||
        (agent.phone && agent.phone.trim() !== '') ||
        (agent.agency && agent.agency.trim() !== '');
      
      if (hasAnyField) {
        if (!agent.email || agent.email.trim() === '') {
          missingFields.push(`Listing Agent ${index + 1} Email`);
        } else if (!emailRegex.test(agent.email)) {
          toast.error(`Please enter a valid email address for Listing Agent ${index + 1}`, {
            duration: 5000,
          });
          return false;
        }
      }
    }

    // If there are missing fields
    if (missingFields.length > 0) {
      const fieldsList = missingFields.length === 1 
        ? missingFields[0]
        : missingFields.length === 2
        ? `${missingFields[0]} and ${missingFields[1]}`
        : missingFields.length === 3
        ? `${missingFields[0]}, ${missingFields[1]}, and ${missingFields[2]}`
        : `${missingFields.slice(0, -1).join(', ')}, and ${missingFields[missingFields.length - 1]}`;
      
      toast.error(`Please fill in the following required fields: ${fieldsList}`, {
        duration: 5000,
      });
      return false;
    }

    return true;
  };

  const handleNextTab = async () => {
    if (activeTab === 'what-where') {
      const isValid = await validateTab1();
      if (isValid) {
        setValidatedTabs(prev => new Set([...Array.from(prev), 'when']));
        setActiveTab('when');
      }
    } else if (activeTab === 'when') {
      const isValid = validateTab2();
      if (isValid) {
        setValidatedTabs(prev => new Set([...Array.from(prev), 'who']));
        setActiveTab('who');
      }
    } else if (activeTab === 'who') {
      const isValid = await validateTab3();
      if (isValid) {
        setValidatedTabs(prev => new Set([...Array.from(prev), 'review']));
        setActiveTab('review');
      }
    }
  };

  const handlePreviousTab = () => {
    if (activeTab === 'review') {
      setActiveTab('who');
    } else if (activeTab === 'who') {
      setActiveTab('when');
    } else if (activeTab === 'when') {
      setActiveTab('what-where');
    }
  };

  const handleAddressSelect = async (placeId: string, description: string) => {
    try {
      const response = await fetch(
        `/api/addresses/details?placeId=${encodeURIComponent(placeId)}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        console.error('Failed to fetch address details');
        return;
      }

      const data = await response.json();
      const streetAddress = data.streetAddress || description.split(',')[0].trim();

      const currentLocation = form.getValues('location');
      form.setValue('location', {
        ...currentLocation,
        address: streetAddress,
        city: data.city || currentLocation.city || '',
        state: data.state || currentLocation.state || '',
        zip: data.zip || currentLocation.zip || '',
        county: data.county || currentLocation.county || '',
      });
    } catch (error) {
      console.error('Error fetching address details:', error);
    }
  };

  // Calendar utility functions
  const getTwoWeekDates = useMemo(() => {
    const dates: Date[] = [];
    const start = new Date(currentWeekStart);
    for (let i = 0; i < 14; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [currentWeekStart]);

  const getDateRangeLabel = () => {
    if (getTwoWeekDates.length === 0) return '';
    const first = getTwoWeekDates[0];
    const last = getTwoWeekDates[getTwoWeekDates.length - 1];
    const firstFormatted = format(first, 'MMM d');
    const lastFormatted = format(last, 'MMM d, yyyy');
    return `${firstFormatted} - ${lastFormatted}`;
  };

  const handleTodayClick = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day;
    const sunday = new Date(today);
    sunday.setDate(diff);
    sunday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(sunday);
  };

  const handlePrevWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 14);
    setCurrentWeekStart(newStart);
  };

  const handleNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 14);
    setCurrentWeekStart(newStart);
  };

  const handleTimeSlotClick = (date: Date, time: string) => {
    if (!selectedInspectorId) {
      toast.error('Please select an inspector first');
      return;
    }
    
    // Set date, time, and inspector ID
    form.setValue('date', date);
    form.setValue('time', time);
    form.setValue('inspectorId', selectedInspectorId);
    
    toast.success(`Selected ${format(date, 'MMM d')} at ${formatTimeLabel(time)}`);
    
    // Automatically navigate to next tab
    setTimeout(() => {
      setValidatedTabs(prev => new Set([...Array.from(prev), 'who']));
      setActiveTab('who');
    }, 100);
  };

  const getAvailableTimesForDateCell = (date: Date): string[] => {
    if (!selectedInspectorId) return [];
    const inspector = inspectors.find(i => i.inspectorId === selectedInspectorId);
    if (!inspector || !inspector.availability || !inspector.availability.days) return [];
    
    try {
      const availableTimes = getAvailableTimesForDate(date, viewMode, inspector.availability);
      
      // Filter out times that are within the minimum scheduling hours
      if (schedulingMinimumHours > 0) {
        const now = new Date();
        const minimumAllowedTime = new Date(now.getTime() + schedulingMinimumHours * 60 * 60 * 1000);
        
        return availableTimes.filter(time => {
          const [hours, minutes] = time.split(':').map(Number);
          const timeSlotDate = new Date(date);
          timeSlotDate.setHours(hours, minutes, 0, 0);
          
          // Only filter if the time slot is in the future but within the minimum window
          return timeSlotDate >= minimumAllowedTime;
        });
      }
      
      return availableTimes;
    } catch (error) {
      console.error('Error getting available times:', error);
      return [];
    }
  };

  const isPastDate = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const isDateSelected = (date: Date): boolean => {
    const selectedDate = form.watch('date');
    if (!selectedDate) return false;
    return format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
  };

  const isTimeSelected = (date: Date, time: string): boolean => {
    const selectedDate = form.watch('date');
    const selectedTime = form.watch('time');
    if (!selectedDate || !selectedTime) return false;
    return format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') && selectedTime === time;
  };

  const validateDiscountCode = async (code: string) => {
    if (!code || !code.trim()) {
      setDiscountCodeValid(null);
      setDiscountDetails(null);
      return;
    }

    try {
      setValidatingDiscount(true);
      const response = await fetch(
        `/api/public/company/${companyId}/validate-discount?code=${encodeURIComponent(code.trim())}`
      );

      if (response.ok) {
        const data = await response.json();
        setDiscountCodeValid(true);
        setDiscountDetails(data.discountCode);
        toast.success('Discount code applied successfully!');
      } else {
        setDiscountCodeValid(false);
        setDiscountDetails(null);
        toast.error('Invalid discount code');
      }
    } catch (error) {
      console.error('Error validating discount code:', error);
      setDiscountCodeValid(false);
      setDiscountDetails(null);
      toast.error('Error validating discount code');
    } finally {
      setValidatingDiscount(false);
    }
  };

  const calculateTotal = () => {
    const subtotal = selectedServices.reduce((sum, s) => {
      const serviceCost = s.service.baseCost || 0;
      const addOnsCost = s.addOns.reduce((addOnSum, addOn) => addOnSum + (addOn.addFee || 0), 0);
      return sum + serviceCost + addOnsCost;
    }, 0);

    let discountAmount = 0;
    if (discountDetails) {
      if (discountDetails.type === 'percent') {
        discountAmount = subtotal * (discountDetails.value / 100);
      } else {
        discountAmount = discountDetails.value;
      }
    }

    const total = Math.max(0, subtotal - discountAmount);

    return { subtotal, discountAmount, total };
  };

  const handleScheduleInspection = async () => {
    if (submitting) return;

    try {
      setSubmitting(true);

      // Get form data
      const formData = form.getValues();
      const selectedDate = formData.date;
      const selectedTime = formData.time;

      if (!selectedDate || !selectedTime) {
        toast.error('Please select a date and time');
        setSubmitting(false);
        return;
      }

      // Combine date and time into a single Date object
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const inspectionDate = new Date(selectedDate);
      inspectionDate.setHours(hours, minutes, 0, 0);

      // Transform services data
      const servicesPayload = selectedServices.map(s => ({
        serviceId: s.serviceId,
        addOns: s.addOns.map(addOn => ({
          name: addOn.name,
          addFee: addOn.addFee || 0,
        })),
      }));

      // Transform client data (single client in array)
      const clientsPayload = [{
        isCompany: formData.client.isCompany,
        email: formData.client.email,
        firstName: formData.client.firstName,
        lastName: formData.client.lastName,
        companyName: formData.client.companyName,
        phone: formData.client.phone,
      }];

      // Transform agents data (filter out empty ones)
      const agentsPayload = formData.agents
        .filter(agent => agent.email && agent.email.trim())
        .map(agent => ({
          email: agent.email,
          firstName: agent.firstName,
          lastName: agent.lastName,
          phone: agent.phone,
          agency: agent.agency,
        }));

      // Transform listing agents data (filter out empty ones)
      const listingAgentsPayload = formData.listingAgents
        .filter(agent => agent.email && agent.email.trim())
        .map(agent => ({
          email: agent.email,
          firstName: agent.firstName,
          lastName: agent.lastName,
          phone: agent.phone,
          agency: agent.agency,
        }));

      // Build the API payload
      const payload = {
        date: inspectionDate.toISOString(),
        inspector: formData.inspectorId,
        services: servicesPayload,
        discountCode: formData.discountCode || undefined,
        location: {
          address: formData.location.address,
          unit: formData.location.unit || undefined,
          city: formData.location.city || undefined,
          state: formData.location.state || undefined,
          zip: formData.location.zip || undefined,
          county: formData.location.county || undefined,
          squareFeet: formData.location.squareFeet ? Number(formData.location.squareFeet) : undefined,
          yearBuild: formData.location.yearBuild ? Number(formData.location.yearBuild) : undefined,
          foundation: formData.location.foundation || undefined,
        },
        clients: clientsPayload,
        agents: agentsPayload,
        listingAgents: listingAgentsPayload,
        referralSource: formData.referralSource || undefined,
        clientNote: formData.notes || undefined,
        clientAgreedToTerms: formData.agreeToTerms,
        customData: formData.customData || {},
      };

      // Make API request
      const response = await fetch(`/api/public/company/${companyId}/schedule-inspection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to schedule inspection');
      }

      // Success! Show success banner
      setScheduleSuccess(true);
      
      // Scroll to top to show success banner
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error: any) {
      console.error('Schedule inspection error:', error);
      toast.error(error.message || 'Failed to schedule inspection. Please try again.', {
        duration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || schedulerEnabled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Company Not Found</h1>
          <p className="text-muted-foreground">{error || 'The company you are looking for does not exist.'}</p>
        </div>
      </div>
    );
  }

  // Check if scheduler is enabled
  if (schedulerEnabled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Online Scheduling Not Available</h1>
          <p className="text-muted-foreground">Online scheduling is not enabled.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <div className="container mx-auto py-8 max-w-4xl">
        {company.logoUrl && (
          <div className="mb-8 text-center">
            <img src={company.logoUrl} alt={company.name} className="h-16 mx-auto" />
          </div>
        )}

        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Schedule an Inspection</h1>
          <p className="text-muted-foreground">Fill in the details below to schedule your inspection</p>
        </div>

        {scheduleSuccess ? (
          <div className="p-8 bg-green-50 border-2 border-green-500 rounded-lg text-center">
            <div className="flex justify-center mb-4">
              <svg className="w-16 h-16 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-green-900 mb-2">Request Submitted Successfully!</h2>
            <p className="text-lg text-green-800 mb-6">Your inspection request is sent. We will confirm it from our end.</p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
              className="border-green-600 text-green-700 hover:bg-green-100"
            >
              Schedule Another Inspection
            </Button>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(value) => {
          // Only allow navigation to previous tabs or validated tabs
          const tabOrder = ['what-where', 'when', 'who', 'review'];
          const currentIndex = tabOrder.indexOf(activeTab);
          const targetIndex = tabOrder.indexOf(value);
          
          // Allow backward navigation always
          if (targetIndex < currentIndex) {
            setActiveTab(value);
            return;
          }
          
          // For forward navigation, only allow if target tab is validated
          if (targetIndex > currentIndex) {
            if (validatedTabs.has(value)) {
              setActiveTab(value);
            } else {
              // Validate current tab before allowing forward navigation
              if (activeTab === 'what-where') {
                validateTab1().then((isValid) => {
                  if (isValid) {
                    setValidatedTabs(prev => new Set([...Array.from(prev), value]));
                    setActiveTab(value);
                  }
                });
              } else if (activeTab === 'when') {
                const isValid = validateTab2();
                if (isValid) {
                  setValidatedTabs(prev => new Set([...Array.from(prev), value]));
                  setActiveTab(value);
                }
              } else if (activeTab === 'who') {
                validateTab3().then((isValid) => {
                  if (isValid) {
                    setValidatedTabs(prev => new Set([...Array.from(prev), value]));
                    setActiveTab(value);
                  }
                });
              } else {
                // For other tabs, just allow navigation
                setValidatedTabs(prev => new Set([...Array.from(prev), value]));
                setActiveTab(value);
              }
            }
          }
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="what-where">What & Where</TabsTrigger>
            <TabsTrigger value="when" disabled={!validatedTabs.has('when') && activeTab !== 'when'}>When</TabsTrigger>
            <TabsTrigger value="who" disabled={!validatedTabs.has('who') && activeTab !== 'who'}>Who to contact</TabsTrigger>
            <TabsTrigger value="review" disabled={!validatedTabs.has('review') && activeTab !== 'review'}>Review & Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="what-where" className="mt-6">
            <div className="space-y-6 bg-card border rounded-lg p-6">
              {/* Services Section */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Services</h3>
                  <p className="text-sm text-muted-foreground mb-4">Select the services you need</p>
                </div>

                <div className="space-y-2">
                  <Label>Service</Label>
                  <ReactSelect
                    value={null}
                    onChange={(option: any) => {
                      if (option && option.service) {
                        const service = option.service;
                        if (!selectedServices.find(s => s.serviceId === service._id)) {
                          setSelectedServices([
                            ...selectedServices,
                            {
                              serviceId: service._id,
                              service: service,
                              addOns: [],
                            },
                          ]);
                        }
                      }
                    }}
                    options={services
                      .filter(s => !selectedServices.find(ss => ss.serviceId === s._id))
                      .map(service => ({
                        value: service._id,
                        label: service.name,
                        service: service,
                      }))}
                    isClearable
                    placeholder="Select a service..."
                    className="react-select-container"
                    classNamePrefix="react-select"
                  />
                </div>

                <div className={selectedServices.length > 1 ? "grid grid-cols-2 gap-4" : "space-y-4"}>
                  {selectedServices.map((selectedService, index) => {
                    const service = selectedService.service;
                    const availableAddOns = service.addOns || [];

                    return (
                      <div key={index} className="space-y-2 p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{service.name}</p>
                            <p className="text-sm text-muted-foreground">
                              ${service.baseCost || 0} • {service.baseDurationHours || 0} hrs
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedServices(selectedServices.filter((_, i) => i !== index));
                            }}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {availableAddOns.length > 0 && (
                          <div className="space-y-2 mt-3">
                            <Label>Add-ons (optional)</Label>
                            <ReactSelect
                              isMulti
                              value={selectedService.addOns.map(addOn => ({
                                value: addOn.name,
                                label: addOn.name,
                              }))}
                              onChange={(options: any) => {
                                const newSelectedServices = [...selectedServices];
                                newSelectedServices[index].addOns = (options || []).map((opt: any) => {
                                  const addOn = availableAddOns.find((a: any) => a.name === opt.value);
                                  if (!addOn) return null;
                                  return {
                                    name: addOn.name,
                                    addFee: addOn.baseCost || 0,
                                  };
                                }).filter(Boolean);
                                setSelectedServices(newSelectedServices);
                              }}
                              options={availableAddOns.map((addOn: any) => ({
                                value: addOn.name,
                                label: addOn.name,
                              }))}
                              placeholder="Select add-ons..."
                              className="react-select-container"
                              classNamePrefix="react-select"
                              menuIsOpen={addonMenuOpen[index] || false}
                              onMenuOpen={() => setAddonMenuOpen(prev => ({ ...prev, [index]: true }))}
                              onMenuClose={() => setAddonMenuOpen(prev => ({ ...prev, [index]: false }))}
                              components={{
                                ValueContainer: (props: any) => {
                                  const { children, ...rest } = props;
                                  const hasSelectedValues = selectedService.addOns.length > 0;
                                  
                                  return (
                                    <components.ValueContainer {...rest}>
                                      {children}
                                      {hasSelectedValues && (
                                        <button
                                          type="button"
                                          className="h-6 px-2 text-xs ml-1 shrink-0 bg-[#8230c9] text-white hover:bg-[#6d28a8] active:bg-[#5a2188] transition-all duration-200 rounded-md font-medium shadow-sm hover:shadow"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setAddonMenuOpen(prev => ({ ...prev, [index]: true }));
                                          }}
                                        >
                                          Add another
                                        </button>
                                      )}
                                    </components.ValueContainer>
                                  );
                                },
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedServices.length === 0 && (
                  <p className="text-sm text-destructive">Please select at least one service</p>
                )}
              </div>

              {/* Location Section */}
              <div className="space-y-4 border-t pt-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Location</h3>
                </div>
                <LocationFields
                  control={form.control}
                  errors={form.formState.errors}
                  foundationOptions={foundationOptions}
                  onAddressSelect={handleAddressSelect}
                />
              </div>

              {/* Custom Fields Section */}
              {companyId && (
                <div className="space-y-4 border-t pt-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Additional Information</h3>
                  </div>
                  <CustomFields
                    control={form.control}
                    customData={form.watch('customData')}
                    companyId={companyId}
                  />
                </div>
              )}

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleNextTab} disabled={selectedServices.length === 0}>
                  Next
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="when" className="mt-6">
            <div className="space-y-6 bg-card border rounded-lg p-6 overflow-x-auto">
              {loadingInspectors ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">Loading availability...</p>
                </div>
              ) : inspectors.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No inspectors available</p>
                </div>
              ) : (
                <>
                  {/* Inspector Selection - Only show if more than one inspector AND allowChoiceOfInspectors is true */}
                  {inspectors.length > 1 && allowChoiceOfInspectors && (
                    <div className="space-y-2 mb-2">
                      <Label className="text-sm font-medium">Inspector</Label>
                      <Select
                        value={selectedInspectorId || ''}
                        onValueChange={(value) => {
                          setSelectedInspectorId(value);
                          form.setValue('inspectorId', value);
                          form.setValue('date', undefined);
                          form.setValue('time', undefined);
                        }}
                      >
                        <SelectTrigger className="w-full max-w-xs">
                          <SelectValue placeholder="Select inspector" />
                        </SelectTrigger>
                        <SelectContent>
                          {inspectors.map((inspector) => (
                            <SelectItem key={inspector.inspectorId} value={inspector.inspectorId}>
                              {inspector.inspectorName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Calendar Navigation */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleTodayClick} className="h-9">
                        Today
                      </Button>
                      <Button variant="outline" size="icon" onClick={handlePrevWeek} className="h-9 w-9">
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={handleNextWeek} className="h-9 w-9">
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="text-base font-semibold text-foreground">{getDateRangeLabel()}</div>
                    <div className="w-[120px]"></div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="space-y-0 border border-border rounded-lg overflow-hidden">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 border-b border-border bg-muted/30">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="text-center text-sm font-medium text-foreground py-3 px-2 border-r border-border last:border-r-0">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Calendar Dates */}
                    <div className="grid grid-cols-7">
                      {getTwoWeekDates.map((date, index) => {
                        const availableTimes = getAvailableTimesForDateCell(date);
                        const isPast = isPastDate(date);
                        const dateSelected = isDateSelected(date);
                        const dayNumber = date.getDate();
                        const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

                        return (
                          <div
                            key={index}
                            className={`min-h-[200px] border-r border-b border-border last:border-r-0 bg-background flex flex-col transition-colors ${
                              isPast ? 'opacity-40 bg-muted/10' : ''
                            } ${dateSelected ? 'bg-primary/5 ring-1 ring-primary/20' : ''} ${isToday && !dateSelected ? 'bg-muted/10' : ''} hover:bg-muted/5`}
                          >
                            {/* Date Number in Corner */}
                            <div className={`text-sm font-medium px-3 pt-3 pb-1.5 ${
                              isPast ? 'text-muted-foreground/50' : isToday ? 'text-primary font-semibold' : 'text-muted-foreground'
                            }`}>
                              {dayNumber}
                            </div>

                            {/* Time Slots */}
                            <div className="flex-1 px-3 pb-3 overflow-y-auto">
                              {isPast ? (
                                <p className="text-xs text-muted-foreground/50 text-center py-2">Past</p>
                              ) : availableTimes.length === 0 ? (
                                <p className="text-xs text-muted-foreground/50 text-center py-2">Not available</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {availableTimes.map((time) => {
                                    const timeSelected = isTimeSelected(date, time);
                                    return (
                                      <button
                                        key={time}
                                        type="button"
                                        onClick={() => handleTimeSlotClick(date, time)}
                                        className={`w-full text-center text-xs py-2 px-2 rounded border transition-all ${
                                          timeSelected
                                            ? 'bg-primary text-primary-foreground border-primary font-medium shadow-sm'
                                            : 'text-foreground border-border hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground'
                                        }`}
                                      >
                                        {formatTimeLabel(time)}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={handlePreviousTab}>
                  Previous
                </Button>
                <Button 
                  onClick={handleNextTab}
                  disabled={!form.watch('date') || !form.watch('time')}
                >
                  Next
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="who" className="mt-6">
            <div className="space-y-6 bg-card border rounded-lg p-6">
              {/* Client Section */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Client <span className="text-destructive">*</span>
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">All fields are required</p>
                </div>

                <div className="space-y-4 p-4 border rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isCompany"
                      checked={form.watch('client.isCompany')}
                      onCheckedChange={(checked) => {
                        form.setValue('client.isCompany', checked === true);
                        if (checked) {
                          form.setValue('client.firstName', '');
                          form.setValue('client.lastName', '');
                        } else {
                          form.setValue('client.companyName', '');
                        }
                      }}
                    />
                    <Label htmlFor="isCompany" className="text-sm font-normal cursor-pointer">
                      Client is a Company/Organization
                    </Label>
                  </div>

                  {form.watch('client.isCompany') ? (
                    <div className="space-y-2">
                      <Label htmlFor="clientCompanyName">
                        Company Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="clientCompanyName"
                        value={form.watch('client.companyName') || ''}
                        onChange={(e) => form.setValue('client.companyName', e.target.value)}
                        placeholder="Company name..."
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="clientFirstName">
                          First Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="clientFirstName"
                          value={form.watch('client.firstName') || ''}
                          onChange={(e) => form.setValue('client.firstName', e.target.value)}
                          placeholder="First name..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clientLastName">
                          Last Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="clientLastName"
                          value={form.watch('client.lastName') || ''}
                          onChange={(e) => form.setValue('client.lastName', e.target.value)}
                          placeholder="Last name..."
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientEmail">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="clientEmail"
                        type="email"
                        value={form.watch('client.email') || ''}
                        onChange={(e) => form.setValue('client.email', e.target.value)}
                        placeholder="Email..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientPhone">
                        Phone <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="clientPhone"
                        type="tel"
                        value={form.watch('client.phone') || ''}
                        onChange={(e) => form.setValue('client.phone', e.target.value)}
                        placeholder="Phone..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Agent Section */}
              <div className="space-y-4 border-t pt-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Agent</h3>
                  <p className="text-sm text-muted-foreground mb-4">Add agent information (optional)</p>
                </div>

                {form.watch('agents').map((agent, index) => {
                  const loadAgentOptions = async (inputValue: string) => {
                    if (!inputValue || inputValue.length < 2) {
                      return [];
                    }

                    try {
                      const response = await fetch(
                        `/api/public/company/${companyId}/agents/search?search=${encodeURIComponent(inputValue)}&limit=20`
                      );

                      if (!response.ok) {
                        return [];
                      }

                      const data = await response.json();
                      const agentsList = data.agents || [];

                      return agentsList.map((a: any) => {
                        const displayName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Unnamed Agent';
                        return {
                          value: a._id,
                          label: displayName,
                          agent: a,
                        };
                      });
                    } catch (error) {
                      console.error('Error loading agents:', error);
                      return [];
                    }
                  };

                  const handleAgentSelect = (selectedOption: any) => {
                    if (!selectedOption || !selectedOption.agent) return;

                    const selectedAgent = selectedOption.agent;
                    const currentAgents = form.getValues('agents');
                    const newAgents = [...currentAgents];
                    
                    newAgents[index] = {
                      firstName: selectedAgent.firstName || '',
                      lastName: selectedAgent.lastName || '',
                      email: selectedAgent.email || '',
                      phone: selectedAgent.phone || '',
                      agency: selectedAgent.agency?.name || selectedAgent.agencyName || '',
                    };

                    form.setValue('agents', newAgents);
                  };

                  return (
                    <div key={index} className="space-y-4 p-4 border rounded-lg">
                      {form.watch('agents').length > 1 && (
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Agent {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const currentAgents = form.getValues('agents');
                              form.setValue('agents', currentAgents.filter((_, i) => i !== index));
                            }}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Search Existing Agent</Label>
                        <AsyncSelect
                          loadOptions={loadAgentOptions}
                          onChange={handleAgentSelect}
                          placeholder="Type to search for existing agent..."
                          isClearable
                          noOptionsMessage={({ inputValue }) =>
                            inputValue.length < 2
                              ? 'Type at least 2 characters to search'
                              : 'No agents found'
                          }
                          className="react-select-container"
                          classNamePrefix="react-select"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`agentFirstName-${index}`}>First Name</Label>
                        <Input
                          id={`agentFirstName-${index}`}
                          value={agent.firstName || ''}
                          onChange={(e) => {
                            const currentAgents = form.getValues('agents');
                            const newAgents = [...currentAgents];
                            newAgents[index] = {
                              ...newAgents[index],
                              firstName: e.target.value,
                            };
                            form.setValue('agents', newAgents);
                          }}
                          placeholder="First name..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`agentLastName-${index}`}>Last Name</Label>
                        <Input
                          id={`agentLastName-${index}`}
                          value={agent.lastName || ''}
                          onChange={(e) => {
                            const currentAgents = form.getValues('agents');
                            const newAgents = [...currentAgents];
                            newAgents[index] = {
                              ...newAgents[index],
                              lastName: e.target.value,
                            };
                            form.setValue('agents', newAgents);
                          }}
                          placeholder="Last name..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`agentEmail-${index}`}>Email</Label>
                        <Input
                          id={`agentEmail-${index}`}
                          type="email"
                          value={agent.email || ''}
                          onChange={(e) => {
                            const currentAgents = form.getValues('agents');
                            const newAgents = [...currentAgents];
                            newAgents[index] = {
                              ...newAgents[index],
                              email: e.target.value,
                            };
                            form.setValue('agents', newAgents);
                          }}
                          placeholder="Email..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`agentPhone-${index}`}>Phone</Label>
                        <Input
                          id={`agentPhone-${index}`}
                          type="tel"
                          value={agent.phone || ''}
                          onChange={(e) => {
                            const currentAgents = form.getValues('agents');
                            const newAgents = [...currentAgents];
                            newAgents[index] = {
                              ...newAgents[index],
                              phone: e.target.value,
                            };
                            form.setValue('agents', newAgents);
                          }}
                          placeholder="Phone..."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`agentAgency-${index}`}>Agency Name</Label>
                      <Input
                        id={`agentAgency-${index}`}
                        value={agent.agency || ''}
                        onChange={(e) => {
                          const currentAgents = form.getValues('agents');
                          const newAgents = [...currentAgents];
                          newAgents[index] = {
                            ...newAgents[index],
                            agency: e.target.value,
                          };
                          form.setValue('agents', newAgents);
                        }}
                        placeholder="Agency name..."
                      />
                    </div>
                  </div>
                  );
                })}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const currentAgents = form.getValues('agents');
                    form.setValue('agents', [
                      ...currentAgents,
                      {
                        firstName: '',
                        lastName: '',
                        email: '',
                        phone: '',
                        agency: '',
                      },
                    ]);
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Agent
                </Button>
              </div>

              {/* Listing Agent Section */}
              <div className="space-y-4 border-t pt-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Listing Agent</h3>
                  <p className="text-sm text-muted-foreground mb-4">Add listing agent information (optional)</p>
                </div>

                {form.watch('listingAgents').map((agent, index) => {
                  const loadAgentOptions = async (inputValue: string) => {
                    if (!inputValue || inputValue.length < 2) {
                      return [];
                    }

                    try {
                      const response = await fetch(
                        `/api/public/company/${companyId}/agents/search?search=${encodeURIComponent(inputValue)}&limit=20`
                      );

                      if (!response.ok) {
                        return [];
                      }

                      const data = await response.json();
                      const agentsList = data.agents || [];

                      return agentsList.map((a: any) => {
                        const displayName = `${a.firstName || ''} ${a.lastName || ''}`.trim() || 'Unnamed Agent';
                        return {
                          value: a._id,
                          label: displayName,
                          agent: a,
                        };
                      });
                    } catch (error) {
                      console.error('Error loading agents:', error);
                      return [];
                    }
                  };

                  const handleAgentSelect = (selectedOption: any) => {
                    if (!selectedOption || !selectedOption.agent) return;

                    const selectedAgent = selectedOption.agent;
                    const currentAgents = form.getValues('listingAgents');
                    const newAgents = [...currentAgents];
                    
                    newAgents[index] = {
                      firstName: selectedAgent.firstName || '',
                      lastName: selectedAgent.lastName || '',
                      email: selectedAgent.email || '',
                      phone: selectedAgent.phone || '',
                      agency: selectedAgent.agency?.name || selectedAgent.agencyName || '',
                    };

                    form.setValue('listingAgents', newAgents);
                  };

                  return (
                    <div key={index} className="space-y-4 p-4 border rounded-lg">
                      {form.watch('listingAgents').length > 1 && (
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Listing Agent {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const currentAgents = form.getValues('listingAgents');
                              form.setValue('listingAgents', currentAgents.filter((_, i) => i !== index));
                            }}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Search Existing Agent</Label>
                        <AsyncSelect
                          loadOptions={loadAgentOptions}
                          onChange={handleAgentSelect}
                          placeholder="Type to search for existing agent..."
                          isClearable
                          noOptionsMessage={({ inputValue }) =>
                            inputValue.length < 2
                              ? 'Type at least 2 characters to search'
                              : 'No agents found'
                          }
                          className="react-select-container"
                          classNamePrefix="react-select"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`listingAgentFirstName-${index}`}>First Name</Label>
                        <Input
                          id={`listingAgentFirstName-${index}`}
                          value={agent.firstName || ''}
                          onChange={(e) => {
                            const currentAgents = form.getValues('listingAgents');
                            const newAgents = [...currentAgents];
                            newAgents[index] = {
                              ...newAgents[index],
                              firstName: e.target.value,
                            };
                            form.setValue('listingAgents', newAgents);
                          }}
                          placeholder="First name..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`listingAgentLastName-${index}`}>Last Name</Label>
                        <Input
                          id={`listingAgentLastName-${index}`}
                          value={agent.lastName || ''}
                          onChange={(e) => {
                            const currentAgents = form.getValues('listingAgents');
                            const newAgents = [...currentAgents];
                            newAgents[index] = {
                              ...newAgents[index],
                              lastName: e.target.value,
                            };
                            form.setValue('listingAgents', newAgents);
                          }}
                          placeholder="Last name..."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`listingAgentEmail-${index}`}>Email</Label>
                        <Input
                          id={`listingAgentEmail-${index}`}
                          type="email"
                          value={agent.email || ''}
                          onChange={(e) => {
                            const currentAgents = form.getValues('listingAgents');
                            const newAgents = [...currentAgents];
                            newAgents[index] = {
                              ...newAgents[index],
                              email: e.target.value,
                            };
                            form.setValue('listingAgents', newAgents);
                          }}
                          placeholder="Email..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`listingAgentPhone-${index}`}>Phone</Label>
                        <Input
                          id={`listingAgentPhone-${index}`}
                          type="tel"
                          value={agent.phone || ''}
                          onChange={(e) => {
                            const currentAgents = form.getValues('listingAgents');
                            const newAgents = [...currentAgents];
                            newAgents[index] = {
                              ...newAgents[index],
                              phone: e.target.value,
                            };
                            form.setValue('listingAgents', newAgents);
                          }}
                          placeholder="Phone..."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`listingAgentAgency-${index}`}>Agency Name</Label>
                      <Input
                        id={`listingAgentAgency-${index}`}
                        value={agent.agency || ''}
                        onChange={(e) => {
                          const currentAgents = form.getValues('listingAgents');
                          const newAgents = [...currentAgents];
                          newAgents[index] = {
                            ...newAgents[index],
                            agency: e.target.value,
                          };
                          form.setValue('listingAgents', newAgents);
                        }}
                        placeholder="Agency name..."
                      />
                    </div>
                  </div>
                  );
                })}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const currentAgents = form.getValues('listingAgents');
                    form.setValue('listingAgents', [
                      ...currentAgents,
                      {
                        firstName: '',
                        lastName: '',
                        email: '',
                        phone: '',
                        agency: '',
                      },
                    ]);
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Listing Agent
                </Button>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={handlePreviousTab}>
                  Previous
                </Button>
                <Button onClick={handleNextTab}>
                  Next
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="review" className="mt-6">
            <div className="space-y-6 bg-card border rounded-lg p-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Review Your Inspection Details</h3>
                <p className="text-sm text-muted-foreground mb-6">Please review your information before scheduling</p>
              </div>

              {/* Location Summary */}
              <div className="space-y-2">
                <h4 className="font-medium">Location</h4>
                <div className="p-4 border rounded-lg bg-muted/20">
                  <p className="text-sm">{form.watch('location.address')}</p>
                  {form.watch('location.unit') && (
                    <p className="text-sm">Unit: {form.watch('location.unit')}</p>
                  )}
                  {(form.watch('location.city') || form.watch('location.state') || form.watch('location.zip')) && (
                    <p className="text-sm">
                      {[form.watch('location.city'), form.watch('location.state'), form.watch('location.zip')]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Inspector & Date/Time Summary */}
              <div className="space-y-2">
                <h4 className="font-medium">Inspector & Date/Time</h4>
                <div className="p-4 border rounded-lg bg-muted/20">
                  {selectedInspectorId && inspectors.length > 0 ? (
                    <div className="flex items-center gap-3 mb-2">
                      {(() => {
                        const selectedInspector = inspectors.find(i => i.inspectorId === selectedInspectorId);
                        return (
                          <>
                            {selectedInspector?.profileImageUrl && (
                              <img
                                src={selectedInspector.profileImageUrl}
                                alt={selectedInspector.inspectorName}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                {selectedInspector?.inspectorName || 'Not selected'}
                              </p>
                              {selectedInspector?.email && (
                                <p className="text-xs text-muted-foreground">{selectedInspector.email}</p>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Inspector: Not selected</p>
                  )}
                  {form.watch('date') && form.watch('time') ? (
                    <p className="text-sm">
                      {format(form.watch('date')!, 'PPP')} at {formatTimeLabel(form.watch('time')!)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Date/Time: Not selected</p>
                  )}
                </div>
              </div>

              {/* Services Summary with Pricing */}
              <div className="space-y-2">
                <h4 className="font-medium">{hidePricing ? 'Services' : 'Services & Pricing'}</h4>
                <div className="p-4 border rounded-lg bg-muted/20">
                  {selectedServices.length > 0 ? (
                    <div className="space-y-3">
                      {selectedServices.map((selectedService, index) => {
                        const service = selectedService.service;
                        return (
                          <div key={index}>
                            <div className={hidePricing ? "text-sm" : "flex justify-between text-sm"}>
                              <span>{service.name}</span>
                              {!hidePricing && <span>${service.baseCost || 0}</span>}
                            </div>
                            {selectedService.addOns.length > 0 && (
                              <div className="ml-4 mt-1 space-y-1">
                                {selectedService.addOns.map((addOn, addOnIndex) => (
                                  <div key={addOnIndex} className={hidePricing ? "text-xs text-muted-foreground" : "flex justify-between text-xs text-muted-foreground"}>
                                    <span>+ {addOn.name}</span>
                                    {!hidePricing && <span>${addOn.addFee || 0}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {!hidePricing && (
                        <div className="border-t pt-2 mt-2">
                          <div className="flex justify-between text-sm">
                            <span>Subtotal</span>
                            <span>${calculateTotal().subtotal.toFixed(2)}</span>
                          </div>
                          {discountDetails && (
                            <div className="flex justify-between text-sm text-green-600 mt-1">
                              <span>Discount ({discountDetails.code})</span>
                              <span>-${calculateTotal().discountAmount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-semibold mt-2">
                            <span>Total</span>
                            <span>${calculateTotal().total.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No services selected</p>
                  )}
                </div>
              </div>

              {/* Additional Fields */}
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="discountCode">Discount Code</Label>
                  <div className="flex gap-2">
                    <Input
                      id="discountCode"
                      value={form.watch('discountCode') || ''}
                      onChange={(e) => {
                        form.setValue('discountCode', e.target.value);
                        setDiscountCodeValid(null);
                        setDiscountDetails(null);
                      }}
                      placeholder="Enter discount code..."
                      className={discountCodeValid === true ? 'border-green-500' : discountCodeValid === false ? 'border-red-500' : ''}
                    />
                    <Button
                      type="button"
                      onClick={() => validateDiscountCode(form.watch('discountCode') || '')}
                      disabled={!form.watch('discountCode') || validatingDiscount}
                      variant="outline"
                    >
                      {validatingDiscount ? 'Validating...' : 'Apply'}
                    </Button>
                  </div>
                  {discountCodeValid === true && (
                    <p className="text-sm text-green-600">Discount code applied successfully!</p>
                  )}
                  {discountCodeValid === false && (
                    <p className="text-sm text-red-600">Invalid discount code</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referralSource">How did you hear about us?</Label>
                  <Controller
                    name="referralSource"
                    control={form.control}
                    render={({ field }) => (
                      <ReactSelect
                        value={field.value ? { value: field.value, label: field.value } : null}
                        onChange={(option) => field.onChange(option?.value || undefined)}
                        options={referralSourceOptions}
                        isClearable
                        placeholder="Select referral source..."
                        className="react-select-container"
                        classNamePrefix="react-select"
                      />
                    )}
                  />
                </div>

                {allowRequestNotes && (
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={form.watch('notes') || ''}
                      onChange={(e) => form.setValue('notes', e.target.value)}
                      placeholder="Lockbox code, entrance instructions, etc..."
                      rows={3}
                    />
                  </div>
                )}

                <div className="flex items-start space-x-2">
                  <Controller
                    name="agreeToTerms"
                    control={form.control}
                    render={({ field }) => (
                      <Checkbox
                        id="agreeToTerms"
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    )}
                  />
                  <Label
                    htmlFor="agreeToTerms"
                    className="text-sm font-normal cursor-pointer leading-tight"
                  >
                    I agree to receive SMS and emails and accept the privacy policy <span className="text-destructive">*</span>
                  </Label>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={handlePreviousTab} disabled={submitting}>
                  Previous
                </Button>
                <Button 
                  onClick={handleScheduleInspection}
                  disabled={!form.watch('agreeToTerms') || submitting}
                >
                  {submitting ? 'Scheduling...' : 'Schedule Inspection'}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
        )}
      </div>
    </div>
  );
}

