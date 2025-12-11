"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { 
  replaceAgreementPlaceholders, 
  detectTextInputPlaceholders,
} from "@/src/utils/agreement-placeholders";
import React from "react";

interface InspectionData {
  id: string;
  date: string | null;
  location: {
    address: string | null;
    city: string | null;
    state: string | null;
    unit: string | null;
  };
}

interface AvailableAddon {
  serviceId: string;
  serviceName: string;
  addonName: string;
  description: string;
  baseCost: number;
  baseDurationHours: number;
}

interface Agreement {
  _id: string;
  agreementId: string;
  name: string;
  content: string;
  isSigned: boolean;
  inputData?: Record<string, string>;
}

interface InspectionDataForPlaceholders {
  address: string;
  county: string;
  price: number;
  fees: string;
  services: string;
  currentDate: string;
  currentYear: string;
  clientName: string;
  inspectionDate: string;
  inspectionTime: string;
  companyWebsite: string;
  inspectorSignature?: string;
}

export default function InspectionClientViewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const inspectionId = params.id as string;
  const token = searchParams.get("token");

  const [inspection, setInspection] = useState<InspectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableAddons, setAvailableAddons] = useState<AvailableAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingAddons, setLoadingAddons] = useState(false);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [inspectionDataForPlaceholders, setInspectionDataForPlaceholders] = useState<InspectionDataForPlaceholders | null>(null);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  const [showAgreementModal, setShowAgreementModal] = useState(false);
  const [showViewAgreementsModal, setShowViewAgreementsModal] = useState(false);
  const [currentAgreementIndex, setCurrentAgreementIndex] = useState(0);
  const [selectedAgreementsToSign, setSelectedAgreementsToSign] = useState<Set<string>>(new Set());
  const [signingAgreements, setSigningAgreements] = useState(false);
  const [agreementInputValues, setAgreementInputValues] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    const fetchInspectionData = async () => {
      if (!inspectionId || !token) {
        setError("Missing inspection ID or access token");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/inspections/${inspectionId}/client-view?token=${encodeURIComponent(token)}`
        );

        if (!response.ok) {
          if (response.status === 401) {
            setError("Invalid access token");
          } else if (response.status === 404) {
            setError("Inspection not found");
          } else {
            setError("Failed to load inspection details");
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setInspection(data);
      } catch (err) {
        console.error("Error fetching inspection:", err);
        setError("An error occurred while loading inspection details");
      } finally {
        setLoading(false);
      }
    };

    fetchInspectionData();
  }, [inspectionId, token]);

  // Fetch available addons
  useEffect(() => {
    const fetchAvailableAddons = async () => {
      if (!inspectionId || !token) {
        return;
      }

      setLoadingAddons(true);
      try {
        const response = await fetch(
          `/api/inspections/${inspectionId}/client-view/available-addons?token=${encodeURIComponent(token)}`
        );

        if (response.ok) {
          const data = await response.json();
          setAvailableAddons(data.addons || []);
        }
      } catch (err) {
        console.error("Error fetching available addons:", err);
      } finally {
        setLoadingAddons(false);
      }
    };

    fetchAvailableAddons();
  }, [inspectionId, token]);

  // Fetch agreements
  useEffect(() => {
    const fetchAgreements = async () => {
      if (!inspectionId || !token) {
        return;
      }

      setLoadingAgreements(true);
      try {
        const response = await fetch(
          `/api/inspections/${inspectionId}/client-view/agreements?token=${encodeURIComponent(token)}`
        );

        if (response.ok) {
          const data = await response.json();
          setAgreements(data.agreements || []);
          setInspectionDataForPlaceholders(data.inspectionData || null);
        }
      } catch (err) {
        console.error("Error fetching agreements:", err);
      } finally {
        setLoadingAgreements(false);
      }
    };

    fetchAgreements();
  }, [inspectionId, token]);

  // Handle addon selection toggle
  const toggleAddonSelection = (serviceId: string, addonName: string) => {
    const key = `${serviceId}_${addonName}`;
    const newSelected = new Set(selectedAddons);
    
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    
    setSelectedAddons(newSelected);
  };

  // Submit addon requests
  const handleSubmitAddonRequests = async () => {
    if (selectedAddons.size === 0) {
      return;
    }

    setSubmitting(true);
    try {
      const addonRequests = Array.from(selectedAddons).map((key) => {
        const [serviceId, addonName] = key.split('_');
        return { serviceId, addonName };
      });

      const response = await fetch(
        `/api/inspections/${inspectionId}/client-view/request-addons?token=${encodeURIComponent(token || '')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ addonRequests }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit addon requests');
      }

      toast.success('Additional services requested successfully!');
      
      // Clear selections and close modal (keep addons visible for future requests)
      setSelectedAddons(new Set());
      setShowAddonModal(false);
    } catch (err: any) {
      console.error("Error submitting addon requests:", err);
      toast.error(err.message || 'Failed to submit addon requests');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate total cost of selected addons
  const calculateTotalCost = () => {
    let total = 0;
    selectedAddons.forEach((key) => {
      const [serviceId, addonName] = key.split('_');
      const addon = availableAddons.find(
        (a) => a.serviceId === serviceId && a.addonName === addonName
      );
      if (addon) {
        total += addon.baseCost;
      }
    });
    return total;
  };

  // Group addons by service
  const groupedAddons = availableAddons.reduce((acc, addon) => {
    if (!acc[addon.serviceName]) {
      acc[addon.serviceName] = [];
    }
    acc[addon.serviceName].push(addon);
    return acc;
  }, {} as Record<string, AvailableAddon[]>);

  // Calculate agreement counts
  const totalAgreements = agreements.length;
  const unsignedAgreements = agreements.filter(a => !a.isSigned).length;

  // Validate required fields for a specific agreement
  const validateAgreementRequiredFields = (agreementId: string): { isValid: boolean; missingFields: string[] } => {
    const agreement = agreements.find(a => a.agreementId === agreementId);
    if (!agreement) {
      return { isValid: true, missingFields: [] };
    }

    const inputValues = collectInputValues(agreementId);
    const requiredPlaceholders = detectTextInputPlaceholders(agreement.content)
      .filter(p => p.includes('REQUIRED'));
    
    const missingFields: string[] = [];
    for (const placeholder of requiredPlaceholders) {
      if (!inputValues[placeholder] || inputValues[placeholder].trim() === '') {
        // Format placeholder name for display
        const fieldName = placeholder
          .replace(/[\[\]]/g, '')
          .replace(/_/g, ' ')
          .toLowerCase()
          .replace(/\b\w/g, l => l.toUpperCase());
        missingFields.push(fieldName);
      }
    }

    return {
      isValid: missingFields.length === 0,
      missingFields,
    };
  };

  // Handle agreement selection toggle
  const toggleAgreementSelection = (agreementId: string) => {
    const newSelected = new Set(selectedAgreementsToSign);
    
    // If trying to check the agreement, validate required fields first
    if (!newSelected.has(agreementId)) {
      const validation = validateAgreementRequiredFields(agreementId);
      if (!validation.isValid) {
        const agreement = agreements.find(a => a.agreementId === agreementId);
        const agreementName = agreement?.name || 'this agreement';
        
        if (validation.missingFields.length === 1) {
          toast.error(`Please fill in the required field "${validation.missingFields[0]}" in "${agreementName}" before signing`);
        } else {
          const fieldsList = validation.missingFields.map(f => `"${f}"`).join(', ');
          toast.error(`Please fill in all required fields (${fieldsList}) in "${agreementName}" before signing`);
        }
        return; // Don't check the checkbox if validation fails
      }
    }
    
    if (newSelected.has(agreementId)) {
      newSelected.delete(agreementId);
    } else {
      newSelected.add(agreementId);
    }
    setSelectedAgreementsToSign(newSelected);
  };

  // Get current unsigned agreement
  const getCurrentUnsignedAgreement = () => {
    const unsigned = agreements.filter(a => !a.isSigned);
    return unsigned[currentAgreementIndex] || null;
  };

  // Get progress info
  const getAgreementProgress = () => {
    const unsigned = agreements.filter(a => !a.isSigned);
    const signed = agreements.filter(a => a.isSigned);
    return {
      current: currentAgreementIndex + 1,
      total: unsigned.length,
      signed: signed.length,
      totalAgreements: agreements.length,
    };
  };

  // Render agreement content with React components for text inputs
  const renderAgreementContent = (
    content: string,
    agreementId: string,
    inputData: Record<string, string> = {},
    isReadOnly: boolean = false
  ) => {
    // First replace regular placeholders
    let processedContent = inspectionDataForPlaceholders
      ? replaceAgreementPlaceholders(content, inspectionDataForPlaceholders)
      : content;

    // Split content by text input placeholders
    const TEXT_INPUT_PLACEHOLDERS = [
      '[CUSTOMER_INITIALS]',
      '[REQUIRED_CUSTOMER_INITIALS]',
    ];

    const parts: Array<{ type: 'html' | 'input'; content?: string; placeholder?: string; value?: string; required?: boolean }> = [];
    let remaining = processedContent;
    let lastIndex = 0;

    // Find all placeholder positions
    const placeholderPositions: Array<{ placeholder: string; index: number }> = [];
    TEXT_INPUT_PLACEHOLDERS.forEach(placeholder => {
      let index = remaining.indexOf(placeholder);
      while (index !== -1) {
        placeholderPositions.push({ placeholder, index: lastIndex + index });
        index = remaining.indexOf(placeholder, index + 1);
      }
    });

    // Sort by position
    placeholderPositions.sort((a, b) => a.index - b.index);

    // Build parts array
    let currentIndex = 0;
    placeholderPositions.forEach(({ placeholder, index }) => {
      // Add HTML before placeholder
      if (index > currentIndex) {
        parts.push({
          type: 'html',
          content: processedContent.substring(currentIndex, index),
        });
      }

      // Add input placeholder
      const isRequired = placeholder.includes('REQUIRED');
      parts.push({
        type: 'input',
        placeholder,
        value: inputData[placeholder] || '',
        required: isRequired,
      });

      currentIndex = index + placeholder.length;
    });

    // Add remaining HTML
    if (currentIndex < processedContent.length) {
      parts.push({
        type: 'html',
        content: processedContent.substring(currentIndex),
      });
    }

    // If no placeholders found, return the whole content as HTML
    if (parts.length === 0) {
      parts.push({
        type: 'html',
        content: processedContent,
      });
    }

    return (
      <div className="prose prose-sm max-w-none text-gray-700">
        {parts.map((part, idx) => {
          if (part.type === 'input') {
            if (isReadOnly) {
              return (
                <span
                  key={idx}
                  className="inline-block min-w-[100px] px-2 py-1 border-b border-gray-800 font-medium"
                >
                  {part.value || '\u00A0'}
                </span>
              );
            } else {
              return (
                <Input
                  key={idx}
                  type="text"
                  data-placeholder={part.placeholder}
                  data-agreement-id={agreementId}
                  className="agreement-text-input inline-block min-w-[100px] max-w-[200px] mx-1"
                  value={part.value}
                  required={part.required}
                  maxLength={50}
                  onChange={(e) => {
                    // Update local state for immediate feedback
                    setAgreementInputValues(prev => ({
                      ...prev,
                      [agreementId]: {
                        ...(prev[agreementId] || {}),
                        [part.placeholder!]: e.target.value,
                      },
                    }));
                  }}
                />
              );
            }
          } else {
            return (
              <span
                key={idx}
                dangerouslySetInnerHTML={{ __html: part.content || '' }}
              />
            );
          }
        })}
      </div>
    );
  };

  // Collect input values from the current agreement
  const collectInputValues = (agreementId: string): Record<string, string> => {
    // Use state values if available, otherwise fall back to DOM
    if (agreementInputValues[agreementId]) {
      return agreementInputValues[agreementId];
    }
    
    const inputs: Record<string, string> = {};
    // Use a more specific selector to find inputs within the agreement container
    const container = document.querySelector(`[data-agreement-id="${agreementId}"]`);
    if (container) {
      const inputElements = container.querySelectorAll('.agreement-text-input');
      
      inputElements.forEach((input) => {
        const htmlInput = input as HTMLInputElement;
        const placeholder = htmlInput.getAttribute('data-placeholder');
        if (placeholder) {
          inputs[placeholder] = htmlInput.value || '';
        }
      });
    }
    
    return inputs;
  };

  // Handle signing agreements
  const handleSignAgreements = async () => {
    if (selectedAgreementsToSign.size === 0) {
      return;
    }

    // Validate required fields for all selected agreements
    const agreementIds = Array.from(selectedAgreementsToSign);
    const missingFields: Array<{ agreementName: string; placeholder: string }> = [];

    for (const agreementId of agreementIds) {
      const agreement = agreements.find(a => a.agreementId === agreementId);
      if (!agreement) continue;

      const inputValues = collectInputValues(agreementId);
      const requiredPlaceholders = detectTextInputPlaceholders(agreement.content)
        .filter(p => p.includes('REQUIRED'));
      
      for (const placeholder of requiredPlaceholders) {
        if (!inputValues[placeholder] || inputValues[placeholder].trim() === '') {
          // Format placeholder name for display (remove brackets and make readable)
          const fieldName = placeholder
            .replace(/[\[\]]/g, '')
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, l => l.toUpperCase());
          
          missingFields.push({
            agreementName: agreement.name,
            placeholder: fieldName,
          });
        }
      }
    }

    // Show toast if any required fields are missing
    if (missingFields.length > 0) {
      if (missingFields.length === 1) {
        toast.error(`Please fill in the required field "${missingFields[0].placeholder}" in "${missingFields[0].agreementName}"`);
      } else {
        const fieldList = missingFields.map(f => `"${f.placeholder}" in "${f.agreementName}"`).join(', ');
        toast.error(`Please fill in all required fields: ${fieldList}`);
      }
      return;
    }

    setSigningAgreements(true);
    try {
      const agreementIds = Array.from(selectedAgreementsToSign);
      
      // Collect input values for each agreement
      const agreementInputData: Record<string, Record<string, string>> = {};
      agreementIds.forEach(agreementId => {
        agreementInputData[agreementId] = collectInputValues(agreementId);
      });
      
      const response = await fetch(
        `/api/inspections/${inspectionId}/client-view/sign-agreement?token=${encodeURIComponent(token || '')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            agreementIds,
            inputData: agreementInputData,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sign agreements');
      }

      toast.success('Agreement signed successfully!');
      
      // Update local state with input data
      const updatedAgreements = agreements.map(agreement => 
        selectedAgreementsToSign.has(agreement.agreementId)
          ? { 
              ...agreement, 
              isSigned: true,
              inputData: agreementInputData[agreement.agreementId] || {},
            }
          : agreement
      );
      setAgreements(updatedAgreements);
      
      // Clear selections and input values
      setSelectedAgreementsToSign(new Set());
      const newInputValues = { ...agreementInputValues };
      agreementIds.forEach(id => {
        delete newInputValues[id];
      });
      setAgreementInputValues(newInputValues);
      
      // Check if there are more unsigned agreements
      const remainingUnsigned = updatedAgreements.filter(a => !a.isSigned);
      if (remainingUnsigned.length > 0) {
        // Move to next unsigned agreement
        setCurrentAgreementIndex(0);
      } else {
        // All agreements signed, close modal
        setShowAgreementModal(false);
        setCurrentAgreementIndex(0);
      }
    } catch (err: any) {
      console.error("Error signing agreements:", err);
      toast.error(err.message || 'Failed to sign agreements');
    } finally {
      setSigningAgreements(false);
    }
  };

  // Get unsigned agreements for the modal
  const unsignedAgreementsList = agreements.filter(a => !a.isSigned);
  
  // Open agreement modal and reset to first unsigned agreement
  const openAgreementModal = () => {
    setCurrentAgreementIndex(0);
    setSelectedAgreementsToSign(new Set());
    setShowAgreementModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-600 border-t-transparent mb-4"></div>
          <p className="text-gray-600 text-lg">Loading inspection details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h1>
            <p className="text-gray-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!inspection) {
    return null;
  }

  // Format the address
  const formatAddress = () => {
    const parts = [];
    if (inspection.location.address) {
      if (inspection.location.unit) {
        parts.push(`${inspection.location.address}, ${inspection.location.unit}`);
      } else {
        parts.push(inspection.location.address);
      }
    }
    if (inspection.location.city) {
      parts.push(inspection.location.city);
    }
    if (inspection.location.state) {
      parts.push(inspection.location.state);
    }
    return parts.join(", ") || "Address not available";
  };

  // Format the date and time
  const formatDateTime = () => {
    if (!inspection.date) return "Date not set";
    
    try {
      const date = new Date(inspection.date);
      return format(date, "EEEE, MMMM d, yyyy 'at' h:mm a");
    } catch (err) {
      return "Invalid date";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-block p-3 rounded-full bg-purple-100 mb-4">
              <svg
                className="w-12 h-12 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Inspection Details
            </h1>
            <p className="text-gray-600">
              Your inspection has been scheduled
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
            {/* Purple Header Bar */}
            <div className="h-2 bg-gradient-to-r from-purple-600 to-blue-600"></div>
            
            <div className="p-8">
              {/* Location Section */}
              <div className="mb-8">
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                    <svg
                      className="w-5 h-5 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Location
                  </h2>
                </div>
                <p className="text-gray-700 text-lg ml-13 pl-2 mb-4">
                  {formatAddress()}
                </p>
                
                {/* Property Photo */}
                {inspection.location.address && (
                  <div className="mt-4 rounded-lg overflow-hidden border border-gray-200 shadow-md">
                    <img
                      src={`/api/inspections/${inspectionId}/client-view/map-image?token=${encodeURIComponent(token || '')}`}
                      alt="Property photo"
                      className="w-full h-auto"
                      onError={(e) => {
                        // Hide image if it fails to load
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Date/Time Section */}
              <div>
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                    <svg
                      className="w-5 h-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Scheduled Date & Time
                  </h2>
                </div>
                <p className="text-gray-700 text-lg ml-13 pl-2">
                  {formatDateTime()}
                </p>
              </div>

              {/* Agreements Section */}
              {!loadingAgreements && totalAgreements > 0 && (
                <div className="mt-8 pt-8 border-t">
                  <div className="flex items-center mb-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                      <svg
                        className="w-5 h-5 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      Agreements
                    </h2>
                  </div>
                  <div className="ml-13 pl-2 space-y-2">
                    <p className="text-gray-700">
                      Total Agreements: <span className="font-semibold">{totalAgreements}</span>
                    </p>
                    <p className="text-gray-700">
                      Unsigned Agreements: <span className="font-semibold text-orange-600">{unsignedAgreements}</span>
                    </p>
                    {unsignedAgreements > 0 ? (
                      <Button
                        onClick={openAgreementModal}
                        className="mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                      >
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                        Sign Agreements
                      </Button>
                    ) : totalAgreements > 0 && (
                      <Button
                        onClick={() => setShowViewAgreementsModal(true)}
                        className="mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"
                      >
                        <svg
                          className="w-5 h-5 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        View Agreements
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 text-center">
                Please keep this link secure. Anyone with access to this link can view your inspection details.
              </p>
            </div>
          </div>

          {/* Add Additional Service Button */}
          {!loadingAddons && availableAddons.length > 0 && (
            <div className="mt-8">
              <Button
                onClick={() => setShowAddonModal(true)}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-6 text-lg font-semibold rounded-lg shadow-lg transition-all duration-200"
              >
                <svg
                  className="w-6 h-6 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                Add Additional Services
              </Button>
            </div>
          )}

          {/* Additional Info */}
          <div className="mt-8 text-center">
            <p className="text-gray-600">
              If you have any questions about your inspection, please contact your inspector.
            </p>
          </div>
        </div>
      </div>

      {/* Addon Selection Modal */}
      <Dialog open={showAddonModal} onOpenChange={setShowAddonModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Request Additional Services
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Select the additional services you would like to add to your inspection.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {Object.entries(groupedAddons).map(([serviceName, addons]) => (
              <div key={serviceName} className="space-y-3">
                <h3 className="font-semibold text-lg text-gray-900 border-b pb-2">
                  {serviceName}
                </h3>
                <div className="space-y-3">
                  {addons.map((addon) => {
                    const key = `${addon.serviceId}_${addon.addonName}`;
                    const isSelected = selectedAddons.has(key);

                    return (
                      <div
                        key={key}
                        className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                        onClick={() => toggleAddonSelection(addon.serviceId, addon.addonName)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleAddonSelection(addon.serviceId, addon.addonName)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-medium text-gray-900">
                                {addon.addonName}
                              </h4>
                              {addon.description && (
                                <p className="text-sm text-gray-600 mt-1">
                                  {addon.description}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-semibold text-purple-600">
                                ${addon.baseCost.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <div className="flex-1 text-left">
              <p className="text-sm text-gray-600">
                {selectedAddons.size} service{selectedAddons.size !== 1 ? 's' : ''} selected
              </p>
              {selectedAddons.size > 0 && (
                <p className="text-lg font-semibold text-purple-600">
                  Total: ${calculateTotalCost().toFixed(2)}
                </p>
              )}
            </div>
            <div className="flex gap-2 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setShowAddonModal(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitAddonRequests}
                disabled={selectedAddons.size === 0 || submitting}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              >
                {submitting ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  'Request Selected Services'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agreement Signing Modal - One at a time */}
      <Dialog open={showAgreementModal} onOpenChange={(open) => {
        if (!open) {
          setShowAgreementModal(false);
          setCurrentAgreementIndex(0);
          setSelectedAgreementsToSign(new Set());
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Sign Agreement
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {(() => {
                const progress = getAgreementProgress();
                return `Agreement ${progress.current} of ${progress.total} - Please review and check the box to confirm you agree.`;
              })()}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {(() => {
              const currentAgreement = getCurrentUnsignedAgreement();
              if (!currentAgreement) {
                return (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No more agreements to sign.</p>
                  </div>
                );
              }

              const isSelected = selectedAgreementsToSign.has(currentAgreement.agreementId);
              const savedInputData = currentAgreement.inputData || {};
              
              // Merge saved data with current input values
              const currentInputData = {
                ...savedInputData,
                ...(agreementInputValues[currentAgreement.agreementId] || {}),
              };

              return (
                <div
                  data-agreement-id={currentAgreement.agreementId}
                  className={`p-6 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleAgreementSelection(currentAgreement.agreementId)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {currentAgreement.name}
                      </h3>
                      {renderAgreementContent(
                        currentAgreement.content,
                        currentAgreement.agreementId,
                        currentInputData,
                        false // isReadOnly = false for signing
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <div className="flex-1 text-left">
              <p className="text-sm text-gray-600">
                {(() => {
                  const progress = getAgreementProgress();
                  return `${progress.signed} of ${progress.totalAgreements} agreement${progress.totalAgreements !== 1 ? 's' : ''} signed`;
                })()}
              </p>
            </div>
            <div className="flex gap-2 sm:justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAgreementModal(false);
                  setCurrentAgreementIndex(0);
                  setSelectedAgreementsToSign(new Set());
                }}
                disabled={signingAgreements}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSignAgreements}
                disabled={selectedAgreementsToSign.size === 0 || signingAgreements}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {signingAgreements ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Signing...
                  </>
                ) : (
                  'Sign Agreement'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View All Agreements Modal - Read Only */}
      <Dialog open={showViewAgreementsModal} onOpenChange={setShowViewAgreementsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              All Agreements
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              View all signed agreements for this inspection.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {agreements.map((agreement) => {
              const savedInputData = agreement.inputData || {};

              return (
                <div
                  key={agreement._id}
                  className={`p-6 rounded-lg border-2 ${
                    agreement.isSigned
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-4">
                    <div className="mt-1">
                      {agreement.isSigned ? (
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {agreement.name}
                        </h3>
                        {agreement.isSigned && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            Signed
                          </span>
                        )}
                      </div>
                      {renderAgreementContent(
                        agreement.content,
                        agreement.agreementId,
                        savedInputData,
                        true // isReadOnly = true for viewing
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowViewAgreementsModal(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

