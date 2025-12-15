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
}): { valid: boolean; error?: string } {
  const operators = getOperatorsForConditionType(condition.type);
  const validOperator = operators.some((op) => op.value === condition.operator);

  if (!validOperator) {
    return { valid: false, error: 'Invalid operator for condition type' };
  }

  switch (condition.type) {
    case 'INSPECTION':
    case 'AGREEMENT':
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
  }

  return { valid: true };
}

