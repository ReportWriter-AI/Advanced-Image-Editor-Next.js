/**
 * Replaces placeholders in agreement content with actual data from inspection and company
 */

import { PLACEHOLDER_SECTIONS, PlaceholderItem } from "@/src/app/(authenticated)/agreements/_components/AgreementForm";
import { format } from "date-fns";

/**
 * Gets all placeholder tokens that are marked as input placeholders
 * @returns Array of placeholder tokens that have input: true
 */
export function getInputPlaceholders(): string[] {
  const inputPlaceholders: string[] = [];
  
  PLACEHOLDER_SECTIONS.forEach(section => {
    section.placeholders.forEach(placeholder => {
      if (placeholder.input === true) {
        inputPlaceholders.push(placeholder.token);
      }
    });
  });
  
  return inputPlaceholders;
}

/**
 * Gets all placeholder tokens that are marked as required input placeholders
 * @returns Array of placeholder tokens that have input: true and required: true
 */
export function getRequiredInputPlaceholders(): string[] {
  const requiredPlaceholders: string[] = [];
  
  PLACEHOLDER_SECTIONS.forEach(section => {
    section.placeholders.forEach(placeholder => {
      if (placeholder.input === true && placeholder.required === true) {
        requiredPlaceholders.push(placeholder.token);
      }
    });
  });
  
  return requiredPlaceholders;
}

/**
 * Checks if a placeholder token is an input placeholder
 * @param token - The placeholder token to check
 * @returns true if the token is an input placeholder
 */
export function isInputPlaceholder(token: string): boolean {
  return getInputPlaceholders().includes(token);
}

/**
 * Checks if a placeholder token is a required input placeholder
 * @param token - The placeholder token to check
 * @returns true if the token is a required input placeholder
 */
export function isRequiredInputPlaceholder(token: string): boolean {
  return getRequiredInputPlaceholders().includes(token);
}

/**
 * Gets placeholder metadata for a given token
 * @param token - The placeholder token to look up
 * @returns PlaceholderItem if found, undefined otherwise
 */
function getPlaceholderMetadata(token: string): PlaceholderItem | undefined {
  for (const section of PLACEHOLDER_SECTIONS) {
    const placeholder = section.placeholders.find(p => p.token === token);
    if (placeholder) {
      return placeholder;
    }
  }
  return undefined;
}

/**
 * Detects all text input placeholders in the content
 * @param content - The agreement content HTML string
 * @returns Array of placeholder tokens found in the content
 */
export function detectTextInputPlaceholders(content: string): string[] {
  const foundPlaceholders: string[] = [];
  const inputPlaceholders = getInputPlaceholders();
  
  inputPlaceholders.forEach(placeholder => {
    if (content.includes(placeholder)) {
      foundPlaceholders.push(placeholder);
    }
  });
  
  return foundPlaceholders;
}

/**
 * Replaces text input placeholders with input field HTML
 * @param content - The agreement content HTML string
 * @param inputValues - Object mapping placeholder to input value
 * @param isReadOnly - Whether to show inputs as read-only
 * @returns Content with placeholders replaced with input fields or values
 */
export function replaceTextInputPlaceholders(
  content: string,
  inputValues: Record<string, string> = {},
  isReadOnly: boolean = false
): string {
  let replacedContent = content;
  const inputPlaceholders = getInputPlaceholders();
  
  inputPlaceholders.forEach(placeholder => {
    const value = inputValues[placeholder] || '';
    const placeholderKey = placeholder.replace(/[\[\]]/g, ''); // Remove brackets for ID
    const metadata = getPlaceholderMetadata(placeholder);
    const isRequired = metadata?.required === true;
    
    if (isReadOnly) {
      // Show saved value as text
      const inputHtml = `<span class="agreement-input-value" style="display: inline-block; min-width: 100px; padding: 2px 4px; border-bottom: 1px solid #000; font-weight: 500;">${value || '&nbsp;'}</span>`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      replacedContent = replacedContent.replace(regex, inputHtml);
    } else {
      // Show input field
      const inputHtml = `<input 
        type="text" 
        id="agreement-input-${placeholderKey}" 
        data-placeholder="${placeholder}"
        class="agreement-text-input" 
        value="${value}" 
        ${isRequired ? 'required' : ''}
        style="display: inline-block; min-width: 100px; padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: inherit; font-family: inherit;"
        maxlength="50"
      />`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      replacedContent = replacedContent.replace(regex, inputHtml);
    }
  });
  
  return replacedContent;
}

/**
 * Formats event date/time range
 * @param startDate - Event start date
 * @param endDate - Event end date
 * @returns Formatted string like "12/26/2025 12:00 am - 1:00 am"
 */
function formatEventDateTime(startDate: Date | null, endDate: Date | null): string {
  if (!startDate || !endDate) {
    return '';
  }
  
  try {
    const startDateStr = format(new Date(startDate), 'MM/dd/yyyy h:mm a');
    const endTimeStr = format(new Date(endDate), 'h:mm a');
    return `${startDateStr} - ${endTimeStr}`;
  } catch (err) {
    return '';
  }
}

/**
 * Formats inspector name
 * @param inspector - Inspector object with firstName and lastName
 * @returns Formatted name or empty string
 */
function formatInspectorName(inspector?: { firstName?: string; lastName?: string }): string {
  if (!inspector) {
    return '';
  }
  
  const firstName = inspector.firstName || '';
  const lastName = inspector.lastName || '';
  return `${firstName} ${lastName}`.trim();
}

/**
 * Generates HTML table for events
 * @param events - Array of event objects
 * @param includeInspector - Whether to include inspector column
 * @returns HTML table string with borders
 */
function generateEventsTable(
  events: Array<{ name: string; startDate: Date | null; endDate: Date | null; inspector?: { firstName?: string; lastName?: string } }>,
  includeInspector: boolean
): string {
  if (!events || events.length === 0) {
    return '';
  }

  let tableHtml = '<table style="border: 1px solid #000; border-collapse: collapse; width: 100%;">';
  
  // Header row
  tableHtml += '<tr>';
  tableHtml += '<td style="border: 1px solid #000; padding: 4px; font-weight: bold;">Date/Time Range</td>';
  tableHtml += '<td style="border: 1px solid #000; padding: 4px; font-weight: bold;">Event Name</td>';
  if (includeInspector) {
    tableHtml += '<td style="border: 1px solid #000; padding: 4px; font-weight: bold;">Inspector</td>';
  }
  tableHtml += '</tr>';

  // Data rows
  events.forEach((event) => {
    const dateTimeRange = formatEventDateTime(event.startDate, event.endDate);
    const inspectorName = includeInspector ? formatInspectorName(event.inspector) : '';
    
    tableHtml += '<tr>';
    tableHtml += `<td style="border: 1px solid #000; padding: 4px;">${dateTimeRange || ''}</td>`;
    tableHtml += `<td style="border: 1px solid #000; padding: 4px;">${event.name || ''}</td>`;
    if (includeInspector) {
      tableHtml += `<td style="border: 1px solid #000; padding: 4px;">${inspectorName}</td>`;
    }
    tableHtml += '</tr>';
  });

  tableHtml += '</table>';
  return tableHtml;
}

/**
 * Generates plain text for events
 * @param events - Array of event objects
 * @param includeInspector - Whether to include inspector name
 * @returns Plain text string
 */
function generateEventsText(
  events: Array<{ name: string; startDate: Date | null; endDate: Date | null; inspector?: { firstName?: string; lastName?: string } }>,
  includeInspector: boolean
): string {
  if (!events || events.length === 0) {
    return '';
  }

  return events.map((event) => {
    const dateTimeRange = formatEventDateTime(event.startDate, event.endDate);
    const inspectorName = includeInspector ? formatInspectorName(event.inspector) : '';
    
    if (includeInspector && inspectorName) {
      return `${dateTimeRange}: ${event.name || ''} (${inspectorName})`;
    } else {
      return `${dateTimeRange}: ${event.name || ''}`;
    }
  }).join(' ');
}

export interface PlaceholderData {
  address?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  yearBuilt?: number;
  foundation?: string;
  squareFeet?: number;
  price?: number;
  fees?: string;
  services?: string;
  currentDate?: string;
  currentYear?: string;
  clientName?: string;
  clientFirstName?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientContactInfo?: string;
  clientAddress?: string;
  customerInitials?: string;
  requiredCustomerInitials?: string;
  inspectionDate?: string;
  inspectionTime?: string;
  inspectionEndTime?: string;
  inspectionTextLink?: string;
  signAndPayLink?: string;
  signLink?: string;
  payLink?: string;
  invoiceLink?: string;
  viewReportOnClientPortalLink?: string;
  reportPublishedTextLink?: string;
  companyWebsite?: string;
  inspectionCompany?: string;
  inspectionCompanyPhone?: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyZip?: string;
  companyPhone?: string;
  inspectorSignature?: string;
  agentName?: string;
  agentFirstName?: string;
  agentContactInfo?: string;
  agentPhone?: string;
  agentEmail?: string;
  agentAddress?: string;
  agentFullAddress?: string;
  agentCity?: string;
  agentState?: string;
  agentZip?: string;
  listingAgentName?: string;
  listingAgentFirstName?: string;
  listingAgentContactInfo?: string;
  listingAgentPhone?: string;
  listingAgentEmail?: string;
  listingAgentAddress?: string;
  listingAgentFullAddress?: string;
  listingAgentCity?: string;
  listingAgentState?: string;
  listingAgentZip?: string;
  description?: string;
  notes?: string;
  events?: Array<{ name: string; startDate: Date | null; endDate: Date | null; inspector?: { firstName?: string; lastName?: string } }>;
  paid?: string;
  published?: string;
  agreed?: string;
  orderId?: string;
  inspectorFirstName?: string;
  inspectorName?: string;
  inspectors?: string;
  inspectorsFirstNames?: string;
  inspectorPhone?: string;
  inspectorEmail?: string;
  inspectorCredentials?: string;
  inspectorImage?: string;
  inspectorDescription?: string;
  inspectorNotes?: string;
  inspectorInitials?: string;
}

/**
 * Replaces all placeholders in agreement content with actual values
 * @param content - The agreement content HTML string with placeholders
 * @param data - Object containing all the replacement values
 * @returns Content with placeholders replaced
 */
export function replaceAgreementPlaceholders(
  content: string,
  data: PlaceholderData
): string {
  let replacedContent = content;

  // Replace each placeholder with its corresponding value
  // Note: Text input placeholders ([CUSTOMER_INITIALS], [REQUIRED_CUSTOMER_INITIALS]) are handled separately
  const replacements: Array<[string, string]> = [
    ['[ADDRESS]', data.address || ''],
    ['[STREET]', data.street || ''],
    ['[CITY]', data.city || ''],
    ['[STATE]', data.state || ''],
    ['[ZIP]', data.zip || ''],
    ['[COUNTY]', data.county || ''],
    ['[YEAR_BUILT]', data.yearBuilt !== undefined ? String(data.yearBuilt) : ''],
    ['[FOUNDATION]', data.foundation || ''],
    ['[SQUARE_FEET]', data.squareFeet !== undefined ? String(data.squareFeet) : ''],
    ['[PRICE]', data.price !== undefined ? `$${data.price.toFixed(2)}` : ''],
    ['[FEES]', data.fees || ''],
    ['[SERVICES]', data.services || ''],
    ['[CURRENT_DATE]', data.currentDate || ''],
    ['[CURRENT_YEAR]', data.currentYear || ''],
    ['[CLIENT_NAME]', data.clientName || ''],
    ['[CLIENT_FIRST_NAME]', data.clientFirstName || ''],
    ['[CLIENT_PHONE]', data.clientPhone || ''],
    ['[CLIENT_EMAIL]', data.clientEmail || ''],
    ['[CLIENT_CONTACT_INFO]', data.clientContactInfo || ''],
    ['[CLIENT_ADDRESS]', data.clientAddress || ''],
    // Skip text input placeholders - they're handled by replaceTextInputPlaceholders
    ['[INSPECTION_DATE]', data.inspectionDate || ''],
    ['[INSPECTION_TIME]', data.inspectionTime || ''],
    ['[INSPECTION_END_TIME]', data.inspectionEndTime || ''],
    ['[INSPECTION_TEXT_LINK]', data.inspectionTextLink || ''],
    ['[SIGN_AND_PAY_LINK]', data.signAndPayLink || ''],
    ['[SIGN_LINK]', data.signLink || ''],
    ['[PAY_LINK]', data.payLink || ''],
    ['[INVOICE_LINK]', data.invoiceLink || ''],
    ['[VIEW_REPORT_ON_CLIENT_PORTAL_LINK]', data.viewReportOnClientPortalLink || ''],
    ['[REPORT_PUBLISHED_TEXT_LINK]', data.reportPublishedTextLink || ''],
    ['[COMPANY_WEBSITE]', data.companyWebsite || ''],
    ['[INSPECTION_COMPANY]', data.inspectionCompany || ''],
    ['[INSPECTION_COMPANY_PHONE]', data.inspectionCompanyPhone || ''],
    ['[COMPANY_ADDRESS]', data.companyAddress || ''],
    ['[COMPANY_CITY]', data.companyCity || ''],
    ['[COMPANY_STATE]', data.companyState || ''],
    ['[COMPANY_ZIP]', data.companyZip || ''],
    ['[COMPANY_PHONE]', data.companyPhone || ''],
    ['[INSPECTOR_SIGNATURE]', data.inspectorSignature 
      ? `<img src="${data.inspectorSignature}" alt="Inspector Signature" style="max-width: 200px; height: auto;" />` 
      : ''],
    // New placeholders
    ['[DESCRIPTION]', data.description || ''],
    ['[NOTES]', data.notes || ''],
    ['[PAID]', data.paid || 'No'],
    ['[PUBLISHED]', data.published || 'No'],
    ['[AGREED]', data.agreed || 'No'],
    ['[ORDER_ID]', data.orderId || ''],
    // Event placeholders
    ['[EVENTS]', data.events ? generateEventsTable(data.events, true) : ''],
    ['[EVENTS_LIST]', data.events ? generateEventsTable(data.events, false) : ''],
    ['[EVENTS_TEXT]', data.events ? generateEventsText(data.events, true) : ''],
    ['[EVENTS_LIST_TEXT]', data.events ? generateEventsText(data.events, false) : ''],
    // Inspector placeholders
    ['[INSPECTOR_FIRST_NAME]', data.inspectorFirstName || ''],
    ['[INSPECTOR_NAME]', data.inspectorName || ''],
    ['[INSPECTORS]', data.inspectors || ''],
    ['[INSPECTORS_FIRST_NAMES]', data.inspectorsFirstNames || ''],
    ['[INSPECTOR_PHONE]', data.inspectorPhone || ''],
    ['[INSPECTOR_EMAIL]', data.inspectorEmail || ''],
    ['[INSPECTOR_CREDENTIALS]', data.inspectorCredentials || ''],
    ['[INSPECTOR_IMAGE]', data.inspectorImage ? `<img src="${data.inspectorImage}" alt="Inspector" style="max-width: 200px; height: auto;" />` : ''],
    ['[INSPECTOR_DESCRIPTION]', data.inspectorDescription || ''],
    ['[INSPECTOR_NOTES]', data.inspectorNotes || ''],
    ['[INSPECTOR_INITIALS]', data.inspectorInitials || ''],
    // Agent placeholders
    ['[AGENT_NAME]', data.agentName || ''],
    ['[AGENT_FIRST_NAME]', data.agentFirstName || ''],
    ['[AGENT_CONTACT_INFO]', data.agentContactInfo || ''],
    ['[AGENT_PHONE]', data.agentPhone || ''],
    ['[AGENT_EMAIL]', data.agentEmail || ''],
    ['[AGENT_ADDRESS]', data.agentAddress || ''],
    ['[AGENT_FULL_ADDRESS]', data.agentFullAddress || ''],
    ['[AGENT_CITY]', data.agentCity || ''],
    ['[AGENT_STATE]', data.agentState || ''],
    ['[AGENT_ZIP]', data.agentZip || ''],
    // Listing agent placeholders
    ['[LISTING_AGENT_NAME]', data.listingAgentName || ''],
    ['[LISTING_AGENT_FIRST_NAME]', data.listingAgentFirstName || ''],
    ['[LISTING_AGENT_CONTACT_INFO]', data.listingAgentContactInfo || ''],
    ['[LISTING_AGENT_PHONE]', data.listingAgentPhone || ''],
    ['[LISTING_AGENT_EMAIL]', data.listingAgentEmail || ''],
    ['[LISTING_AGENT_ADDRESS]', data.listingAgentAddress || ''],
    ['[LISTING_AGENT_FULL_ADDRESS]', data.listingAgentFullAddress || ''],
    ['[LISTING_AGENT_CITY]', data.listingAgentCity || ''],
    ['[LISTING_AGENT_STATE]', data.listingAgentState || ''],
    ['[LISTING_AGENT_ZIP]', data.listingAgentZip || ''],
  ];

  // Replace all occurrences of each placeholder
  replacements.forEach(([placeholder, value]) => {
    // Use global regex to replace all occurrences
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    replacedContent = replacedContent.replace(regex, value);
  });

  return replacedContent;
}

