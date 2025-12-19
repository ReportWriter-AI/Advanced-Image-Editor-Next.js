/**
 * Condition evaluation engine for automation triggers
 */

import mongoose from 'mongoose';
import Inspection from '@/src/models/Inspection';
import Service from '@/src/models/Service';
import Event from '@/src/models/Event';
import Client from '@/src/models/Client';
import Agent from '@/src/models/Agent';
import { ConditionType } from '@/src/models/AutomationAction';

export interface Condition {
  type: ConditionType;
  operator: string;
  value?: string;
  serviceId?: mongoose.Types.ObjectId | string;
  addonName?: string;
  serviceCategory?: string;
  categoryId?: mongoose.Types.ObjectId | string;
  yearBuild?: number;
  foundation?: string;
  squareFeet?: number;
  zipCode?: string;
  city?: string;
  state?: string;
}

/**
 * Evaluates a single condition against inspection data
 */
export async function evaluateCondition(
  condition: Condition,
  inspection: any
): Promise<boolean> {
  switch (condition.type) {
    case 'INSPECTION':
      return evaluateInspectionCondition(condition, inspection);

    case 'AGREEMENT':
      return evaluateAgreementCondition(condition, inspection);

    case 'EVENT_NAME':
      return evaluateEventNameCondition(condition, inspection);

    case 'SERVICE':
      return evaluateServiceCondition(condition, inspection);

    case 'ADDONS':
      return evaluateAddonCondition(condition, inspection);

    case 'SERVICE_CATEGORY':
      return evaluateServiceCategoryCondition(condition, inspection);

    case 'CLIENT_CATEGORY':
    case 'CLIENT_AGENT_CATEGORY':
    case 'LISTING_AGENT_CATEGORY':
      return evaluateCategoryCondition(condition, inspection);

    case 'ALL_REPORTS':
      return evaluateAllReportsCondition(condition, inspection);

    case 'ANY_REPORTS':
      return evaluateAnyReportsCondition(condition, inspection);

    case 'YEAR_BUILD':
      return evaluateYearBuildCondition(condition, inspection);

    case 'FOUNDATION':
      return evaluateFoundationCondition(condition, inspection);

    case 'SQUARE_FEET':
      return evaluateSquareFeetCondition(condition, inspection);

    case 'ZIP_CODE':
      return evaluateZipCodeCondition(condition, inspection);

    case 'CITY':
      return evaluateCityCondition(condition, inspection);

    case 'STATE':
      return evaluateStateCondition(condition, inspection);

    default:
      return false;
  }
}

/**
 * Evaluates all conditions using AND/OR logic
 */
export async function evaluateConditions(
  conditions: Condition[],
  conditionLogic: 'AND' | 'OR',
  inspection: any
): Promise<boolean> {
  if (!conditions || conditions.length === 0) {
    return true; // No conditions means always true
  }

  const results = await Promise.all(
    conditions.map((condition) => evaluateCondition(condition, inspection))
  );

  if (conditionLogic === 'AND') {
    return results.every((result) => result === true);
  } else {
    // OR logic
    return results.some((result) => result === true);
  }
}

// Helper functions for each condition type

function evaluateInspectionCondition(condition: Condition, inspection: any): boolean {
  const isFullyPaid = inspection.isPaid === true;

  switch (condition.operator) {
    case 'Is Fully Paid':
      return isFullyPaid;
    case 'Is not Fully Paid':
      return !isFullyPaid;
    default:
      return false;
  }
}

function evaluateAgreementCondition(condition: Condition, inspection: any): boolean {
  const agreements = inspection.agreements || [];
  const allSigned = agreements.length > 0 && agreements.every((a: any) => a.isSigned === true);
  const anyIncluded = agreements.length > 0;

  switch (condition.operator) {
    case 'Are Signed':
      return allSigned;
    case 'Are not Signed':
      return !allSigned;
    case 'Are Included In the Inspection':
      return anyIncluded;
    case 'Are not Included In the Inspection':
      return !anyIncluded;
    default:
      return false;
  }
}

async function evaluateEventNameCondition(
  condition: Condition,
  inspection: any
): Promise<boolean> {
  if (!condition.value) return false;

  const inspectionId = inspection._id || inspection.id;
  const events = await Event.find({ inspectionId: new mongoose.Types.ObjectId(inspectionId) })
    .select('name')
    .lean();

  const eventNames = events.map((e: any) => (e.name || '').toLowerCase());
  const targetName = condition.value.toLowerCase();

  switch (condition.operator) {
    case 'Is':
      return eventNames.includes(targetName);
    case 'Is Not':
      return !eventNames.includes(targetName);
    default:
      return false;
  }
}

function evaluateServiceCondition(condition: Condition, inspection: any): boolean {
  if (!condition.serviceId) return false;

  const serviceIdStr =
    condition.serviceId instanceof mongoose.Types.ObjectId
      ? condition.serviceId.toString()
      : condition.serviceId.toString();

  const pricingItems = inspection.pricing?.items || [];
  const hasService = pricingItems.some(
    (item: any) =>
      item.type === 'service' &&
      item.serviceId &&
      item.serviceId.toString() === serviceIdStr
  );

  switch (condition.operator) {
    case 'Is Included In the Inspection':
      return hasService;
    case 'Is Not Included In Inspection':
      return !hasService;
    default:
      return false;
  }
}

function evaluateAddonCondition(condition: Condition, inspection: any): boolean {
  if (!condition.serviceId || !condition.addonName) return false;

  const serviceIdStr =
    condition.serviceId instanceof mongoose.Types.ObjectId
      ? condition.serviceId.toString()
      : condition.serviceId.toString();

  const pricingItems = inspection.pricing?.items || [];
  const hasAddon = pricingItems.some(
    (item: any) =>
      item.type === 'addon' &&
      item.serviceId &&
      item.serviceId.toString() === serviceIdStr &&
      item.addonName &&
      item.addonName.toLowerCase() === condition.addonName?.toLowerCase()
  );

  switch (condition.operator) {
    case 'Is Included In the Inspection':
      return hasAddon;
    case 'Is Not Included In Inspection':
      return !hasAddon;
    default:
      return false;
  }
}

async function evaluateServiceCategoryCondition(
  condition: Condition,
  inspection: any
): Promise<boolean> {
  if (!condition.serviceCategory) return false;

  const pricingItems = inspection.pricing?.items || [];
  const serviceIds = pricingItems
    .filter((item: any) => item.type === 'service' && item.serviceId)
    .map((item: any) => item.serviceId);

  if (serviceIds.length === 0) {
    return condition.operator === 'Is Not Included In Inspection';
  }

  const services = await Service.find({
    _id: { $in: serviceIds },
  })
    .select('serviceCategory')
    .lean();

  const hasCategory = services.some(
    (s: any) => s.serviceCategory && s.serviceCategory.toLowerCase() === condition.serviceCategory?.toLowerCase()
  );

  switch (condition.operator) {
    case 'Is Included In the Inspection':
      return hasCategory;
    case 'Is Not Included In Inspection':
      return !hasCategory;
    default:
      return false;
  }
}

async function evaluateCategoryCondition(
  condition: Condition,
  inspection: any
): Promise<boolean> {
  if (!condition.categoryId) return false;

  const categoryIdStr =
    condition.categoryId instanceof mongoose.Types.ObjectId
      ? condition.categoryId.toString()
      : condition.categoryId.toString();

  let hasCategory = false;

  if (condition.type === 'CLIENT_CATEGORY') {
    const clientIds = inspection.clients || [];
    if (clientIds.length > 0) {
      const clients = await Client.find({
        _id: { $in: clientIds },
      })
        .select('category')
        .lean();

      hasCategory = clients.some(
        (c: any) => c.category && c.category.toString() === categoryIdStr
      );
    }
  } else if (condition.type === 'CLIENT_AGENT_CATEGORY') {
    const agentIds = inspection.agents || [];
    if (agentIds.length > 0) {
      const agents = await Agent.find({
        _id: { $in: agentIds },
      })
        .select('category')
        .lean();

      hasCategory = agents.some(
        (a: any) => a.category && a.category.toString() === categoryIdStr
      );
    }
  } else if (condition.type === 'LISTING_AGENT_CATEGORY') {
    const listingAgentIds = inspection.listingAgent || [];
    if (listingAgentIds.length > 0) {
      const agents = await Agent.find({
        _id: { $in: listingAgentIds },
      })
        .select('category')
        .lean();

      hasCategory = agents.some(
        (a: any) => a.category && a.category.toString() === categoryIdStr
      );
    }
  }

  switch (condition.operator) {
    case 'Is':
      return hasCategory;
    case 'Is Not':
      return !hasCategory;
    default:
      return false;
  }
}

function evaluateAllReportsCondition(condition: Condition, inspection: any): boolean {
  const hasPdfReport = !!inspection.pdfReportUrl;
  const hasHtmlReport = !!inspection.htmlReportUrl;
  const allPublished = hasPdfReport && hasHtmlReport;

  switch (condition.operator) {
    case 'Are Published':
      return allPublished;
    case 'Are Not Published':
      return !allPublished;
    default:
      return false;
  }
}

function evaluateAnyReportsCondition(condition: Condition, inspection: any): boolean {
  const hasPdfReport = !!inspection.pdfReportUrl;
  const hasHtmlReport = !!inspection.htmlReportUrl;
  const anyPublished = hasPdfReport || hasHtmlReport;

  switch (condition.operator) {
    case 'Are Published':
      return anyPublished;
    case 'Are Not Published':
      return !anyPublished;
    default:
      return false;
  }
}

function evaluateYearBuildCondition(condition: Condition, inspection: any): boolean {
  if (condition.yearBuild === undefined || condition.yearBuild === null) return false;

  const yearBuild = inspection.location?.yearBuild;
  if (yearBuild === undefined || yearBuild === null) return false;

  switch (condition.operator) {
    case 'Is Or Is After':
      return yearBuild >= condition.yearBuild;
    case 'Is Before':
      return yearBuild < condition.yearBuild;
    default:
      return false;
  }
}

function evaluateFoundationCondition(condition: Condition, inspection: any): boolean {
  if (!condition.foundation) return false;

  const foundation = inspection.location?.foundation;
  if (!foundation) return false;

  const foundationMatch = foundation.toLowerCase() === condition.foundation.toLowerCase();

  switch (condition.operator) {
    case 'Is':
      return foundationMatch;
    case 'Is Not':
      return !foundationMatch;
    default:
      return false;
  }
}

function evaluateSquareFeetCondition(condition: Condition, inspection: any): boolean {
  if (condition.squareFeet === undefined || condition.squareFeet === null) return false;

  const squareFeet = inspection.location?.squareFeet;
  if (squareFeet === undefined || squareFeet === null) return false;

  switch (condition.operator) {
    case 'Is Greater Than Or Equal To':
      return squareFeet >= condition.squareFeet;
    case 'Is Less Than':
      return squareFeet < condition.squareFeet;
    default:
      return false;
  }
}

function evaluateZipCodeCondition(condition: Condition, inspection: any): boolean {
  if (!condition.zipCode) return false;

  const zipCode = inspection.location?.zip;
  if (!zipCode) return false;

  const zipMatch = zipCode.toLowerCase().trim() === condition.zipCode.toLowerCase().trim();

  switch (condition.operator) {
    case 'Is':
      return zipMatch;
    case 'Is Not':
      return !zipMatch;
    default:
      return false;
  }
}

function evaluateCityCondition(condition: Condition, inspection: any): boolean {
  if (!condition.city) return false;

  const city = inspection.location?.city;
  if (!city) return false;

  const cityMatch = city.toLowerCase().trim() === condition.city.toLowerCase().trim();

  switch (condition.operator) {
    case 'Is':
      return cityMatch;
    case 'Is Not':
      return !cityMatch;
    default:
      return false;
  }
}

function evaluateStateCondition(condition: Condition, inspection: any): boolean {
  if (!condition.state) return false;

  const state = inspection.location?.state;
  if (!state) return false;

  const stateMatch = state.toLowerCase().trim() === condition.state.toLowerCase().trim();

  switch (condition.operator) {
    case 'Is':
      return stateMatch;
    case 'Is Not':
      return !stateMatch;
    default:
      return false;
  }
}

