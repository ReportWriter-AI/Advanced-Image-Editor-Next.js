import { ConditionType } from '@/src/models/AutomationAction';
import { SERVICE_CATEGORIES } from '@/constants/serviceCategories';

export interface ConditionTypeOption {
  value: ConditionType;
  label: string;
}

export interface OperatorOption {
  value: string;
  label: string;
}

export const CONDITION_TYPES: ConditionTypeOption[] = [
  { value: 'INSPECTION', label: 'Inspection' },
  { value: 'AGREEMENT', label: 'Agreement' },
  { value: 'EVENT_NAME', label: 'Event Name' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'ADDONS', label: 'Addons' },
  { value: 'SERVICE_CATEGORY', label: 'Service Category' },
  { value: 'CLIENT_CATEGORY', label: 'Client Category' },
  { value: 'CLIENT_AGENT_CATEGORY', label: 'Client Agent Category' },
  { value: 'LISTING_AGENT_CATEGORY', label: 'Listing Agent Category' },
  // { value: 'ALL_REPORTS', label: 'All Reports' },
  // { value: 'ANY_REPORTS', label: 'Any Reports' },
  { value: 'YEAR_BUILD', label: 'Year Build' },
  { value: 'FOUNDATION', label: 'Foundation' },
  { value: 'SQUARE_FEET', label: 'Square Feet' },
  { value: 'ZIP_CODE', label: 'Zip Code' },
  { value: 'CITY', label: 'City' },
  { value: 'STATE', label: 'State' },
];

export const INSPECTION_OPERATORS: OperatorOption[] = [
  { value: 'Is Fully Paid', label: 'Is Fully Paid' },
  { value: 'Is not Fully Paid', label: 'Is not Fully Paid' },
];

export const AGREEMENT_OPERATORS: OperatorOption[] = [
  { value: 'Are Signed', label: 'Are Signed' },
  { value: 'Are not Signed', label: 'Are not Signed' },
  { value: 'Are Included In the Inspection', label: 'Are Included In the Inspection' },
  { value: 'Are not Included In the Inspection', label: 'Are not Included In the Inspection' },
];

export const EVENT_NAME_OPERATORS: OperatorOption[] = [
  { value: 'Is', label: 'Is' },
  { value: 'Is Not', label: 'Is Not' },
];

export const SERVICE_OPERATORS: OperatorOption[] = [
  { value: 'Is Included In the Inspection', label: 'Is Included In the Inspection' },
  { value: 'Is Not Included In Inspection', label: 'Is Not Included In Inspection' },
];

export const ADDONS_OPERATORS: OperatorOption[] = [
  { value: 'Is Included In the Inspection', label: 'Is Included In the Inspection' },
  { value: 'Is Not Included In Inspection', label: 'Is Not Included In Inspection' },
];

export const SERVICE_CATEGORY_OPERATORS: OperatorOption[] = [
  { value: 'Is Included In the Inspection', label: 'Is Included In the Inspection' },
  { value: 'Is Not Included In Inspection', label: 'Is Not Included In Inspection' },
];

export const CATEGORY_OPERATORS: OperatorOption[] = [
  { value: 'Is', label: 'Is' },
  { value: 'Is Not', label: 'Is Not' },
];

export const ALL_REPORTS_OPERATORS: OperatorOption[] = [
  { value: 'Are Published', label: 'Are Published' },
  { value: 'Are Not Published', label: 'Are Not Published' },
];

export const ANY_REPORTS_OPERATORS: OperatorOption[] = [
  { value: 'Are Published', label: 'Are Published' },
  { value: 'Are Not Published', label: 'Are Not Published' },
];

export const YEAR_BUILD_OPERATORS: OperatorOption[] = [
  { value: 'Is Or Is After', label: 'Is Or Is After' },
  { value: 'Is Before', label: 'Is Before' },
];

export const FOUNDATION_OPERATORS: OperatorOption[] = [
  { value: 'Is', label: 'Is' },
  { value: 'Is Not', label: 'Is Not' },
];

export const SQUARE_FEET_OPERATORS: OperatorOption[] = [
  { value: 'Is Greater Than Or Equal To', label: 'Is Greater Than Or Equal To' },
  { value: 'Is Less Than', label: 'Is Less Than' },
];

export const ZIP_CODE_OPERATORS: OperatorOption[] = [
  { value: 'Is', label: 'Is' },
  { value: 'Is Not', label: 'Is Not' },
];

export const CITY_OPERATORS: OperatorOption[] = [
  { value: 'Is', label: 'Is' },
  { value: 'Is Not', label: 'Is Not' },
];

export const STATE_OPERATORS: OperatorOption[] = [
  { value: 'Is', label: 'Is' },
  { value: 'Is Not', label: 'Is Not' },
];

export function getOperatorsForConditionType(type: ConditionType): OperatorOption[] {
  switch (type) {
    case 'INSPECTION':
      return INSPECTION_OPERATORS;
    case 'AGREEMENT':
      return AGREEMENT_OPERATORS;
    case 'EVENT_NAME':
      return EVENT_NAME_OPERATORS;
    case 'SERVICE':
      return SERVICE_OPERATORS;
    case 'ADDONS':
      return ADDONS_OPERATORS;
    case 'SERVICE_CATEGORY':
      return SERVICE_CATEGORY_OPERATORS;
    case 'CLIENT_CATEGORY':
    case 'CLIENT_AGENT_CATEGORY':
    case 'LISTING_AGENT_CATEGORY':
      return CATEGORY_OPERATORS;
    case 'ALL_REPORTS':
      return ALL_REPORTS_OPERATORS;
    case 'ANY_REPORTS':
      return ANY_REPORTS_OPERATORS;
    case 'YEAR_BUILD':
      return YEAR_BUILD_OPERATORS;
    case 'FOUNDATION':
      return FOUNDATION_OPERATORS;
    case 'SQUARE_FEET':
      return SQUARE_FEET_OPERATORS;
    case 'ZIP_CODE':
      return ZIP_CODE_OPERATORS;
    case 'CITY':
      return CITY_OPERATORS;
    case 'STATE':
      return STATE_OPERATORS;
    default:
      return [];
  }
}

export function getServiceCategoryOptions() {
  return SERVICE_CATEGORIES.map((category) => ({
    value: category,
    label: category,
  }));
}

export function isValidServiceCategory(category: string): boolean {
  return SERVICE_CATEGORIES.includes(category);
}

export function validateCondition(condition: {
  type: ConditionType;
  operator: string;
  value?: string;
  serviceId?: string;
  addonName?: string;
  serviceCategory?: string;
  categoryId?: string;
  yearBuild?: number;
  foundation?: string;
  squareFeet?: number;
  zipCode?: string;
  city?: string;
  state?: string;
}): { valid: boolean; error?: string } {
  const operators = getOperatorsForConditionType(condition.type);
  const validOperator = operators.some((op) => op.value === condition.operator);

  if (!validOperator) {
    return { valid: false, error: 'Invalid operator for condition type' };
  }

  switch (condition.type) {
    case 'INSPECTION':
    case 'AGREEMENT':
    case 'ALL_REPORTS':
    case 'ANY_REPORTS':
      // No additional fields required
      break;

    case 'EVENT_NAME':
      if (!condition.value || !condition.value.trim()) {
        return { valid: false, error: 'Event name is required' };
      }
      break;

    case 'SERVICE':
      if (!condition.serviceId) {
        return { valid: false, error: 'Service is required' };
      }
      break;

    case 'ADDONS':
      if (!condition.serviceId) {
        return { valid: false, error: 'Service is required' };
      }
      if (!condition.addonName || !condition.addonName.trim()) {
        return { valid: false, error: 'Addon name is required' };
      }
      break;

    case 'SERVICE_CATEGORY':
      if (!condition.serviceCategory) {
        return { valid: false, error: 'Service category is required' };
      }
      if (!isValidServiceCategory(condition.serviceCategory)) {
        return { valid: false, error: 'Invalid service category' };
      }
      break;

    case 'CLIENT_CATEGORY':
    case 'CLIENT_AGENT_CATEGORY':
    case 'LISTING_AGENT_CATEGORY':
      if (!condition.categoryId) {
        return { valid: false, error: 'Category is required' };
      }
      break;

    case 'YEAR_BUILD':
      if (condition.yearBuild === undefined || condition.yearBuild === null) {
        return { valid: false, error: 'Year build is required' };
      }
      if (!Number.isInteger(condition.yearBuild) || condition.yearBuild <= 0) {
        return { valid: false, error: 'Year build must be a positive integer' };
      }
      break;

    case 'FOUNDATION':
      if (!condition.foundation || !condition.foundation.trim()) {
        return { valid: false, error: 'Foundation is required' };
      }
      break;

    case 'SQUARE_FEET':
      if (condition.squareFeet === undefined || condition.squareFeet === null) {
        return { valid: false, error: 'Square feet is required' };
      }
      if (typeof condition.squareFeet !== 'number' || condition.squareFeet < 0) {
        return { valid: false, error: 'Square feet must be a positive number' };
      }
      break;

    case 'ZIP_CODE':
      if (!condition.zipCode || !condition.zipCode.trim()) {
        return { valid: false, error: 'Zip code is required' };
      }
      break;

    case 'CITY':
      if (!condition.city || !condition.city.trim()) {
        return { valid: false, error: 'City is required' };
      }
      break;

    case 'STATE':
      if (!condition.state || !condition.state.trim()) {
        return { valid: false, error: 'State is required' };
      }
      break;
  }

  return { valid: true };
}



