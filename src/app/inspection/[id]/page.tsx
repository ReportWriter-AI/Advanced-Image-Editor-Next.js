"use client";

import { useEffect, useState, useRef } from "react";
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
  getInputPlaceholders,
  getRequiredInputPlaceholders,
} from "@/src/utils/agreement-placeholders";
import React from "react";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import jsPDF from "jspdf";

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
  street: string;
  city: string;
  state: string;
  zip: string;
  county: string;
  yearBuilt?: number;
  foundation: string;
  squareFeet?: number;
  price: number;
  fees: string;
  services: string;
  currentDate: string;
  currentYear: string;
  clientName: string;
  clientFirstName: string;
  clientPhone: string;
  clientEmail: string;
  clientContactInfo: string;
  clientAddress: string;
  inspectionDate: string;
  inspectionTime: string;
  inspectionEndTime: string;
  inspectionTextLink: string;
  signAndPayLink: string;
  signLink: string;
  payLink: string;
  invoiceLink: string;
  viewReportOnClientPortalLink: string;
  reportPublishedTextLink: string;
  companyWebsite: string;
  inspectionCompany: string;
  inspectionCompanyPhone: string;
  companyAddress: string;
  companyCity: string;
  companyState: string;
  companyZip: string;
  companyPhone: string;
  inspectorSignature?: string;
  agentName: string;
  agentFirstName: string;
  agentContactInfo: string;
  agentPhone: string;
  agentEmail: string;
  agentAddress: string;
  agentFullAddress: string;
  agentCity: string;
  agentState: string;
  agentZip: string;
  listingAgentName: string;
  listingAgentFirstName: string;
  listingAgentContactInfo: string;
  listingAgentPhone: string;
  listingAgentEmail: string;
  listingAgentAddress: string;
  listingAgentFullAddress: string;
  listingAgentCity: string;
  listingAgentState: string;
  listingAgentZip: string;
  description: string;
  notes: string;
  paid: string;
  published: string;
  agreed: string;
  orderId: string;
  inspectorFirstName: string;
  inspectorName: string;
  inspectors: string;
  inspectorsFirstNames: string;
  inspectorPhone: string;
  inspectorEmail: string;
  inspectorCredentials: string;
  inspectorImage: string;
  inspectorDescription: string;
  inspectorNotes: string;
  inspectorInitials: string;
}

// Payment Form Component
function PaymentForm({ 
  clientSecret, 
  paymentIntentId,
  paymentTotal,
  remainingBalance,
  onSuccess,
  onCancel 
}: { 
  clientSecret: string | null;
  paymentIntentId: string | null;
  paymentTotal: number | null;
  remainingBalance: number;
  onSuccess: (stripe: any, elements: any) => Promise<void>;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    try {
      await onSuccess(stripe, elements);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
        >
          {isProcessing ? (
            <>
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
              Processing...
            </>
          ) : (
            `Pay $${remainingBalance > 0 ? remainingBalance.toFixed(2) : (paymentTotal !== null ? paymentTotal.toFixed(2) : '0.00')}`
          )}
        </Button>
      </div>
    </form>
  );
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
  
  // Payment state
  const [paymentTotal, setPaymentTotal] = useState<number | null>(null);
  const [paymentSubtotal, setPaymentSubtotal] = useState<number>(0);
  const [paymentDiscount, setPaymentDiscount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [remainingBalance, setRemainingBalance] = useState<number>(0);
  const [isPaid, setIsPaid] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const stripePromise = useRef(loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISH_KEY || "")).current;

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

  // Fetch payment info
  useEffect(() => {
    const fetchPaymentInfo = async () => {
      if (!inspectionId || !token) {
        return;
      }

      setLoadingPayment(true);
      try {
        const response = await fetch(
          `/api/inspections/${inspectionId}/client-view/payment?token=${encodeURIComponent(token)}`
        );

        if (response.ok) {
          const data = await response.json();
          setPaymentTotal(data.total || 0);
          setPaymentSubtotal(data.subtotal || 0);
          setPaymentDiscount(data.discountAmount || 0);
          setAmountPaid(data.amountPaid || 0);
          setRemainingBalance(data.remainingBalance || 0);
          setIsPaid(data.isPaid || false);
        } else if (response.status === 401) {
          // Edge case: Invalid token
          setError("Invalid access token");
        } else if (response.status === 404) {
          // Edge case: Inspection not found
          setError("Inspection not found");
        }
      } catch (err) {
        // Edge case: Network errors
        console.error("Error fetching payment info:", err);
        // Don't set error state, just log it (payment is optional)
      } finally {
        setLoadingPayment(false);
      }
    };

    fetchPaymentInfo();
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
    const allInputPlaceholders = detectTextInputPlaceholders(agreement.content);
    const requiredPlaceholdersList = getRequiredInputPlaceholders();
    const requiredPlaceholders = allInputPlaceholders.filter(p => requiredPlaceholdersList.includes(p));
    
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
    const TEXT_INPUT_PLACEHOLDERS = getInputPlaceholders();

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
      const requiredPlaceholders = getRequiredInputPlaceholders();
      const isRequired = requiredPlaceholders.includes(placeholder);
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
      const allInputPlaceholders = detectTextInputPlaceholders(agreement.content);
      const requiredPlaceholdersList = getRequiredInputPlaceholders();
      const requiredPlaceholders = allInputPlaceholders.filter(p => requiredPlaceholdersList.includes(p));
      
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

  // Handle opening payment modal
  const handleOpenPaymentModal = async () => {
    // Edge case: Already fully paid
    if (isPaid || remainingBalance <= 0) {
      toast.info('This inspection has already been fully paid');
      return;
    }

    // Edge case: Zero amount
    if (paymentTotal !== null && paymentTotal <= 0) {
      toast.info('No payment required for this inspection');
      return;
    }

    // Edge case: Missing required data
    if (!inspectionId || !token) {
      toast.error('Missing required information');
      return;
    }

    setShowPaymentModal(true);
    setProcessingPayment(false);

    try {
      // Create payment intent
      const response = await fetch(
        `/api/inspections/${inspectionId}/client-view/create-payment-intent?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        
        // Edge case: Already paid (race condition)
        if (response.status === 400 && (errorData.error?.includes('already been paid') || errorData.error?.includes('fully paid'))) {
          toast.info('This inspection has already been fully paid');
          setIsPaid(true);
          setRemainingBalance(0);
          setShowPaymentModal(false);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to initialize payment');
      }

      const data = await response.json();
      
      // Edge case: Missing client secret
      if (!data.clientSecret) {
        throw new Error('Payment initialization incomplete');
      }
      
      setStripeClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
    } catch (err: any) {
      console.error("Error creating payment intent:", err);
      
      // Edge case: Network errors
      if (err.message === 'Failed to fetch' || err.message === 'Network error') {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error(err.message || 'Failed to initialize payment');
      }
      
      setShowPaymentModal(false);
    }
  };

  // Handle invoice download
  const handleDownloadInvoice = async () => {
    if (!inspectionId || !token) {
      toast.error('Missing required information');
      return;
    }

    try {
      // Fetch invoice data
      const response = await fetch(
        `/api/inspections/${inspectionId}/client-view/invoice?token=${encodeURIComponent(token)}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch invoice data' }));
        throw new Error(errorData.error || 'Failed to fetch invoice data');
      }

      const invoiceData = await response.json();

      // Create PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPos = margin;

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('INVOICE', pageWidth - margin, yPos, { align: 'right' });
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Invoice #: ${invoiceData.invoiceNumber}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 6;
      doc.text(`Date: ${invoiceData.invoiceDate}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 10;

      // Company/Bill From
      if (invoiceData.companyName) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Bill From:', margin, yPos);
        yPos += 8;
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text(invoiceData.companyName, margin, yPos);
        yPos += 6;
      }

      // Client/Bill To
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Bill To:', margin, yPos);
      yPos += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      if (invoiceData.clientName) {
        doc.text(invoiceData.clientName, margin, yPos);
        yPos += 6;
      }
      if (invoiceData.address) {
        const addressLines = doc.splitTextToSize(invoiceData.address, pageWidth - 2 * margin);
        doc.text(addressLines, margin, yPos);
        yPos += addressLines.length * 6;
      }
      yPos += 10;

      // Inspection Date
      if (invoiceData.inspectionDate) {
        doc.setFontSize(10);
        doc.text(`Inspection Date: ${invoiceData.inspectionDate}`, margin, yPos);
        yPos += 8;
      }

      // Check if any items have discounts
      const hasDiscounts = invoiceData.items.some((item: any) => item.discountCode);

      // Items table header
      yPos += 5;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 8;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      
      // Calculate column positions dynamically based on page width
      const availableWidth = pageWidth - 2 * margin;
      const colSpacing = 10;
      
      let descWidth: number;
      let discountCodeWidth: number = 0;
      let priceWidth: number;
      let discountedPriceWidth: number = 0;
      
      if (hasDiscounts) {
        // With discounts: Give description 50% of space, then distribute rest
        // Description: 50%, Discount Code: 20%, Price: 15%, Discounted Price: 15%
        descWidth = availableWidth * 0.50;
        discountCodeWidth = availableWidth * 0.20;
        priceWidth = availableWidth * 0.15;
        discountedPriceWidth = availableWidth * 0.15;
      } else {
        // Without discounts: Description gets 75%, Price gets 25%
        descWidth = availableWidth * 0.75;
        priceWidth = availableWidth * 0.25;
      }
      
      let currentX = margin;
      doc.text('Description', currentX, yPos);
      currentX += descWidth + colSpacing;
      
      if (hasDiscounts) {
        doc.text('Discount Code', currentX, yPos);
        currentX += discountCodeWidth + colSpacing;
      }
      
      doc.text('Price', currentX + priceWidth, yPos, { align: 'right' });
      currentX += priceWidth + colSpacing;
      
      if (hasDiscounts) {
        doc.text('Discounted Price', currentX + discountedPriceWidth, yPos, { align: 'right' });
        currentX += discountedPriceWidth;
      }
      
      yPos += 8;
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 5;

      // Items
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      for (const item of invoiceData.items) {
        // Check if we need a new page
        if (yPos > doc.internal.pageSize.getHeight() - 80) {
          doc.addPage();
          yPos = margin;
          // Redraw header on new page
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(11);
          doc.line(margin, yPos, pageWidth - margin, yPos);
          yPos += 8;
          currentX = margin;
          doc.text('Description', currentX, yPos);
          currentX += descWidth + colSpacing;
          if (hasDiscounts) {
            doc.text('Discount Code', currentX, yPos);
            currentX += discountCodeWidth + colSpacing;
          }
          doc.text('Price', currentX + priceWidth, yPos, { align: 'right' });
          currentX += priceWidth + colSpacing;
          if (hasDiscounts) {
            doc.text('Discounted Price', currentX + discountedPriceWidth, yPos, { align: 'right' });
          }
          yPos += 8;
          doc.line(margin, yPos, pageWidth - margin, yPos);
          yPos += 5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
        }

        const descriptionLines = doc.splitTextToSize(item.description, descWidth - 5);
        const maxLines = Math.max(descriptionLines.length, 1);
        
        currentX = margin;
        doc.text(descriptionLines, currentX, yPos);
        currentX += descWidth + colSpacing;
        
        if (hasDiscounts) {
          const discountCodeText = item.discountCode || '-';
          doc.text(discountCodeText, currentX, yPos);
          currentX += discountCodeWidth + colSpacing;
        }
        
        const priceText = `$${(item.realPrice || item.unitPrice || 0).toFixed(2)}`;
        doc.text(priceText, currentX + priceWidth, yPos, { align: 'right' });
        currentX += priceWidth + colSpacing;
        
        if (hasDiscounts) {
          const discountedPrice = item.discountedPrice !== undefined 
            ? item.discountedPrice 
            : (item.total || item.unitPrice || 0);
          const discountedPriceText = `$${discountedPrice.toFixed(2)}`;
          doc.text(discountedPriceText, currentX + discountedPriceWidth, yPos, { align: 'right' });
          currentX += discountedPriceWidth;
        }
        
        yPos += Math.max(maxLines * 5.5, 9);
      }

      yPos += 5;
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;

      // Totals
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text('Subtotal:', pageWidth - margin - 50, yPos, { align: 'right' });
      doc.text(`$${invoiceData.subtotal.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 8;

      if (invoiceData.discountAmount > 0) {
        doc.text(`Discount${invoiceData.discountCode ? ` (${invoiceData.discountCode})` : ''}:`, pageWidth - margin - 50, yPos, { align: 'right' });
        doc.text(`-$${invoiceData.discountAmount.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
        yPos += 8;
      }

      // Total price - more prominent
      yPos += 5;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Total Price:', pageWidth - margin - 50, yPos, { align: 'right' });
      doc.text(`$${invoiceData.total.toFixed(2)}`, pageWidth - margin, yPos, { align: 'right' });
      yPos += 10;

      // Payment status
      if (invoiceData.isPaid) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 128, 0);
        doc.text('PAID', pageWidth - margin, yPos, { align: 'right' });
        doc.setTextColor(0, 0, 0);
      }

      // Footer
      const totalPages = (doc as any).internal.pages.length;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Page ${i} of ${totalPages}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
        doc.setTextColor(0, 0, 0);
      }

      // Save PDF
      doc.save(`Invoice-${invoiceData.invoiceNumber}.pdf`);
      toast.success('Invoice downloaded successfully!');
    } catch (err: any) {
      console.error("Error generating invoice:", err);
      toast.error(err.message || 'Failed to generate invoice');
    }
  };

  // Handle payment submission
  const handlePaymentSubmit = async (stripe: any, elements: any) => {
    // Edge case: Missing Stripe or elements
    if (!stripe || !elements) {
      toast.error('Payment system not ready. Please refresh the page.');
      return;
    }

    // Edge case: Missing payment intent ID
    if (!paymentIntentId) {
      toast.error('Payment session expired. Please try again.');
      setShowPaymentModal(false);
      return;
    }

    setProcessingPayment(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/inspection/${inspectionId}?token=${encodeURIComponent(token || '')}`,
        },
        redirect: 'if_required',
      });

      // Edge case: Stripe payment error
      if (error) {
        // Handle specific error types
        if (error.type === 'card_error' || error.type === 'validation_error') {
          toast.error(error.message || 'Payment failed. Please check your card details.');
        } else {
          toast.error(error.message || 'Payment failed. Please try again.');
        }
        setProcessingPayment(false);
        return;
      }

      // Edge case: Payment intent not found or invalid status
      if (!paymentIntent) {
        toast.error('Payment session expired. Please try again.');
        setProcessingPayment(false);
        setShowPaymentModal(false);
        return;
      }

      // Edge case: Payment succeeded
      if (paymentIntent.status === 'succeeded') {
        // Confirm payment on backend (handles race conditions)
        const confirmResponse = await fetch(
          `/api/inspections/${inspectionId}/client-view/confirm-payment?token=${encodeURIComponent(token || '')}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ paymentIntentId }),
          }
        );

        if (confirmResponse.ok) {
          toast.success('Payment successful!');
          setIsPaid(true);
          setShowPaymentModal(false);
          
          // Refresh payment info to get latest status
          try {
            const paymentResponse = await fetch(
              `/api/inspections/${inspectionId}/client-view/payment?token=${encodeURIComponent(token || '')}`
            );
            if (paymentResponse.ok) {
              const paymentData = await paymentResponse.json();
              setPaymentTotal(paymentData.total || 0);
              setPaymentSubtotal(paymentData.subtotal || 0);
              setPaymentDiscount(paymentData.discountAmount || 0);
              setAmountPaid(paymentData.amountPaid || 0);
              setRemainingBalance(paymentData.remainingBalance || 0);
              setIsPaid(paymentData.isPaid || false);
            }
          } catch (refreshErr) {
            console.error("Error refreshing payment info:", refreshErr);
            // Don't show error to user, payment was successful
          }
        } else {
          const errorData = await confirmResponse.json().catch(() => ({ error: 'Network error' }));
          
          // Edge case: Already paid (webhook processed it first)
          if (errorData.error?.includes('already been paid') || errorData.error?.includes('already paid') || errorData.error?.includes('already confirmed')) {
            toast.success('Payment successful!');
            setIsPaid(true);
            setRemainingBalance(0);
            setShowPaymentModal(false);
            // Refresh payment info
            try {
              const paymentResponse = await fetch(
                `/api/inspections/${inspectionId}/client-view/payment?token=${encodeURIComponent(token || '')}`
              );
              if (paymentResponse.ok) {
                const paymentData = await paymentResponse.json();
                setAmountPaid(paymentData.amountPaid || 0);
                setRemainingBalance(paymentData.remainingBalance || 0);
                setIsPaid(paymentData.isPaid || false);
              }
            } catch (refreshErr) {
              console.error("Error refreshing payment info:", refreshErr);
            }
            return;
          }
          
          throw new Error(errorData.error || 'Failed to confirm payment');
        }
      } else if (paymentIntent.status === 'requires_action') {
        // Edge case: 3D Secure or other action required
        toast.info('Additional authentication required. Please complete the verification.');
      } else if (paymentIntent.status === 'processing') {
        // Edge case: Payment is processing
        toast.info('Payment is being processed. Please wait...');
      } else {
        // Edge case: Other payment statuses
        toast.error(`Payment status: ${paymentIntent.status}. Please contact support if this persists.`);
      }
    } catch (err: any) {
      console.error("Error processing payment:", err);
      
      // Edge case: Network errors
      if (err.message === 'Failed to fetch' || err.message === 'Network error') {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error(err.message || 'Payment processing failed. Please try again.');
      }
    } finally {
      setProcessingPayment(false);
    }
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
                      src={`/api/inspections/${inspectionId}/client-view/map-image`}
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

              {/* Payment Section */}
              {!loadingPayment && paymentTotal !== null && (
                <div className="mt-8 pt-8 border-t">
                  <div className="flex items-center mb-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                      <svg
                        className="w-5 h-5 text-indigo-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                        />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      Payment
                    </h2>
                  </div>
                  <div className="ml-13 pl-2 space-y-2">
                    {amountPaid > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Amount Paid:</span>
                        <span className="font-medium text-green-600">${amountPaid.toFixed(2)}</span>
                      </div>
                    )}
                    {remainingBalance > 0 && (
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Remaining Balance:</span>
                        <span className="font-medium text-orange-600">${remainingBalance.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t">
                      <span>Total Amount:</span>
                      <span className="text-indigo-600">${paymentTotal.toFixed(2)}</span>
                    </div>
                  
                      {isPaid || remainingBalance <= 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                            <span className="font-semibold">Paid</span>
                          </div>
                        </div>
                      ) : remainingBalance > 0 ? (
                      <Button
                        onClick={handleOpenPaymentModal}
                        disabled={loadingPayment || processingPayment}
                        className="mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                          />
                        </svg>
                        {amountPaid > 0 ? `Pay Remaining Balance ($${remainingBalance.toFixed(2)})` : 'Pay Now'}
                      </Button>
                      ) : null}

                    <div className="mt-4 flex gap-3">
                      <Button
                        onClick={handleDownloadInvoice}
                        variant="outline"
                        className="flex-1"
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
                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        Download Invoice
                      </Button>
                    </div>
                    {!isPaid && remainingBalance === 0 && paymentTotal === 0 ? (
                      <div className="mt-4 text-sm text-gray-500">
                        No payment required
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

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
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
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

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={(open) => {
        if (!open && !processingPayment) {
          setShowPaymentModal(false);
          setStripeClientSecret(null);
          setPaymentIntentId(null);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900">
              Complete Payment
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Enter your payment details to complete the payment for your inspection.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {paymentTotal !== null && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 font-medium">Total Amount:</span>
                  <span className="text-2xl font-bold text-gray-900">${paymentTotal.toFixed(2)}</span>
                </div>
                {amountPaid > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-gray-600 text-sm">Amount Paid:</span>
                    <span className="text-lg font-semibold text-green-600">${amountPaid.toFixed(2)}</span>
                  </div>
                )}
                {remainingBalance > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Remaining Balance:</span>
                    <span className="text-lg font-semibold text-orange-600">${remainingBalance.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
            
            {stripeClientSecret && stripePromise ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret: stripeClientSecret,
                  appearance: {
                    theme: 'stripe',
                  },
                } as StripeElementsOptions}
              >
                <PaymentForm
                  clientSecret={stripeClientSecret}
                  paymentIntentId={paymentIntentId}
                  paymentTotal={paymentTotal}
                  remainingBalance={remainingBalance}
                  onSuccess={handlePaymentSubmit}
                  onCancel={() => {
                    if (!processingPayment) {
                      setShowPaymentModal(false);
                      setStripeClientSecret(null);
                      setPaymentIntentId(null);
                    }
                  }}
                />
              </Elements>
            ) : (
              <div className="flex items-center justify-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
              </div>
            )}
          </div>
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

