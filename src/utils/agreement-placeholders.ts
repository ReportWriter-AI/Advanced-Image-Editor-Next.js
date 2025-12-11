/**
 * Replaces placeholders in agreement content with actual data from inspection and company
 */

// List of placeholders that should be rendered as text inputs
const TEXT_INPUT_PLACEHOLDERS = [
  '[CUSTOMER_INITIALS]',
  '[REQUIRED_CUSTOMER_INITIALS]',
];

/**
 * Detects all text input placeholders in the content
 * @param content - The agreement content HTML string
 * @returns Array of placeholder tokens found in the content
 */
export function detectTextInputPlaceholders(content: string): string[] {
  const foundPlaceholders: string[] = [];
  
  TEXT_INPUT_PLACEHOLDERS.forEach(placeholder => {
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
  
  TEXT_INPUT_PLACEHOLDERS.forEach(placeholder => {
    const value = inputValues[placeholder] || '';
    const placeholderKey = placeholder.replace(/[\[\]]/g, ''); // Remove brackets for ID
    
    if (isReadOnly) {
      // Show saved value as text
      const inputHtml = `<span class="agreement-input-value" style="display: inline-block; min-width: 100px; padding: 2px 4px; border-bottom: 1px solid #000; font-weight: 500;">${value || '&nbsp;'}</span>`;
      const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      replacedContent = replacedContent.replace(regex, inputHtml);
    } else {
      // Show input field
      const isRequired = placeholder.includes('REQUIRED');
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

