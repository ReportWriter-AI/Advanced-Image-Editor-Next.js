"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ReactSelect, { components } from 'react-select';
import AsyncSelect from 'react-select/async';
import CreatableSelect from 'react-select/creatable';
import AsyncCreatableSelect from 'react-select/async-creatable';
import { format } from 'date-fns';
import { CalendarIcon, ArrowLeft, Plus, X } from 'lucide-react';
import { cn, splitCommaSeparated } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { ImageUpload } from '@/components/ui/image-upload';
import CustomFields from '@/components/custom-fields/CustomFields';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { toast } from 'sonner';
import { checkInspectorAvailability, type InspectorAvailability, getDayKeyFromDate, getAvailableTimesForDate, isDateAvailable } from '@/src/lib/inspection-availability';
import { formatTimeLabel } from '@/src/lib/availability-utils';
import { DAY_LABELS } from '@/src/constants/availability';
import { TimeBlock } from '@/src/models/Availability';
import EventsManager from '@/components/EventsManager';

const getDefaultDate = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
};

// Helper function to check if a string is a valid MongoDB ObjectId
const isValidObjectId = (str: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(str);
};

const inspectionFormSchema = z.object({
  inspector: z.string().optional(),
  companyOwnerRequested: z.boolean(),
  date: z.date().optional(),
  time: z.string(),
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
  clients: z.array(z.object({
    isCompany: z.boolean(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    companyName: z.string().optional(),
    email: z.string().optional(),
    ccEmail: z.string().optional(),
    phone: z.string().optional(),
    categories: z.array(z.string()),
    notes: z.string().optional(),
    privateNotes: z.string().optional(),
  })),
  services: z.array(z.object({
    serviceId: z.string(),
    addOns: z.array(z.object({
      name: z.string(),
      addFee: z.number().optional(),
      addHours: z.number().optional(),
    })),
  })),
  discountCode: z.string().optional(),
  requirePaymentToReleaseReports: z.boolean(),
  paymentNotes: z.string().optional(),
  agents: z.array(z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    ccEmail: z.string().optional(),
    phone: z.string().optional(),
    agency: z.string().optional(),
    photoUrl: z.string().optional(),
    categories: z.array(z.string()),
    notes: z.string().optional(),
    privateNotes: z.string().optional(),
  })),
  listingAgents: z.array(z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().optional(),
    ccEmail: z.string().optional(),
    phone: z.string().optional(),
    agency: z.string().optional(),
    photoUrl: z.string().optional(),
    categories: z.array(z.string()),
    notes: z.string().optional(),
    privateNotes: z.string().optional(),
  })),
  orderId: z.number().optional(),
  referralSource: z.string().optional(),
  confirmedInspection: z.boolean(),
  disableAutomatedNotifications: z.boolean(),
  internalNotes: z.string().optional(),
  customData: z.record(z.string(), z.any()).optional(),
});

type InspectionFormData = z.infer<typeof inspectionFormSchema>;

export default function CreateInspectionPage() {
  const router = useRouter();
  
  const form = useForm<InspectionFormData>({
    resolver: zodResolver(inspectionFormSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      inspector: undefined,
      companyOwnerRequested: false,
      date: getDefaultDate(),
      time: '00:00',
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
      clients: [{
      isCompany: false,
      firstName: '',
      lastName: '',
      companyName: '',
      email: '',
      ccEmail: '',
      phone: '',
        categories: [],
      notes: '',
      privateNotes: '',
      }],
      services: [],
      discountCode: undefined,
      requirePaymentToReleaseReports: true,
      paymentNotes: '',
      agents: [{
        firstName: '',
        lastName: '',
        email: '',
        ccEmail: '',
        phone: '',
        agency: undefined,
        photoUrl: undefined,
        categories: [],
        notes: '',
        privateNotes: '',
      }],
      listingAgents: [{
        firstName: '',
        lastName: '',
        email: '',
        ccEmail: '',
        phone: '',
        agency: undefined,
        photoUrl: undefined,
        categories: [],
        notes: '',
        privateNotes: '',
      }],
      orderId: undefined,
      referralSource: '',
      confirmedInspection: true,
      disableAutomatedNotifications: false,
      internalNotes: '',
      customData: {},
    },
  });

  const [inspectors, setInspectors] = useState<{ value: string; label: string }[]>([]);
  const [companyOwner, setCompanyOwner] = useState<{ id: string; name: string } | null>(null);
  const [loadingFormData, setLoadingFormData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [discountCodes, setDiscountCodes] = useState<any[]>([]);
  const [agreements, setAgreements] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<Array<{
    serviceId: string;
    service: any;
    addOns: Array<{ name: string; addFee?: number; addHours?: number }>;
  }>>([]);
  const [selectedDiscountCode, setSelectedDiscountCode] = useState<{ value: string; label: string; discountCode: any } | null>(null);
  const [agencyNames, setAgencyNames] = useState<Record<string, string>>({});
  const [listingAgencyNames, setListingAgencyNames] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<Array<{
    _id?: string;
    name: string;
    description: string;
    inspector: { value: string; label: string } | null;
    startDate: Date | undefined;
    startTime: string;
    endDate: Date | undefined;
    endTime: string;
  }>>([]);
  const [inspectorAvailability, setInspectorAvailability] = useState<InspectorAvailability | null>(null);
  const [viewMode, setViewMode] = useState<'openSchedule' | 'timeSlots'>('openSchedule');
  const [inspectorName, setInspectorName] = useState<string>('');
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [referralSourceOptions, setReferralSourceOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [foundationOptions, setFoundationOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [addonMenuOpen, setAddonMenuOpen] = useState<Record<number, boolean>>({});
  
  // State tracking for initial load and auto-set scenarios
  const isInitialLoad = useRef(true);
  const isAutoSettingTime = useRef(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  useEffect(() => {
    fetchFormData();
  }, []);

  // Load agency names for selected agencies (only for existing agencies with IDs)
  const agents = form.watch('agents');
  useEffect(() => {
    const loadAgencyNames = async () => {
      // Filter to only get valid ObjectIds (existing agencies), not new agency names
      const agencyIds = agents
        .map(a => a.agency)
        .filter((id): id is string => {
          return Boolean(id) && 
                 typeof id === 'string' && 
                 isValidObjectId(id) && 
                 !agencyNames[id];
        });

      if (agencyIds.length === 0) return;

      try {
        // Load all agencies to find the ones we need
        const response = await fetch('/api/agencies/search?limit=100', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const agenciesList = data.agencies || [];
          const namesMap: Record<string, string> = {};

          agenciesList.forEach((a: any) => {
            const agencyId = String(a._id || a.id);
            if (agencyIds.includes(agencyId)) {
              namesMap[agencyId] = a.name;
            }
          });

          if (Object.keys(namesMap).length > 0) {
            setAgencyNames(prev => ({ ...prev, ...namesMap }));
          }
        }
      } catch (error) {
        console.error('Error loading agency names:', error);
      }
    };

    loadAgencyNames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]);

  // Load agency names for selected listing agencies (only for existing agencies with IDs)
  const listingAgents = form.watch('listingAgents');
  useEffect(() => {
    const loadListingAgencyNames = async () => {
      // Filter to only get valid ObjectIds (existing agencies), not new agency names
      const agencyIds = listingAgents
        .map(a => a.agency)
        .filter((id): id is string => {
          return Boolean(id) && 
                 typeof id === 'string' && 
                 isValidObjectId(id) && 
                 !listingAgencyNames[id];
        });

      if (agencyIds.length === 0) return;

      try {
        // Load all agencies to find the ones we need
        const response = await fetch('/api/agencies/search?limit=100', {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const agenciesList = data.agencies || [];
          const namesMap: Record<string, string> = {};

          agenciesList.forEach((a: any) => {
            const agencyId = String(a._id || a.id);
            if (agencyIds.includes(agencyId)) {
              namesMap[agencyId] = a.name;
            }
          });

          if (Object.keys(namesMap).length > 0) {
            setListingAgencyNames(prev => ({ ...prev, ...namesMap }));
          }
        }
      } catch (error) {
        console.error('Error loading listing agency names:', error);
      }
    };

    loadListingAgencyNames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingAgents]);

  const fetchFormData = async () => {
    try {
      setLoadingFormData(true);
      const [formDataRes, servicesRes, discountCodesRes, agreementsRes, reusableDropdownsRes] = await Promise.all([
        fetch('/api/inspections/form-data', { credentials: 'include' }),
        fetch('/api/services', { credentials: 'include' }),
        fetch('/api/discount-codes', { credentials: 'include' }),
        fetch('/api/agreements', { credentials: 'include' }),
        fetch('/api/reusable-dropdowns', { credentials: 'include' }),
      ]);

      if (formDataRes.ok) {
        const data = await formDataRes.json();
        setInspectors(data.inspectors || []);
        setCompanyOwner(data.companyOwner || null);
      }

      if (servicesRes.ok) {
        const data = await servicesRes.json();
        setServices(data.services || []);
      }

      if (discountCodesRes.ok) {
        const data = await discountCodesRes.json();
        const activeCodes = (data.discountCodes || []).filter((code: any) => code.active);
        setDiscountCodes(activeCodes);
      }

      if (agreementsRes.ok) {
        const data = await agreementsRes.json();
        setAgreements(data.agreements || []);
      }

      if (reusableDropdownsRes.ok) {
        const data = await reusableDropdownsRes.json();
        
        // Parse foundation options
        const foundationValues = splitCommaSeparated(data.foundation || '');
        setFoundationOptions(
          foundationValues.map((value) => ({
            value,
            label: value,
          }))
        );

        // Parse referral source options
        const referralSourceValues = splitCommaSeparated(data.referralSources || '');
        setReferralSourceOptions(
          referralSourceValues.map((value) => ({
            value,
            label: value,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching form data:', error);
    } finally {
      setLoadingFormData(false);
    }
  };

  // Set company owner as default inspector if they are in the inspectors list
  useEffect(() => {
    if (companyOwner && inspectors.length > 0) {
      const currentInspector = form.getValues('inspector');
      // Only set default if no inspector is currently selected
      if (!currentInspector) {
        const companyOwnerInInspectors = inspectors.find(
          (inspector) => inspector.value === companyOwner.id
        );
        if (companyOwnerInInspectors) {
          form.setValue('inspector', companyOwner.id);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyOwner, inspectors]);

  // Ensure disableAutomatedNotifications is true when confirmedInspection is false
  useEffect(() => {
    const confirmedInspection = form.watch('confirmedInspection');
    const disableAutomatedNotifications = form.watch('disableAutomatedNotifications');
    
    if (!confirmedInspection && !disableAutomatedNotifications) {
      form.setValue('disableAutomatedNotifications', true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch('confirmedInspection')]);

  // Check inspector availability when inspector or date changes
  useEffect(() => {
    const checkAvailability = async () => {
      const inspectorId = form.getValues('inspector');
      const date = form.getValues('date');
      const time = form.getValues('time');

      // Skip check if no inspector or date selected
      if (!inspectorId || !date) {
        setInspectorAvailability(null);
        setInspectorName('');
        setAvailableTimes([]); // Clear available times when no inspector/date
        return;
      }

      try {
        // Format date to YYYY-MM-DD
        const dateString = format(date, 'yyyy-MM-dd');
        
        // Fetch availability data
        const response = await fetch(
          `/api/inspections/check-availability?inspectorId=${encodeURIComponent(inspectorId)}&date=${encodeURIComponent(dateString)}`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          console.error('Failed to fetch availability');
          return;
        }

        const data = await response.json();
        setInspectorAvailability(data.availability);
        setViewMode(data.viewMode);
        setInspectorName(data.inspectorName || '');

        // Check availability for the selected date and time
        if (!data.availability) {
          // No availability data for inspector
          setAvailableTimes([]); // No available times
          // Only show toast if not initial load and user has interacted
          if (!isInitialLoad.current && hasUserInteracted) {
            toast.error(
              `${data.inspectorName} is not available for this date`,
              { duration: 5000 }
            );
          }
          // Mark initial load as complete
          if (isInitialLoad.current) {
            isInitialLoad.current = false;
          }
          return;
        }

        // The helper function filters out blocked times from the weekly schedule
        const computedAvailableTimes = getAvailableTimesForDate(
          date,
          data.viewMode,
          data.availability
        );
        setAvailableTimes(computedAvailableTimes);

        // Handle time selection logic
        if (computedAvailableTimes.length > 0) {
          const currentTime = form.getValues('time');
          if (!currentTime || !computedAvailableTimes.includes(currentTime)) {
            // Set flag to indicate we're auto-setting time
            isAutoSettingTime.current = true;
            form.setValue('time', computedAvailableTimes[0], {
              shouldValidate: true,
              shouldDirty: false,
            });
            // Reset flag and mark initial load as complete after a brief delay to allow form state to update
            setTimeout(() => {
              isAutoSettingTime.current = false;
              if (isInitialLoad.current) {
                isInitialLoad.current = false;
              }
            }, 0);
          } else {
            // Time is already valid, mark initial load as complete
            if (isInitialLoad.current) {
              isInitialLoad.current = false;
            }
          }
        } else {
          const currentTime = form.getValues('time');
          if (currentTime) {
            // Set flag to indicate we're auto-setting time
            isAutoSettingTime.current = true;
            form.setValue('time', '', {
              shouldValidate: true,
              shouldDirty: false,
            });
            // Reset flag and mark initial load as complete after a brief delay to allow form state to update
            setTimeout(() => {
              isAutoSettingTime.current = false;
              if (isInitialLoad.current) {
                isInitialLoad.current = false;
              }
            }, 0);
          } else {
            // No time and no available times, mark initial load as complete
            if (isInitialLoad.current) {
              isInitialLoad.current = false;
            }
          }
        }

        // Get available times for the day (for validation and toast messages)
        const result = checkInspectorAvailability(
          date,
          time || '00:00',
          data.viewMode,
          data.availability
        );

        const dayKey = getDayKeyFromDate(date);
        const dayName = DAY_LABELS[dayKey];

        // Helper function to format schedule blocks for Open Schedule mode
        const formatScheduleBlocks = () => {
          const dayData = data.availability.days[dayKey];
          if (!dayData || !dayData.openSchedule || dayData.openSchedule.length === 0) {
            return '';
          }
          
          const blocks = dayData.openSchedule
            .map((block: TimeBlock) => `${formatTimeLabel(block.start)}-${formatTimeLabel(block.end)}`)
            .join(', ');
          
          return blocks;
        };

        // If time is selected, check if it's available
        if (time) {
          // If selected time is not available, show toast with available times
          // Only show toast if not initial load, not auto-setting, and user has interacted
          if (!result.available && !isInitialLoad.current && !isAutoSettingTime.current && hasUserInteracted) {
            if (result.availableTimes.length > 0) {
              if (data.viewMode === 'openSchedule') {
                // For Open Schedule, show regular schedule
                const scheduleBlocks = formatScheduleBlocks();
                if (scheduleBlocks) {
                  toast.error(
                    `${data.inspectorName}'s regular schedule of ${scheduleBlocks} on ${dayName}s.`,
                    { duration: 5000 }
                  );
                } else {
                  toast.error(
                    `${data.inspectorName} is not available for this date`,
                    { duration: 5000 }
                  );
                }
              } else {
                // For Time Slots, show available time slots with day name
                const formattedTimes = result.availableTimes.map(formatTimeLabel);
                
                // Join times with commas and "or" for last item
                let timesText = '';
                if (formattedTimes.length === 1) {
                  timesText = formattedTimes[0];
                } else if (formattedTimes.length === 2) {
                  timesText = `${formattedTimes[0]} or ${formattedTimes[1]}`;
                } else {
                  const lastTime = formattedTimes.pop();
                  timesText = `${formattedTimes.join(', ')}, or ${lastTime}`;
                }

                toast.error(
                  `${data.inspectorName} available at ${timesText} on ${dayName}s`,
                  { duration: 5000 }
                );
              }
            } else {
              toast.error(
                `${data.inspectorName} is not available for this date`,
                { duration: 5000 }
              );
            }
          } else {
            // Inspector is available, check if date is in the past
            // Only show warning if user has interacted
            if (hasUserInteracted) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const selectedDate = new Date(date);
              selectedDate.setHours(0, 0, 0, 0);
              
              if (selectedDate < today) {
                toast.warning(
                  'Date is in the past, no confirmation email will be sent',
                  { duration: 5000 }
                );
              }
            }
            // If available and not in past, silently allow (no toast)
          }
        } else {
          // No time selected yet, show available times so user knows what's available
          // This helps user know availability when they first select the date
          // Only show info toast if user has interacted (not on initial load)
          if (hasUserInteracted && !isAutoSettingTime.current) {
            if (result.availableTimes.length > 0) {
              if (data.viewMode === 'openSchedule') {
                // For Open Schedule, show regular schedule
                const scheduleBlocks = formatScheduleBlocks();
                if (scheduleBlocks) {
                  toast.info(
                    `${data.inspectorName}'s regular schedule of ${scheduleBlocks} on ${dayName}s.`,
                    { duration: 5000 }
                  );
                } else {
                  toast.info(
                    `${data.inspectorName} available on ${dayName}s`,
                    { duration: 5000 }
                  );
                }
              } else {
                // For Time Slots, show available time slots with day name
                const formattedTimes = result.availableTimes.map(formatTimeLabel);
                
                // Join times with commas and "or" for last item
                let timesText = '';
                if (formattedTimes.length === 1) {
                  timesText = formattedTimes[0];
                } else if (formattedTimes.length === 2) {
                  timesText = `${formattedTimes[0]} or ${formattedTimes[1]}`;
                } else {
                  const lastTime = formattedTimes.pop();
                  timesText = `${formattedTimes.join(', ')}, or ${lastTime}`;
                }

                toast.info(
                  `${data.inspectorName} available at ${timesText} on ${dayName}s`,
                  { duration: 5000 }
                );
              }
            } else {
              toast.error(
                `${data.inspectorName} is not available for this date`,
                { duration: 5000 }
              );
            }
          }
          
          // Also check if date is in the past (even if no time selected)
          // Only show warning if user has interacted
          if (hasUserInteracted) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selectedDate = new Date(date);
            selectedDate.setHours(0, 0, 0, 0);
            
            if (selectedDate < today) {
              toast.warning(
                'Date is in the past, no confirmation email will be sent',
                { duration: 5000 }
              );
            }
          }
        }
      } catch (error) {
        console.error('Error checking availability:', error);
      }
    };

    checkAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.watch('inspector'), form.watch('date')]);

  // Auto-set first available time when availableTimes changes and no time is selected
  useEffect(() => {
    const currentTime = form.getValues('time');
    const currentDate = form.getValues('date');
    const currentInspector = form.getValues('inspector');
    
    // Only auto-set if we have a date, inspector, available times, and no time is currently set
    if (currentDate && currentInspector && availableTimes.length > 0 && !currentTime) {
      // Set flag to indicate we're auto-setting time
      isAutoSettingTime.current = true;
      form.setValue('time', availableTimes[0], {
        shouldValidate: true,
        shouldDirty: false,
      });
      // Reset flag and mark initial load as complete after a brief delay to allow form state to update
      setTimeout(() => {
        isAutoSettingTime.current = false;
        if (isInitialLoad.current) {
          isInitialLoad.current = false;
        }
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableTimes]);

  const onSubmit = async (data: InspectionFormData, e?: React.BaseSyntheticEvent) => {
    // Validate that at least one service is selected
    if (selectedServices.length === 0) {
      toast.error('Please select at least one service', {
        duration: 5000,
      });
      setIsSubmitting(false);
      return;
    }

    // Validate all custom fields before submission
    const customFieldsResponse = await fetch('/api/scheduling-options/custom-fields', {
      credentials: 'include',
    });
    
    if (customFieldsResponse.ok) {
      const customFieldsData = await customFieldsResponse.json();
      const requiredFields = (customFieldsData.customFields || []).filter(
        (field: any) => field.requiredForOnlineScheduler && field.fieldKey
      );
      
      if (requiredFields.length > 0) {
        // Trigger validation for all required custom fields
        const validationPromises = requiredFields.map((field: any) => 
          form.trigger(`customData.${field.fieldKey}`)
        );
        const validationResults = await Promise.all(validationPromises);
        
        // Check if any validation failed and collect missing field names
        const missingFields: string[] = [];
        const customDataValue = data.customData || {};
        
        requiredFields.forEach((field: any, index: number) => {
          const fieldValue = customDataValue[field.fieldKey];
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
        
        if (missingFields.length > 0) {
          // Show toast with missing fields
          toast.error(
            `Please fill in the following required custom fields: ${missingFields.join(', ')}`,
            {
              duration: 5000,
            }
          );
          // Prevent form submission - validation errors will be shown in UI
          setIsSubmitting(false);
          return;
        }
      }
    }
    
    try {
      setIsSubmitting(true);
      let dateTime: Date | undefined = undefined;
      if (data.date) {
        dateTime = new Date(data.date);
        if (data.time) {
          const [hours, minutes] = data.time.split(':').map(Number);
          dateTime.setHours(hours, minutes, 0, 0);
        }
      }

      const locationData: any = {};
      if (data.location) {
        if (data.location.address) locationData.address = data.location.address;
        if (data.location.unit) locationData.unit = data.location.unit;
        if (data.location.city) locationData.city = data.location.city;
        if (data.location.state) locationData.state = data.location.state;
        if (data.location.zip) locationData.zip = data.location.zip;
        if (data.location.county) locationData.county = data.location.county;
        if (data.location.squareFeet) locationData.squareFeet = Number(data.location.squareFeet);
        if (data.location.yearBuild) locationData.yearBuild = Number(data.location.yearBuild);
        if (data.location.foundation) locationData.foundation = data.location.foundation;
      }

      // Prepare events data
      const eventsData = events.map(event => {
        let startDateTime: Date | undefined = undefined;
        let endDateTime: Date | undefined = undefined;

        if (event.startDate) {
          startDateTime = new Date(event.startDate);
          if (event.startTime) {
            const [hours, minutes] = event.startTime.split(':').map(Number);
            startDateTime.setHours(hours, minutes, 0, 0);
          }
        }

        if (event.endDate) {
          endDateTime = new Date(event.endDate);
          if (event.endTime) {
            const [hours, minutes] = event.endTime.split(':').map(Number);
            endDateTime.setHours(hours, minutes, 0, 0);
          }
        }

        return {
          name: event.name.trim(),
          description: event.description.trim() || undefined,
          inspector: event.inspector?.value || undefined,
          startDate: startDateTime?.toISOString(),
          endDate: endDateTime?.toISOString(),
        };
      });

      // Set status based on confirmedInspection
      const status = data.confirmedInspection ? 'Approved' : 'Pending';

      const response = await fetch('/api/inspections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          inspector: data.inspector,
          companyOwnerRequested: data.companyOwnerRequested,
          dateTime: dateTime?.toISOString(),
          location: Object.keys(locationData).length > 0 ? locationData : undefined,
          clients: data.clients.filter(c => c.email?.trim()),
          services: selectedServices.map(s => ({
            serviceId: s.serviceId,
            addOns: s.addOns,
          })),
          discountCode: selectedDiscountCode?.value,
          events: eventsData,
          requirePaymentToReleaseReports: data.requirePaymentToReleaseReports,
          paymentNotes: data.paymentNotes?.trim() || undefined,
          agents: data.agents?.filter((a: any) => a.email?.trim()) || [],
          listingAgents: data.listingAgents?.filter((a: any) => a.email?.trim()) || [],
          referralSource: data.referralSource?.trim() || undefined,
          confirmedInspection: data.confirmedInspection,
          disableAutomatedNotifications: data.disableAutomatedNotifications,
          internalNotes: data.internalNotes?.trim() || undefined,
          customData: data.customData || {},
          status: status,
        }),
      });

      if (response.ok) {
        router.push('/inspections');
      } else {
        const error = await response.json();
        console.error('Failed to create inspection:', error);
        alert(error.error || 'Failed to create inspection');
      }
    } catch (error) {
      console.error('Error creating inspection:', error);
      alert('An error occurred while creating the inspection');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/inspections')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create New Inspection</h1>
            <p className="text-muted-foreground mt-1">
              Fill in the details for your new inspection.
            </p>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 bg-card border rounded-lg p-6">
          <div className="space-y-2">
            <Label>Inspector</Label>
            <Controller
              name="inspector"
              control={form.control}
              render={({ field }) => (
            <ReactSelect
                  value={inspectors.find(opt => opt.value === field.value) || null}
                  onChange={(option) => {
                    field.onChange(option?.value || undefined);
                    setHasUserInteracted(true);
                  }}
              options={inspectors}
              isClearable
              placeholder="Select an inspector..."
              isLoading={loadingFormData}
              className="react-select-container"
              classNamePrefix="react-select"
                />
              )}
            />
          </div>

          {companyOwner && (
            <div className="flex items-center space-x-2">
              <Controller
                name="companyOwnerRequested"
                control={form.control}
                render={({ field }) => (
              <Checkbox
                id="companyOwnerRequested"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                  />
                )}
              />
              <Label
                htmlFor="companyOwnerRequested"
                className="text-sm font-normal cursor-pointer"
              >
                {companyOwner.name} specially requested this
              </Label>
            </div>
          )}

          <div className="space-y-2">
            <Label>Date/Time</Label>
            <Popover></Popover>
            <div className='flex'>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Controller
                    name="date"
                    control={form.control}
                    render={({ field }) => (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              setHasUserInteracted(true);
                            }}
                            initialFocus
                            disabled={(date: Date) => {
                              // If no inspector selected, don't disable any dates
                              // User can select date first, then inspector
                              const inspectorId = form.getValues('inspector');
                              if (!inspectorId) {
                                return false;
                              }

                              // If no availability data, disable all dates
                              // Inspector exists but has no availability configured
                              if (!inspectorAvailability) {
                                return true;
                              }

                              // Check if this date has any availability
                              // IMPORTANT: Date-specific entries block times from weekly schedule
                              // If all times are blocked by date-specific entries, date is unavailable
                              // The isDateAvailable function checks if any times remain after filtering
                              return !isDateAvailable(date, viewMode, inspectorAvailability);
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  />
                </div>
                <div className="w-32">
                  <Controller
                    name="time"
                    control={form.control}
                    render={({ field }) => {
                      // Determine if time picker should be disabled
                      // Disable if: no date selected, no inspector selected, or no available times
                      // Available times are computed considering weekly schedule and date-specific blocks
                      const isDisabled = !form.getValues('date') ||
                        !form.getValues('inspector') ||
                        availableTimes.length === 0;

                      return (
                        <Select
                          value={field.value && availableTimes.includes(field.value) ? field.value : ''}
                          onValueChange={(value) => {
                            field.onChange(value);
                            setHasUserInteracted(true);
                          }}
                          disabled={isDisabled}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={isDisabled ? "No times" : "Select time"} />
                          </SelectTrigger>
                          <SelectContent className="max-h-60 overflow-y-auto">
                            {availableTimes.length === 0 ? (
                              // No SelectItem needed when disabled - placeholder will be shown
                              // The Select is already disabled when there are no available times
                              <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
                                {form.getValues('inspector') && form.getValues('date')
                                  ? "No available times"
                                  : "Select inspector and date"}
                              </div>
                            ) : (
                              // Show only available times for the selected date
                              // For Time Slots mode: shows specific time slots (excluding blocked ones)
                              // For Open Schedule mode: shows all times at 30-min intervals within blocks (excluding blocked times)
                              availableTimes.map((timeOption) => (
                                <SelectItem
                                  key={timeOption}
                                  value={timeOption}
                                  className={cn(
                                    field.value === timeOption && "bg-[#8230c9] text-white font-medium aria-selected:bg-[#8230c9] aria-selected:text-white"
                                  )}
                                >
                                  {formatTimeLabel(timeOption)}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      );
                    }}
                  />
                </div>
              </div>
              <div></div>
            </div>
          </div>

          <Accordion type="single" collapsible defaultValue="location" className="border-t pt-4">
            <AccordionItem value="location" className="border-none">
              <AccordionTrigger className="text-lg font-semibold py-2">
                Location
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="address">
                    Address <span className="text-destructive">*</span>
                  </Label>
                  <Controller
                    name="location.address"
                    control={form.control}
                    render={({ field }) => {
                      const handleSelect = async (placeId: string, description: string) => {
                        try {
                          // Fetch address details using place_id
                          const response = await fetch(
                            `/api/addresses/details?placeId=${encodeURIComponent(placeId)}`,
                            { credentials: 'include' }
                          );

                          if (!response.ok) {
                            console.error('Failed to fetch address details');
                            return;
                          }

                          const data = await response.json();
                          // Use streetAddress instead of formattedAddress
                          const streetAddress = data.streetAddress || description.split(',')[0].trim();
                          
                          // Update the address field with just the street address
                          field.onChange(streetAddress);
                          
                          // Update all other location fields
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

                      return (
                        <AddressAutocomplete
                          id="address"
                          value={field.value || ''}
                          onChange={field.onChange}
                          onSelect={handleSelect}
                          placeholder="Type to search addresses..."
                        />
                      );
                    }}
                  />
                  {form.formState.errors.location?.address && (
                    <p className="text-sm text-destructive">{form.formState.errors.location.address.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      {...form.register('location.unit')}
                      placeholder="Unit number..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      {...form.register('location.city')}
                      placeholder="City..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      {...form.register('location.state')}
                      placeholder="State..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">Zip</Label>
                    <Input
                      id="zip"
                      {...form.register('location.zip')}
                      placeholder="Zip code..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="county">County</Label>
                    <Input
                      id="county"
                      {...form.register('location.county')}
                      placeholder="County..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="foundation">Foundation</Label>
                    <Controller
                      name="location.foundation"
                      control={form.control}
                      render={({ field }) => (
                    <ReactSelect
                          value={field.value ? { value: field.value, label: field.value } : null}
                          onChange={(option) => field.onChange(option?.value || undefined)}
                      options={foundationOptions}
                      isClearable
                      placeholder="Select foundation type..."
                      isLoading={loadingFormData}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                      menuPosition="fixed"
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="squareFeet">Square Feet</Label>
                    <Input
                      id="squareFeet"
                      type="number"
                      min="0"
                      {...form.register('location.squareFeet')}
                      placeholder="Square feet..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="yearBuild">Year Built</Label>
                    <Input
                      id="yearBuild"
                      type="number"
                      max={new Date().getFullYear()}
                      {...form.register('location.yearBuild')}
                      placeholder="Year..."
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Accordion type="single" collapsible defaultValue="client" className="border-t pt-4">
            <AccordionItem value="client" className="border-none">
              <AccordionTrigger className="text-lg font-semibold py-2">
                Client
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {form.watch('clients').map((client, index) => {
                  const loadClientOptions = async (inputValue: string) => {
                    if (!inputValue || inputValue.length < 2) {
                      return [];
                    }

                    try {
                      const response = await fetch(
                        `/api/clients?search=${encodeURIComponent(inputValue)}&limit=20`,
                        { credentials: 'include' }
                      );

                      if (!response.ok) {
                        return [];
                      }

                      const data = await response.json();
                      const clientsList = data.clients || [];

                      return clientsList.map((c: any) => {
                        const displayName = c.isCompany
                          ? c.companyName || 'Unnamed Company'
                          : `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unnamed Client';
                        
                        return {
                          value: c._id,
                          label: displayName,
                          client: c,
                        };
                      });
                    } catch (error) {
                      console.error('Error loading clients:', error);
                      return [];
                    }
                  };

                  const handleClientSelect = (selectedOption: any) => {
                    if (!selectedOption || !selectedOption.client) return;

                    const selectedClient = selectedOption.client;
                    const currentClients = form.getValues('clients');
                    const newClients = [...currentClients];
                    
                    newClients[index] = {
                      isCompany: selectedClient.isCompany || false,
                      firstName: selectedClient.firstName || '',
                      lastName: selectedClient.lastName || '',
                      companyName: selectedClient.companyName || '',
                      email: selectedClient.email || '',
                      ccEmail: selectedClient.ccEmail || '',
                      phone: selectedClient.phone || '',
                      categories: (selectedClient.categories || []).map((category: any) => 
                        typeof category === 'string' ? category : category.name || category
                      ),
                      notes: selectedClient.internalNotes || '',
                      privateNotes: selectedClient.internalAdminNotes || '',
                    };

                    form.setValue('clients', newClients);
                  };

                  return (
                    <div key={index} className="space-y-4 p-4 border rounded-lg">
                      {form.watch('clients').length > 1 && (
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Client {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const currentClients = form.getValues('clients');
                              form.setValue('clients', currentClients.filter((_, i) => i !== index));
                            }}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>Search Existing Client</Label>
                        <AsyncSelect
                          loadOptions={loadClientOptions}
                          onChange={handleClientSelect}
                          placeholder="Type to search for existing client..."
                          isClearable
                          noOptionsMessage={({ inputValue }) =>
                            inputValue.length < 2
                              ? 'Type at least 2 characters to search'
                              : 'No clients found'
                          }
                          className="react-select-container"
                          classNamePrefix="react-select"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id={`isCompany-${index}`}
                          checked={client.isCompany}
                          onCheckedChange={(checked) => {
                            const currentClients = form.getValues('clients');
                            const newClients = [...currentClients];
                            newClients[index].isCompany = checked === true;
                            if (checked) {
                              newClients[index].firstName = '';
                              newClients[index].lastName = '';
                            } else {
                              newClients[index].companyName = '';
                            }
                            form.setValue('clients', newClients);
                          }}
                        />
                        <Label
                          htmlFor={`isCompany-${index}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          Client is a Company/Organization
                        </Label>
                      </div>

                    {client.isCompany ? (
                      <div className="space-y-2">
                        <Label htmlFor={`companyName-${index}`}>Company Name</Label>
                        <Input
                          id={`companyName-${index}`}
                          value={client.companyName || ''}
                          onChange={(e) => {
                            const currentClients = form.getValues('clients');
                            const newClients = [...currentClients];
                            newClients[index].companyName = e.target.value;
                            form.setValue('clients', newClients);
                          }}
                          placeholder="Company name..."
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`firstName-${index}`}>First Name</Label>
                          <Input
                            id={`firstName-${index}`}
                            value={client.firstName || ''}
                            onChange={(e) => {
                              const currentClients = form.getValues('clients');
                              const newClients = [...currentClients];
                              newClients[index].firstName = e.target.value;
                              form.setValue('clients', newClients);
                            }}
                            placeholder="First name..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`lastName-${index}`}>Last Name</Label>
                          <Input
                            id={`lastName-${index}`}
                            value={client.lastName || ''}
                            onChange={(e) => {
                              const currentClients = form.getValues('clients');
                              const newClients = [...currentClients];
                              newClients[index].lastName = e.target.value;
                              form.setValue('clients', newClients);
                            }}
                            placeholder="Last name..."
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`email-${index}`}>Email</Label>
                        <Input
                          id={`email-${index}`}
                          type="email"
                          value={client.email || ''}
                          onChange={(e) => {
                            const currentClients = form.getValues('clients');
                            const newClients = [...currentClients];
                            newClients[index].email = e.target.value;
                            form.setValue('clients', newClients);
                          }}
                          placeholder="Email..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`ccEmail-${index}`}>CC Email</Label>
                        <Input
                          id={`ccEmail-${index}`}
                          type="email"
                          value={client.ccEmail || ''}
                          onChange={(e) => {
                            const currentClients = form.getValues('clients');
                            const newClients = [...currentClients];
                            newClients[index].ccEmail = e.target.value;
                            form.setValue('clients', newClients);
                          }}
                          placeholder="CC email..."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`phone-${index}`}>Phone</Label>
                      <Input
                        id={`phone-${index}`}
                        type="tel"
                        value={client.phone || ''}
                        onChange={(e) => {
                          const currentClients = form.getValues('clients');
                          const newClients = [...currentClients];
                          newClients[index].phone = e.target.value;
                          form.setValue('clients', newClients);
                        }}
                        placeholder="Phone..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`categories-${index}`}>Categories</Label>
                      <CreatableSelect
                        isMulti
                        value={(client.categories || []).map(category => ({ value: category, label: category }))}
                        onChange={(selectedOptions) => {
                          const currentClients = form.getValues('clients');
                          const newClients = [...currentClients];
                          newClients[index].categories = selectedOptions.map(opt => opt.value);
                          form.setValue('clients', newClients);
                        }}
                        onCreateOption={(inputValue) => {
                          const currentClients = form.getValues('clients');
                          const newClients = [...currentClients];
                          if (!newClients[index].categories.includes(inputValue.trim())) {
                            newClients[index].categories.push(inputValue.trim());
                            form.setValue('clients', newClients);
                          }
                        }}
                        placeholder="Type and press Enter to add categories..."
                        className="react-select-container"
                        classNamePrefix="react-select"
                        formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`notes-${index}`}>Notes</Label>
                        <Textarea
                          id={`notes-${index}`}
                          value={client.notes || ''}
                          onChange={(e) => {
                            const currentClients = form.getValues('clients');
                            const newClients = [...currentClients];
                            newClients[index].notes = e.target.value;
                            form.setValue('clients', newClients);
                          }}
                          placeholder="Notes..."
                          rows={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`privateNotes-${index}`}>Private Notes</Label>
                        <Textarea
                          id={`privateNotes-${index}`}
                          value={client.privateNotes || ''}
                          onChange={(e) => {
                            const currentClients = form.getValues('clients');
                            const newClients = [...currentClients];
                            newClients[index].privateNotes = e.target.value;
                            form.setValue('clients', newClients);
                          }}
                          placeholder="Private notes..."
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                  );
                })}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const currentClients = form.getValues('clients');
                    form.setValue('clients', [
                      ...currentClients,
                      {
                        isCompany: false,
                        firstName: '',
                        lastName: '',
                        companyName: '',
                        email: '',
                        ccEmail: '',
                        phone: '',
                        categories: [],
                        notes: '',
                        privateNotes: '',
                      },
                    ]);
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add More Client
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Accordion type="single" collapsible defaultValue="agent" className="border-t pt-4">
            <AccordionItem value="agent" className="border-none">
              <AccordionTrigger className="text-lg font-semibold py-2">
                Client's Agent
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {form.watch('agents').map((agent, index) => {
                  const loadAgentOptions = async (inputValue: string) => {
                    if (!inputValue || inputValue.length < 2) {
                      return [];
                    }

                    try {
                      const response = await fetch(
                        `/api/agents/search?search=${encodeURIComponent(inputValue)}&limit=20`,
                        { credentials: 'include' }
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
                    
                    // Extract agency ID and cache agency name if available
                    const agencyId = selectedAgent.agency?._id?.toString() || selectedAgent.agency || undefined;
                    if (agencyId && selectedAgent.agency?.name) {
                      // Cache the agency name for immediate display
                      setAgencyNames(prev => ({
                        ...prev,
                        [agencyId]: selectedAgent.agency.name,
                      }));
                    }
                    
                    newAgents[index] = {
                      firstName: selectedAgent.firstName || '',
                      lastName: selectedAgent.lastName || '',
                      email: selectedAgent.email || '',
                      ccEmail: selectedAgent.ccEmail || '',
                      phone: selectedAgent.phone || '',
                      agency: agencyId,
                      photoUrl: selectedAgent.photoUrl || undefined,
                      categories: (selectedAgent.categories || []).map((category: any) => 
                        typeof category === 'string' ? category : category.name || category
                      ) || [],
                      notes: selectedAgent.internalNotes || '',
                      privateNotes: selectedAgent.internalAdminNotes || '',
                    };

                    form.setValue('agents', newAgents);
                  };

                  return (
                    <div key={index} className="space-y-4 p-4 border rounded-lg">
                      {form.watch('agents').length > 1 && (
                        <div className="flex items-center justify-between">
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
                                categories: newAgents[index].categories || [],
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
                                categories: newAgents[index].categories || [],
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
                                categories: newAgents[index].categories || [],
                                email: e.target.value,
                              };
                              form.setValue('agents', newAgents);
                            }}
                            placeholder="Email..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`agentCCEmail-${index}`}>CC Email</Label>
                          <Input
                            id={`agentCCEmail-${index}`}
                            type="email"
                            value={agent.ccEmail || ''}
                            onChange={(e) => {
                              const currentAgents = form.getValues('agents');
                              const newAgents = [...currentAgents];
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: newAgents[index].categories || [],
                                ccEmail: e.target.value,
                              };
                              form.setValue('agents', newAgents);
                            }}
                            placeholder="CC email..."
                          />
                        </div>
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
                                categories: newAgents[index].categories || [],
                              phone: e.target.value,
                            };
                            form.setValue('agents', newAgents);
                          }}
                          placeholder="Phone..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Agency</Label>
                        <AsyncCreatableSelect
                          cacheOptions
                          value={(() => {
                            const agencyValue = agent.agency;
                            if (!agencyValue) return null;
                            
                            // If it's a valid ObjectId, it's an existing agency
                            if (isValidObjectId(String(agencyValue))) {
                              const cachedName = agencyNames[String(agencyValue)];
                              return { 
                                value: String(agencyValue), 
                                label: cachedName || 'Loading...' 
                              };
                            } else {
                              // It's a new agency name (string)
                              return { 
                                value: String(agencyValue), 
                                label: String(agencyValue) 
                              };
                            }
                          })()}
                          onChange={async (option: any, actionMeta: any) => {
                            const currentAgents = form.getValues('agents');
                            const newAgents = [...currentAgents];
                            
                            if (actionMeta.action === 'create-option') {
                              // Store the new agency name as a string (will be created on form submit)
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: newAgents[index].categories || [],
                                agency: option.value.trim(), // Store as string name, not ID
                              };
                              form.setValue('agents', newAgents);
                            } else if (actionMeta.action === 'select-option') {
                              // Select existing agency (store as ID)
                              // Cache the agency name
                              if (option?.label) {
                                setAgencyNames(prev => ({
                                  ...prev,
                                  [option.value]: option.label,
                                }));
                              }
                              
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: newAgents[index].categories || [],
                                agency: option?.value || undefined,
                              };
                              form.setValue('agents', newAgents);
                            } else if (actionMeta.action === 'clear') {
                              // Clear selection
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: newAgents[index].categories || [],
                                agency: undefined,
                              };
                              form.setValue('agents', newAgents);
                            }
                          }}
                          loadOptions={async (inputValue: string) => {
                            try {
                              const search = inputValue || '';
                              const response = await fetch(
                                `/api/agencies/search?search=${encodeURIComponent(search)}&limit=20`,
                                { credentials: 'include' }
                              );

                              if (!response.ok) {
                                return [];
                              }

                              const data = await response.json();
                              const agenciesList = data.agencies || [];

                              const options = agenciesList.map((a: any) => {
                                const agencyId = a._id || a.id;
                                const agencyName = a.name;
                                
                                // Cache agency names
                                setAgencyNames(prev => ({
                                  ...prev,
                                  [agencyId]: agencyName,
                                }));
                                
                                return {
                                  value: agencyId,
                                  label: agencyName,
                                };
                              });

                              return options;
                            } catch (error) {
                              console.error('Error loading agencies:', error);
                              return [];
                            }
                          }}
                          defaultOptions
                          isClearable
                          placeholder="Search or create agency by name..."
                          noOptionsMessage={({ inputValue }) =>
                            inputValue
                              ? `No agencies found. Press Enter to create "${inputValue}"`
                              : 'Type to search agencies...'
                          }
                          className="react-select-container"
                          classNamePrefix="react-select"
                          formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Photo</Label>
                        <ImageUpload
                          value={agent.photoUrl || null}
                          onChange={(url) => {
                            const currentAgents = form.getValues('agents');
                            const newAgents = [...currentAgents];
                            newAgents[index] = {
                              ...newAgents[index],
                                categories: newAgents[index].categories || [],
                              photoUrl: url || undefined,
                            };
                            form.setValue('agents', newAgents);
                          }}
                          shape="rounded"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`agentCategories-${index}`}>Categories</Label>
                        <CreatableSelect
                          isMulti
                          value={(agent.categories || []).map(category => ({ value: category, label: category }))}
                          onChange={(selectedOptions) => {
                            const currentAgents = form.getValues('agents');
                            const newAgents = [...currentAgents];
                            newAgents[index] = {
                              ...newAgents[index],
                              categories: selectedOptions.map(opt => opt.value),
                            };
                            form.setValue('agents', newAgents);
                          }}
                          onCreateOption={(inputValue) => {
                            const currentAgents = form.getValues('agents');
                            const newAgents = [...currentAgents];
                            const currentCategories = newAgents[index].categories || [];
                            if (!currentCategories.includes(inputValue.trim())) {
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: [...currentCategories, inputValue.trim()],
                              };
                              form.setValue('agents', newAgents);
                            }
                          }}
                          placeholder="Type and press Enter to add categories..."
                          className="react-select-container"
                          classNamePrefix="react-select"
                          formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`agentNotes-${index}`}>Notes</Label>
                          <Textarea
                            id={`agentNotes-${index}`}
                            value={agent.notes || ''}
                            onChange={(e) => {
                              const currentAgents = form.getValues('agents');
                              const newAgents = [...currentAgents];
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: newAgents[index].categories || [],
                                notes: e.target.value,
                              };
                              form.setValue('agents', newAgents);
                            }}
                            placeholder="Notes..."
                            rows={3}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`agentPrivateNotes-${index}`}>Private Notes</Label>
                          <Textarea
                            id={`agentPrivateNotes-${index}`}
                            value={agent.privateNotes || ''}
                            onChange={(e) => {
                              const currentAgents = form.getValues('agents');
                              const newAgents = [...currentAgents];
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: newAgents[index].categories || [],
                                privateNotes: e.target.value,
                              };
                              form.setValue('agents', newAgents);
                            }}
                            placeholder="Private notes..."
                            rows={3}
                          />
                        </div>
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
                        ccEmail: '',
                        phone: '',
                        agency: undefined,
                        photoUrl: undefined,
                        categories: [],
                        notes: '',
                        privateNotes: '',
                      },
                    ]);
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add More Client Agent
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Accordion type="single" collapsible defaultValue="listingAgent" className="border-t pt-4">
            <AccordionItem value="listingAgent" className="border-none">
              <AccordionTrigger className="text-lg font-semibold py-2">
                Listing Agent
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {form.watch('listingAgents').map((agent, index) => {
                  const loadAgentOptions = async (inputValue: string) => {
                    if (!inputValue || inputValue.length < 2) {
                      return [];
                    }

                    try {
                      const response = await fetch(
                        `/api/agents/search?search=${encodeURIComponent(inputValue)}&limit=20`,
                        { credentials: 'include' }
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
                    
                    // Extract agency ID and cache agency name if available
                    const agencyId = selectedAgent.agency?._id?.toString() || selectedAgent.agency || undefined;
                    if (agencyId && selectedAgent.agency?.name) {
                      // Cache the agency name for immediate display
                      setListingAgencyNames(prev => ({
                        ...prev,
                        [agencyId]: selectedAgent.agency.name,
                      }));
                    }
                    
                    newAgents[index] = {
                      firstName: selectedAgent.firstName || '',
                      lastName: selectedAgent.lastName || '',
                      email: selectedAgent.email || '',
                      ccEmail: selectedAgent.ccEmail || '',
                      phone: selectedAgent.phone || '',
                      agency: agencyId,
                      photoUrl: selectedAgent.photoUrl || undefined,
                      categories: (selectedAgent.categories || []).map((category: any) => 
                        typeof category === 'string' ? category : category.name || category
                      ) || [],
                      notes: selectedAgent.internalNotes || '',
                      privateNotes: selectedAgent.internalAdminNotes || '',
                    };

                    form.setValue('listingAgents', newAgents);
                  };

                  return (
                    <div key={index} className="space-y-4 p-4 border rounded-lg">
                      {form.watch('listingAgents').length > 1 && (
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Agent {index + 1}</h4>
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
                                categories: newAgents[index].categories || [],
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
                                categories: newAgents[index].categories || [],
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
                                categories: newAgents[index].categories || [],
                                email: e.target.value,
                              };
                              form.setValue('listingAgents', newAgents);
                            }}
                            placeholder="Email..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`listingAgentCCEmail-${index}`}>CC Email</Label>
                          <Input
                            id={`listingAgentCCEmail-${index}`}
                            type="email"
                            value={agent.ccEmail || ''}
                            onChange={(e) => {
                              const currentAgents = form.getValues('listingAgents');
                              const newAgents = [...currentAgents];
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: newAgents[index].categories || [],
                                ccEmail: e.target.value,
                              };
                              form.setValue('listingAgents', newAgents);
                            }}
                            placeholder="CC email..."
                          />
                        </div>
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
                                categories: newAgents[index].categories || [],
                              phone: e.target.value,
                            };
                            form.setValue('listingAgents', newAgents);
                          }}
                          placeholder="Phone..."
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Agency</Label>
                        <AsyncCreatableSelect
                          cacheOptions
                          value={(() => {
                            const agencyValue = agent.agency;
                            if (!agencyValue) return null;
                            
                            // If it's a valid ObjectId, it's an existing agency
                            if (isValidObjectId(String(agencyValue))) {
                              const cachedName = listingAgencyNames[String(agencyValue)];
                              return { 
                                value: String(agencyValue), 
                                label: cachedName || 'Loading...' 
                              };
                            } else {
                              // It's a new agency name (string)
                              return { 
                                value: String(agencyValue), 
                                label: String(agencyValue) 
                              };
                            }
                          })()}
                          onChange={async (option: any, actionMeta: any) => {
                            const currentAgents = form.getValues('listingAgents');
                            const newAgents = [...currentAgents];
                            
                            if (actionMeta.action === 'create-option') {
                              // Store the new agency name as a string (will be created on form submit)
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: newAgents[index].categories || [],
                                agency: option.value.trim(), // Store as string name, not ID
                              };
                              form.setValue('listingAgents', newAgents);
                            } else if (actionMeta.action === 'select-option') {
                              // Select existing agency (store as ID)
                              // Cache the agency name
                              if (option?.label) {
                                setListingAgencyNames(prev => ({
                                  ...prev,
                                  [option.value]: option.label,
                                }));
                              }
                              
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: newAgents[index].categories || [],
                                agency: option?.value || undefined,
                              };
                              form.setValue('listingAgents', newAgents);
                            } else if (actionMeta.action === 'clear') {
                              // Clear selection
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: newAgents[index].categories || [],
                                agency: undefined,
                              };
                              form.setValue('listingAgents', newAgents);
                            }
                          }}
                          loadOptions={async (inputValue: string) => {
                            try {
                              const search = inputValue || '';
                              const response = await fetch(
                                `/api/agencies/search?search=${encodeURIComponent(search)}&limit=20`,
                                { credentials: 'include' }
                              );

                              if (!response.ok) {
                                return [];
                              }

                              const data = await response.json();
                              const agenciesList = data.agencies || [];

                              const options = agenciesList.map((a: any) => {
                                const agencyId = a._id || a.id;
                                const agencyName = a.name;
                                
                                // Cache agency names
                                setListingAgencyNames(prev => ({
                                  ...prev,
                                  [agencyId]: agencyName,
                                }));
                                
                                return {
                                  value: agencyId,
                                  label: agencyName,
                                };
                              });

                              return options;
                            } catch (error) {
                              console.error('Error loading agencies:', error);
                              return [];
                            }
                          }}
                          defaultOptions
                          isClearable
                          placeholder="Search or create agency by name..."
                          noOptionsMessage={({ inputValue }) =>
                            inputValue
                              ? `No agencies found. Press Enter to create "${inputValue}"`
                              : 'Type to search agencies...'
                          }
                          className="react-select-container"
                          classNamePrefix="react-select"
                          formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Photo</Label>
                        <ImageUpload
                          value={agent.photoUrl || null}
                          onChange={(url) => {
                            const currentAgents = form.getValues('listingAgents');
                            const newAgents = [...currentAgents];
                            newAgents[index] = {
                              ...newAgents[index],
                                categories: newAgents[index].categories || [],
                              photoUrl: url || undefined,
                            };
                            form.setValue('listingAgents', newAgents);
                          }}
                          shape="rounded"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`listingAgentCategories-${index}`}>Categories</Label>
                        <CreatableSelect
                          isMulti
                          value={(agent.categories || []).map(category => ({ value: category, label: category }))}
                          onChange={(selectedOptions) => {
                            const currentAgents = form.getValues('listingAgents');
                            const newAgents = [...currentAgents];
                            newAgents[index] = {
                              ...newAgents[index],
                              categories: selectedOptions.map(opt => opt.value),
                            };
                            form.setValue('listingAgents', newAgents);
                          }}
                          onCreateOption={(inputValue) => {
                            const currentAgents = form.getValues('listingAgents');
                            const newAgents = [...currentAgents];
                            const currentCategories = newAgents[index].categories || [];
                            if (!currentCategories.includes(inputValue.trim())) {
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: [...currentCategories, inputValue.trim()],
                              };
                              form.setValue('listingAgents', newAgents);
                            }
                          }}
                          placeholder="Type and press Enter to add categories..."
                          className="react-select-container"
                          classNamePrefix="react-select"
                          formatCreateLabel={(inputValue) => `Create "${inputValue}"`}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`listingAgentNotes-${index}`}>Notes</Label>
                          <Textarea
                            id={`listingAgentNotes-${index}`}
                            value={agent.notes || ''}
                            onChange={(e) => {
                              const currentAgents = form.getValues('listingAgents');
                              const newAgents = [...currentAgents];
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: newAgents[index].categories || [],
                                notes: e.target.value,
                              };
                              form.setValue('listingAgents', newAgents);
                            }}
                            placeholder="Notes..."
                            rows={3}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`listingAgentPrivateNotes-${index}`}>Private Notes</Label>
                          <Textarea
                            id={`listingAgentPrivateNotes-${index}`}
                            value={agent.privateNotes || ''}
                            onChange={(e) => {
                              const currentAgents = form.getValues('listingAgents');
                              const newAgents = [...currentAgents];
                              newAgents[index] = {
                                ...newAgents[index],
                                categories: newAgents[index].categories || [],
                                privateNotes: e.target.value,
                              };
                              form.setValue('listingAgents', newAgents);
                            }}
                            placeholder="Private notes..."
                            rows={3}
                          />
                        </div>
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
                        ccEmail: '',
                        phone: '',
                        agency: undefined,
                        photoUrl: undefined,
                        categories: [],
                        notes: '',
                        privateNotes: '',
                      },
                    ]);
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add More Listing Agent
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold py-2">
              Services <span className="text-destructive">*</span>
            </h3>
            {selectedServices.length === 0 && (
              <p className="text-sm text-destructive mb-2">Please select at least one service</p>
            )}
            <div className="space-y-4 pt-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
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
                        isLoading={loadingFormData}
                        className="react-select-container"
                        classNamePrefix="react-select"
                      />
                    </div>

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
                              <Label>Add-ons</Label>
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
                                    return {
                                      name: addOn.name,
                                      addFee: addOn.baseCost || 0,
                                      addHours: addOn.baseDurationHours || 0,
                                    };
                                  });
                                  setSelectedServices(newSelectedServices);
                                }}
                                options={availableAddOns.map((addOn: any) => ({
                                  value: addOn.name,
                                  label: `${addOn.name} ($${addOn.baseCost || 0})`,
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

                    <div className="space-y-2">
                      <Label>Discount Code</Label>
                      <ReactSelect
                        value={selectedDiscountCode}
                        onChange={setSelectedDiscountCode}
                        options={discountCodes.map(code => ({
                          value: code._id,
                          label: `${code.code} (${code.type === 'percent' ? `${code.value}%` : `$${code.value}`})`,
                          discountCode: code,
                        }))}
                        isClearable
                        placeholder="Select a discount code..."
                        isLoading={loadingFormData}
                        className="react-select-container"
                        classNamePrefix="react-select"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-muted/50">
                      <h3 className="font-semibold text-lg mb-4">Receipt</h3>
                      
                      {selectedServices.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No services selected</p>
                      ) : (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Services</h4>
                            {selectedServices.map((selectedService, index) => {
                              const service = selectedService.service;
                              const discount = selectedDiscountCode?.discountCode;
                              const appliesToServices = discount?.appliesToServices || [];
                              const appliesToAddOns = discount?.appliesToAddOns || [];
                              
                              const serviceId = selectedService.serviceId;
                              const serviceIdString = typeof serviceId === 'string' ? serviceId : String(serviceId);
                              
                              // Check if service matches discount
                              const serviceMatches = discount && appliesToServices.length > 0 && appliesToServices.some((appliedServiceId: any) => {
                                const appliedIdString = typeof appliedServiceId === 'string' 
                                  ? appliedServiceId 
                                  : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
                                return appliedIdString === serviceIdString;
                              });
                              
                              return (
                                <div key={index} className="text-sm">
                                  <div className="flex justify-between">
                                    <span>
                                      {service.name}
                                      {serviceMatches && (
                                        <span className="ml-2 text-xs text-green-600">(Discounted)</span>
                                      )}
                                    </span>
                                    <span>${service.baseCost || 0}</span>
                                  </div>
                                  {selectedService.addOns.length > 0 && (
                                    <div className="ml-4 mt-1 space-y-1">
                                      {selectedService.addOns.map((addOn, addOnIndex) => {
                                        // Check if add-on matches discount
                                        const addOnMatches = discount && appliesToAddOns.length > 0 && appliesToAddOns.some((appliedAddOn: any) => {
                                          const appliedServiceId = appliedAddOn.service;
                                          const appliedServiceIdString = typeof appliedServiceId === 'string'
                                            ? appliedServiceId
                                            : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
                                          const appliedAddOnName = appliedAddOn.addOnName || appliedAddOn.addonName;
                                          
                                          return appliedServiceIdString === serviceIdString &&
                                            appliedAddOnName?.toLowerCase() === addOn.name.toLowerCase();
                                        });
                                        
                                        return (
                                          <div key={addOnIndex} className="flex justify-between text-xs text-muted-foreground">
                                            <span>
                                              + {addOn.name}
                                              {addOnMatches && (
                                                <span className="ml-2 text-green-600">(Discounted)</span>
                                              )}
                                            </span>
                                            <span>${addOn.addFee || 0}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {(() => {
                            const subtotal = selectedServices.reduce((sum, s) => {
                              const serviceCost = s.service.baseCost || 0;
                              const addOnsCost = s.addOns.reduce((addOnSum, addOn) => addOnSum + (addOn.addFee || 0), 0);
                              return sum + serviceCost + addOnsCost;
                            }, 0);
                            
                            let discountAmount = 0;
                            let discountLabel = '';
                            
                            if (selectedDiscountCode?.discountCode) {
                              const discount = selectedDiscountCode.discountCode;
                              const appliesToServices = discount.appliesToServices || [];
                              const appliesToAddOns = discount.appliesToAddOns || [];
                              
                              // Only apply discount if there are services or add-ons configured
                              if (appliesToServices.length > 0 || appliesToAddOns.length > 0) {
                                // Calculate discount for matching services
                                selectedServices.forEach((selectedService) => {
                                  const serviceId = selectedService.serviceId;
                                  const serviceIdString = typeof serviceId === 'string' ? serviceId : String(serviceId);
                                  
                                  // Check if this service matches
                                  const serviceMatches = appliesToServices.some((appliedServiceId: any) => {
                                    const appliedIdString = typeof appliedServiceId === 'string' 
                                      ? appliedServiceId 
                                      : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
                                    return appliedIdString === serviceIdString;
                                  });
                                  
                                  if (serviceMatches) {
                                    const serviceCost = selectedService.service.baseCost || 0;
                                    if (discount.type === 'percent') {
                                      discountAmount += serviceCost * (discount.value / 100);
                                    } else {
                                      // Amount type: apply full amount per matching service
                                      discountAmount += discount.value;
                                    }
                                  }
                                  
                                  // Calculate discount for matching add-ons
                                  selectedService.addOns.forEach((addOn) => {
                                    const addOnMatches = appliesToAddOns.some((appliedAddOn: any) => {
                                      const appliedServiceId = appliedAddOn.service;
                                      const appliedServiceIdString = typeof appliedServiceId === 'string'
                                        ? appliedServiceId
                                        : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
                                      const appliedAddOnName = appliedAddOn.addOnName || appliedAddOn.addonName;
                                      
                                      return appliedServiceIdString === serviceIdString &&
                                        appliedAddOnName?.toLowerCase() === addOn.name.toLowerCase();
                                    });
                                    
                                    if (addOnMatches) {
                                      const addOnFee = addOn.addFee || 0;
                                      if (discount.type === 'percent') {
                                        discountAmount += addOnFee * (discount.value / 100);
                                      } else {
                                        // Amount type: apply full amount per matching add-on
                                        discountAmount += discount.value;
                                      }
                                    }
                                  });
                                });
                                
                                // Build discount label
                                if (discount.type === 'percent') {
                                  discountLabel = `${discount.code} (${discount.value}%)`;
                                } else {
                                  discountLabel = `${discount.code} ($${discount.value})`;
                                }
                              }
                            }
                            
                            const total = Math.max(0, subtotal - discountAmount);
                            
                            return (
                              <>
                                <div className="border-t pt-2">
                                  <div className="flex justify-between text-sm">
                                    <span>Subtotal</span>
                                    <span>${subtotal.toFixed(2)}</span>
                                  </div>
                                </div>
                                
                                {selectedDiscountCode?.discountCode && discountAmount > 0 && (
                                  <div className="pt-2">
                                    <div className="flex justify-between text-sm text-green-600">
                                      <span>Discount: {discountLabel}</span>
                                      <span>-${discountAmount.toFixed(2)}</span>
                                    </div>
                                  </div>
                                )}
                                
                                <div className="border-t pt-2">
                                  <div className="flex justify-between font-semibold">
                                    <span>Total</span>
                                    <span>${total.toFixed(2)}</span>
                                  </div>
                                </div>
                              </>
                            );
                          })()}

                          <div className="border-t pt-2">
                            <div className="flex justify-between text-sm">
                              <span>Total Duration</span>
                              <span>
                                {(() => {
                                  const totalHours = selectedServices.reduce((sum, s) => {
                                    const serviceHours = s.service.baseDurationHours || 0;
                                    const addOnsHours = s.addOns.reduce((addOnSum, addOn) => addOnSum + (addOn.addHours || 0), 0);
                                    return sum + serviceHours + addOnsHours;
                                  }, 0);
                                  return `${totalHours} hrs`;
                                })()}
                              </span>
                            </div>
                          </div>

                          {(() => {
                            const allAgreementIds = new Set<string>();
                            selectedServices.forEach(s => {
                              const service = s.service;
                              if (service.agreementIds && Array.isArray(service.agreementIds)) {
                                service.agreementIds.forEach((id: string) => allAgreementIds.add(id.toString()));
                              }
                            });
                            
                            const uniqueAgreements = agreements.filter(a => allAgreementIds.has(a._id.toString()));
                            
                            if (uniqueAgreements.length > 0) {
                              return (
                                <div className="border-t pt-2">
                                  <h4 className="font-medium text-sm mb-2">Agreements</h4>
                                  <ul className="space-y-1">
                                    {uniqueAgreements.map((agreement) => (
                                      <li key={agreement._id} className="text-sm text-muted-foreground">
                                        • {agreement.name}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

          <div className="border-t pt-4">
            <EventsManager
              mode="create"
              inspectors={inspectors}
              defaultDate={(() => {
                const date = form.watch('date');
                const time = form.watch('time');
                if (date && time) {
                  const combined = new Date(date);
                  const [hours, minutes] = time.split(':').map(Number);
                  combined.setHours(hours, minutes, 0, 0);
                  return combined;
                }
                return date;
              })()}
              defaultInspector={(() => {
                const inspectorId = form.watch('inspector');
                if (inspectorId) {
                  return inspectors.find(i => i.value === inspectorId) || null;
                }
                return null;
              })()}
              events={events}
              onEventsChange={setEvents}
            />
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Payment</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Controller
                  name="requirePaymentToReleaseReports"
                  control={form.control}
                  render={({ field }) => (
                    <Checkbox
                      id="requirePaymentToReleaseReports"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  )}
                />
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="requirePaymentToReleaseReports"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Require payment to release reports(s)
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>If checked, reports will not be viewable by the client until they have completed payment online or you have manually marked the inspection as paid.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="paymentNotes">Payment Notes</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>This field can be used for internal notes regarding payment. It is private and only viewable by you.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Textarea
                  id="paymentNotes"
                  {...form.register('paymentNotes')}
                  placeholder="Enter payment notes..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4">Miscellaneous</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orderId">Order ID</Label>
                <Input
                  id="orderId"
                  value={form.watch('orderId') || 'Auto-generated'}
                  disabled
                  className="bg-muted"
                  placeholder="Will be auto-generated..."
                />
                <p className="text-sm text-muted-foreground">
                  Order ID will be automatically generated when you create the inspection.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="referralSource">Referral Source</Label>
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
                      isLoading={loadingFormData}
                      className="react-select-container"
                      classNamePrefix="react-select"
                      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                      menuPosition="fixed"
                    />
                  )}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Controller
                  name="confirmedInspection"
                  control={form.control}
                  render={({ field }) => (
                    <Checkbox
                      id="confirmedInspection"
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked === true);
                        // If unchecked, automatically set disableAutomatedNotifications to true
                        if (checked === false) {
                          form.setValue('disableAutomatedNotifications', true);
                        }
                      }}
                    />
                  )}
                />
                <Label
                  htmlFor="confirmedInspection"
                  className="text-sm font-normal cursor-pointer"
                >
                  Confirmed Inspection
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Controller
                  name="disableAutomatedNotifications"
                  control={form.control}
                  render={({ field }) => {
                    const confirmedInspection = form.watch('confirmedInspection');
                    return (
                      <Checkbox
                        id="disableAutomatedNotifications"
                        checked={field.value}
                        disabled={!confirmedInspection}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                      />
                    );
                  }}
                />
                <Label
                  htmlFor="disableAutomatedNotifications"
                  className={cn(
                    "text-sm font-normal",
                    form.watch('confirmedInspection') ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                  )}
                >
                  Disable Automated Notifications
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internalNotes">Internal Notes</Label>
                <Textarea
                  id="internalNotes"
                  {...form.register('internalNotes')}
                  placeholder="Enter internal notes..."
                  rows={3}
                />
              </div>

              <CustomFields 
                control={form.control} 
                customData={form.watch('customData')}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => router.push('/inspections')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !form.formState.isValid || selectedServices.length === 0}
            >
              {isSubmitting ? 'Creating...' : 'Create Inspection'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

