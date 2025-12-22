/**
 * Helper functions for checking and processing automation triggers
 */

import mongoose from 'mongoose';
import Inspection from '@/src/models/Inspection';
import { processTrigger, wasTriggerAlreadySent, calculateExecutionTimeWithRestrictions } from './automation-trigger-service';
import { queueTrigger } from './automation-queue';
import { requiresConfirmedInspection, AutomationTriggerKey } from './automation-triggers';

/**
 * Checks and processes triggers for an inspection based on a trigger event
 */
export async function checkAndProcessTriggers(
  inspectionId: string | mongoose.Types.ObjectId,
  triggerEvent: AutomationTriggerKey
): Promise<void> {
  try {
    const inspection = await Inspection.findById(inspectionId).lean();
    if (!inspection || !inspection.triggers) {
      return;
    }

    // Process each trigger that matches the event
    for (let i = 0; i < inspection.triggers.length; i++) {
      const triggerConfig = inspection.triggers[i];

      // Skip if trigger is disabled
      if (triggerConfig.isDisabled) {
        continue;
      }

      // Check if trigger matches the event
      if (triggerConfig.automationTrigger !== triggerEvent) {
        continue;
      }

      // Check if trigger requires confirmed inspection
      if (requiresConfirmedInspection(triggerEvent) && !inspection.confirmedInspection) {
        // Skip triggers that require confirmation if inspection is not confirmed
        continue;
      }

      // Check if already sent and onlyTriggerOnce is true
      if (triggerConfig.onlyTriggerOnce && triggerConfig.sentAt) {
        continue;
      }

      // Process the trigger (will queue if needed for scheduled triggers)
      await processTrigger(inspectionId, i, triggerConfig as any, triggerEvent);
    }
  } catch (error) {
    console.error('Error checking and processing triggers:', error);
    // Don't throw - we don't want trigger failures to break inspection operations
  }
}

/**
 * Queues time-based triggers when an inspection date or related date is set/changed
 */
export async function queueTimeBasedTriggers(
  inspectionId: string | mongoose.Types.ObjectId
): Promise<void> {
  try {
    const inspection = await Inspection.findById(inspectionId).lean();
    if (!inspection || !inspection.triggers) {
      return;
    }

    const timeBasedTriggerKeys = [
      // 'INSPECTION_START_TIME',
      // 'INSPECTION_END_TIME',
      'INSPECTION_CLOSING_DATE',
      'INSPECTION_END_OF_PERIOD_DATE',
    ];

    for (let i = 0; i < inspection.triggers.length; i++) {
      const triggerConfig = inspection.triggers[i];

      if (!timeBasedTriggerKeys.includes(triggerConfig.automationTrigger)) {
        continue;
      }

      if (triggerConfig.isDisabled) {
        continue;
      }

      // Check if notifications are disabled
      // Skip queueing if notifications are disabled unless trigger allows it
      if (
        inspection.disableAutomatedNotifications &&
        !triggerConfig.sendEvenWhenNotificationsDisabled
      ) {
        continue;
      }

      // Check if already sent and onlyTriggerOnce is true
      if (triggerConfig.onlyTriggerOnce && triggerConfig.sentAt) {
        continue;
      }

      // Calculate execution time
      let baseTime: Date | null = null;

      switch (triggerConfig.automationTrigger) {
        // case 'INSPECTION_START_TIME':
        // case 'INSPECTION_END_TIME':
        //   baseTime = inspection.date ? new Date(inspection.date) : null;
        //   break;
        case 'INSPECTION_CLOSING_DATE':
          baseTime = inspection.closingDate?.date
            ? new Date(inspection.closingDate.date)
            : null;
          break;
        case 'INSPECTION_END_OF_PERIOD_DATE':
          baseTime = inspection.endOfInspectionPeriod?.date
            ? new Date(inspection.endOfInspectionPeriod.date)
            : null;
          break;
      }

      if (!baseTime) {
        continue;
      }

      // Calculate execution time with all restrictions applied
      const executionTime = calculateExecutionTimeWithRestrictions(
        baseTime,
        triggerConfig as any
      );

      // Only queue if execution time is in the future
      // Note: Even if execution time is in the past, we still queue it
      // as it represents the next valid time based on restrictions
      if (executionTime > new Date()) {
        await queueTrigger(
          inspectionId.toString(),
          i,
          executionTime,
          triggerConfig.automationTrigger
        );
      }
    }
  } catch (error) {
    console.error('Error queueing time-based triggers:', error);
    // Don't throw - we don't want trigger failures to break inspection operations
  }
}

/**
 * Helper function to normalize serviceId for comparison
 */
function normalizeServiceId(serviceId: any): string | null {
  if (!serviceId) return null;
  if (typeof serviceId === 'string') return serviceId;
  if (serviceId instanceof mongoose.Types.ObjectId) return serviceId.toString();
  if (serviceId._id) return serviceId._id.toString();
  return String(serviceId);
}

/**
 * Helper function to create a unique key for a service item
 */
function getServiceKey(item: any): string | null {
  const serviceId = normalizeServiceId(item.serviceId);
  if (!serviceId) return null;
  return `service:${serviceId}`;
}

/**
 * Helper function to create a unique key for an addon item
 */
function getAddonKey(item: any): string | null {
  const serviceId = normalizeServiceId(item.serviceId);
  const addonName = item.addonName?.toLowerCase()?.trim();
  if (!serviceId || !addonName) return null;
  return `addon:${serviceId}:${addonName}`;
}

/**
 * Compares pricing items before and after update to detect added/removed services or addons
 * Returns flags indicating if services/addons were added or removed
 */
export function detectPricingChanges(
  pricingBefore: { items?: any[] } | null | undefined,
  pricingAfter: { items?: any[] } | null | undefined
): { servicesOrAddonsAdded: boolean; servicesOrAddonsRemoved: boolean } {
  const itemsBefore = pricingBefore?.items || [];
  const itemsAfter = pricingAfter?.items || [];

  // Create sets of keys for services and addons
  const beforeKeys = new Set<string>();
  const afterKeys = new Set<string>();

  // Process items before
  for (const item of itemsBefore) {
    if (item.type === 'service') {
      const key = getServiceKey(item);
      if (key) beforeKeys.add(key);
    } else if (item.type === 'addon') {
      const key = getAddonKey(item);
      if (key) beforeKeys.add(key);
    }
  }

  // Process items after
  for (const item of itemsAfter) {
    if (item.type === 'service') {
      const key = getServiceKey(item);
      if (key) afterKeys.add(key);
    } else if (item.type === 'addon') {
      const key = getAddonKey(item);
      if (key) afterKeys.add(key);
    }
  }

  // Check for additions (in after but not in before)
  let servicesOrAddonsAdded = false;
  for (const key of afterKeys) {
    if (!beforeKeys.has(key)) {
      servicesOrAddonsAdded = true;
      break;
    }
  }

  // Check for removals (in before but not in after)
  let servicesOrAddonsRemoved = false;
  for (const key of beforeKeys) {
    if (!afterKeys.has(key)) {
      servicesOrAddonsRemoved = true;
      break;
    }
  }

  return {
    servicesOrAddonsAdded,
    servicesOrAddonsRemoved,
  };
}

/**
 * Helper function to create a unique key for an additional item (fee)
 */
function getFeeKey(item: any): string | null {
  const name = item.name?.toLowerCase()?.trim();
  if (!name) return null;
  return `fee:${name}`;
}

/**
 * Compares pricing items before and after update to detect added/removed additional items (fees)
 * Returns flags indicating if fees were added or removed
 */
export function detectFeeChanges(
  pricingBefore: { items?: any[] } | null | undefined,
  pricingAfter: { items?: any[] } | null | undefined
): { feesAdded: boolean; feesRemoved: boolean } {
  const itemsBefore = pricingBefore?.items || [];
  const itemsAfter = pricingAfter?.items || [];

  // Create sets of keys for additional items (fees)
  const beforeKeys = new Set<string>();
  const afterKeys = new Set<string>();

  // Process items before
  for (const item of itemsBefore) {
    if (item.type === 'additional') {
      const key = getFeeKey(item);
      if (key) beforeKeys.add(key);
    }
  }

  // Process items after
  for (const item of itemsAfter) {
    if (item.type === 'additional') {
      const key = getFeeKey(item);
      if (key) afterKeys.add(key);
    }
  }

  // Check for additions (in after but not in before)
  let feesAdded = false;
  for (const key of afterKeys) {
    if (!beforeKeys.has(key)) {
      feesAdded = true;
      break;
    }
  }

  // Check for removals (in before but not in after)
  let feesRemoved = false;
  for (const key of beforeKeys) {
    if (!afterKeys.has(key)) {
      feesRemoved = true;
      break;
    }
  }

  return {
    feesAdded,
    feesRemoved,
  };
}

/**
 * Helper function to normalize agreementId for comparison
 */
function normalizeAgreementId(agreementId: any): string | null {
  if (!agreementId) return null;
  if (typeof agreementId === 'string') return agreementId;
  if (agreementId instanceof mongoose.Types.ObjectId) return agreementId.toString();
  if (agreementId._id) return agreementId._id.toString();
  return String(agreementId);
}

/**
 * Compares agreements before and after update to detect added/removed agreements
 * Returns flags indicating if agreements were added or removed
 */
export function detectAgreementChanges(
  agreementsBefore: Array<{ agreementId: any }> | null | undefined,
  agreementsAfter: Array<{ agreementId: any }> | null | undefined
): { agreementsAdded: boolean; agreementsRemoved: boolean } {
  const beforeAgreements = agreementsBefore || [];
  const afterAgreements = agreementsAfter || [];

  // Create sets of agreement IDs
  const beforeIds = new Set<string>();
  const afterIds = new Set<string>();

  // Process agreements before
  for (const agreement of beforeAgreements) {
    const agreementId = normalizeAgreementId(agreement.agreementId);
    if (agreementId) beforeIds.add(agreementId);
  }

  // Process agreements after
  for (const agreement of afterAgreements) {
    const agreementId = normalizeAgreementId(agreement.agreementId);
    if (agreementId) afterIds.add(agreementId);
  }

  // Check for additions (in after but not in before)
  let agreementsAdded = false;
  for (const id of afterIds) {
    if (!beforeIds.has(id)) {
      agreementsAdded = true;
      break;
    }
  }

  // Check for removals (in before but not in after)
  let agreementsRemoved = false;
  for (const id of beforeIds) {
    if (!afterIds.has(id)) {
      agreementsRemoved = true;
      break;
    }
  }

  return {
    agreementsAdded,
    agreementsRemoved,
  };
}

