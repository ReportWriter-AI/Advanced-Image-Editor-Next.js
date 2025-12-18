/**
 * Helper functions for checking and processing automation triggers
 */

import mongoose from 'mongoose';
import Inspection from '@/src/models/Inspection';
import { processTrigger, wasTriggerAlreadySent } from './automation-trigger-service';
import { queueTrigger } from './automation-queue';
import { requiresConfirmedInspection } from './automation-triggers';

/**
 * Checks and processes triggers for an inspection based on a trigger event
 */
export async function checkAndProcessTriggers(
  inspectionId: string | mongoose.Types.ObjectId,
  triggerEvent: string
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
      'INSPECTION_START_TIME',
      'INSPECTION_END_TIME',
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

      // Calculate execution time
      let baseTime: Date | null = null;

      switch (triggerConfig.automationTrigger) {
        case 'INSPECTION_START_TIME':
        case 'INSPECTION_END_TIME':
          baseTime = inspection.date ? new Date(inspection.date) : null;
          break;
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

      // Calculate execution time based on sendTiming and delay
      let executionTime = new Date(baseTime);
      const delay = triggerConfig.sendDelay || 0;
      const delayUnit = triggerConfig.sendDelayUnit || 'HOURS';

      // Convert delay to milliseconds
      let delayMs = 0;
      switch (delayUnit) {
        case 'MINUTES':
          delayMs = delay * 60 * 1000;
          break;
        case 'HOURS':
          delayMs = delay * 60 * 60 * 1000;
          break;
        case 'DAYS':
          delayMs = delay * 24 * 60 * 60 * 1000;
          break;
        case 'WEEKS':
          delayMs = delay * 7 * 24 * 60 * 60 * 1000;
          break;
        case 'MONTHS':
          delayMs = delay * 30 * 24 * 60 * 60 * 1000; // Approximate
          break;
      }

      if (triggerConfig.sendTiming === 'BEFORE') {
        executionTime = new Date(baseTime.getTime() - delayMs);
      } else {
        // AFTER (default)
        executionTime = new Date(baseTime.getTime() + delayMs);
      }

      // Only queue if execution time is in the future
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

