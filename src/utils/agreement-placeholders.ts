/**
 * Replaces placeholders in agreement content with actual data from inspection and company
 */

import { PLACEHOLDER_SECTIONS, PlaceholderItem } from "@/src/app/(authenticated)/agreements/_components/AgreementForm";

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

export interface PlaceholderData {
  address?: string;
  county?: string;
  price?: number;
  fees?: string;
  services?: string;
  currentDate?: string;
  currentYear?: string;
  clientName?: string;
  customerInitials?: string;
  requiredCustomerInitials?: string;
  inspectionDate?: string;
  inspectionTime?: string;
  companyWebsite?: string;
  inspectorSignature?: string;
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
    ['[COUNTY]', data.county || ''],
    ['[PRICE]', data.price !== undefined ? `$${data.price.toFixed(2)}` : ''],
    ['[FEES]', data.fees || ''],
    ['[SERVICES]', data.services || ''],
    ['[CURRENT_DATE]', data.currentDate || ''],
    ['[CURRENT_YEAR]', data.currentYear || ''],
    ['[CLIENT_NAME]', data.clientName || ''],
    // Skip text input placeholders - they're handled by replaceTextInputPlaceholders
    ['[INSPECTION_DATE]', data.inspectionDate || ''],
    ['[INSPECTION_TIME]', data.inspectionTime || ''],
    ['[COMPANY_WEBSITE]', data.companyWebsite || ''],
    ['[INSPECTOR_SIGNATURE]', data.inspectorSignature 
      ? `<img src="${data.inspectorSignature}" alt="Inspector Signature" style="max-width: 200px; height: auto;" />` 
      : ''],
  ];

  // Replace all occurrences of each placeholder
  replacements.forEach(([placeholder, value]) => {
    // Use global regex to replace all occurrences
    const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    replacedContent = replacedContent.replace(regex, value);
  });

  return replacedContent;
}

