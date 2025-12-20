/**
 * Main trigger service that orchestrates evaluation and execution
 */

import mongoose from 'mongoose';
import Inspection from '@/src/models/Inspection';
import { evaluateConditions, Condition } from './automation-executor';
import { sendAutomationEmail, sendAutomationSMS } from './automation-communication';
import { queueTrigger, removeQueuedTrigger } from './automation-queue';

export interface TriggerConfig {
  actionId: mongoose.Types.ObjectId;
  automationTrigger: string;
  communicationType?: 'EMAIL' | 'TEXT';
  conditions?: Condition[];
  conditionLogic?: 'AND' | 'OR';
  sendTiming?: 'AFTER' | 'BEFORE';
  sendDelay?: number;
  sendDelayUnit?: 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS';
  onlyTriggerOnce?: boolean;
  alsoSendOnRecurringInspections?: boolean;
  sendEvenWhenNotificationsDisabled?: boolean;
  sendDuringCertainHoursOnly?: boolean;
  startTime?: string;
  endTime?: string;
  doNotSendOnWeekends?: boolean;
  emailTo?: string[];
  emailCc?: string[];
  emailBcc?: string[];
  emailFrom?: 'COMPANY' | 'INSPECTOR';
  emailSubject?: string;
  emailBody?: string;
}

/**
 * Checks if a trigger should fire based on timing rules
 */
function shouldTriggerBasedOnTiming(
  triggerConfig: TriggerConfig,
  inspection: any,
  triggerEvent: string
): { shouldTrigger: boolean; executionTime?: Date } {
  // Check if trigger matches the event
  if (triggerConfig.automationTrigger !== triggerEvent) {
    return { shouldTrigger: false };
  }

  // Check if trigger is already sent and onlyTriggerOnce is true
  if (triggerConfig.onlyTriggerOnce) {
    // This should be checked at the inspection level, not here
    // Will be handled by the caller
  }

  // Check time window restriction
  if (triggerConfig.sendDuringCertainHoursOnly && triggerConfig.startTime && triggerConfig.endTime) {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    // Parse start and end times
    const [startHour, startMin] = triggerConfig.startTime.split(':').map(Number);
    const [endHour, endMin] = triggerConfig.endTime.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMin;
    const endTimeMinutes = endHour * 60 + endMin;
    
    // Check if current time is within window
    const isWithinWindow = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
    
    // Check if it's a weekend and doNotSendOnWeekends is enabled
    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (!isWithinWindow || (isWeekend && triggerConfig.doNotSendOnWeekends)) {
      // Schedule for next available time
      const nextExecution = new Date(now);
      
      if (!isWithinWindow) {
        // Outside window: schedule for next day at startTime
        nextExecution.setDate(nextExecution.getDate() + 1);
      } else {
        // Within window but weekend: schedule for Monday at startTime
        if (isWeekend && triggerConfig.doNotSendOnWeekends) {
          const daysUntilMonday = dayOfWeek === 0 ? 1 : 2; // Sunday -> Monday (1 day), Saturday -> Monday (2 days)
          nextExecution.setDate(nextExecution.getDate() + daysUntilMonday);
        }
      }
      
      nextExecution.setHours(startHour, startMin, 0, 0);
      
      // Double-check: if scheduled day is still a weekend, move to Monday
      if (triggerConfig.doNotSendOnWeekends) {
        const scheduledDayOfWeek = nextExecution.getDay();
        if (scheduledDayOfWeek === 0 || scheduledDayOfWeek === 6) {
          const daysUntilMonday = scheduledDayOfWeek === 0 ? 1 : 2;
          nextExecution.setDate(nextExecution.getDate() + daysUntilMonday);
        }
      }
      
      const reason = !isWithinWindow 
        ? `Current time (${now.toLocaleString()}) is outside the allowed time window (${triggerConfig.startTime} - ${triggerConfig.endTime})`
        : `Current time is within window but it's a weekend and "Do not send on weekends" is enabled`;
      
      console.log(`[Automation Trigger] Email scheduled due to time window restriction:`);
      console.log(`  Inspection ID: ${inspection._id || inspection.id || 'N/A'}`);
      console.log(`  Trigger: ${triggerConfig.automationTrigger}`);
      console.log(`  Reason: ${reason}`);
      console.log(`  Current time: ${now.toLocaleString()}`);
      console.log(`  Scheduled to send at: ${nextExecution.toLocaleString()}`);
      console.log(`  Time window: ${triggerConfig.startTime} - ${triggerConfig.endTime}`);
      
      return { shouldTrigger: true, executionTime: nextExecution };
    }
  }

  // Check weekend restriction (only for immediate execution when time window is not enabled)
  if (triggerConfig.doNotSendOnWeekends && !triggerConfig.sendDuringCertainHoursOnly) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Sunday or Saturday - schedule for Monday instead of blocking
      const mondayExecution = new Date(now);
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 2; // Sunday -> Monday (1 day), Saturday -> Monday (2 days)
      mondayExecution.setDate(mondayExecution.getDate() + daysUntilMonday);
      mondayExecution.setHours(0, 0, 0, 0); // Start of Monday
      
      console.log(`[Automation Trigger] Email scheduled due to weekend restriction:`);
      console.log(`  Inspection ID: ${inspection._id || inspection.id || 'N/A'}`);
      console.log(`  Trigger: ${triggerConfig.automationTrigger}`);
      console.log(`  Reason: Current day is ${dayOfWeek === 0 ? 'Sunday' : 'Saturday'} and "Do not send on weekends" is enabled`);
      console.log(`  Current time: ${now.toLocaleString()}`);
      console.log(`  Scheduled to send at: ${mondayExecution.toLocaleString()} (Monday)`);
      
      return { shouldTrigger: true, executionTime: mondayExecution };
    }
  }

  // For time-based triggers, calculate execution time
  const timeBasedTriggers = [
    // 'INSPECTION_START_TIME',
    // 'INSPECTION_END_TIME',
    'INSPECTION_CLOSING_DATE',
    'INSPECTION_END_OF_PERIOD_DATE',
  ];

  if (timeBasedTriggers.includes(triggerConfig.automationTrigger)) {
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
      return { shouldTrigger: false };
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

    // Check if execution time is in the past (for immediate triggers) or future (for scheduled)
    const now = new Date();
    if (executionTime <= now) {
      // Execute immediately
      return { shouldTrigger: true };
    } else {
      // Queue for later
      const delayDescription = delay > 0 
        ? `${delay} ${delayUnit.toLowerCase()} ${triggerConfig.sendTiming === 'BEFORE' ? 'before' : 'after'} ${triggerConfig.automationTrigger}`
        : `at ${triggerConfig.automationTrigger}`;
      
      console.log(`[Automation Trigger] Email scheduled due to delay:`);
      console.log(`  Inspection ID: ${inspection._id || inspection.id || 'N/A'}`);
      console.log(`  Trigger: ${triggerConfig.automationTrigger}`);
      console.log(`  Delay: ${delayDescription}`);
      console.log(`  Base time: ${baseTime.toLocaleString()}`);
      console.log(`  Current time: ${now.toLocaleString()}`);
      console.log(`  Scheduled to send at: ${executionTime.toLocaleString()}`);
      if (delayUnit === 'WEEKS' || delayUnit === 'MONTHS' || delayUnit === 'DAYS') {
        const daysUntil = Math.ceil((executionTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  Days until send: ${daysUntil} day(s)`);
      }
      
      return { shouldTrigger: true, executionTime };
    }
  }

  // For immediate triggers, execute now
  return { shouldTrigger: true };
}

/**
 * Processes a trigger - evaluates conditions and sends communication or queues for later
 */
export async function processTrigger(
  inspectionId: string | mongoose.Types.ObjectId,
  triggerIndex: number,
  triggerConfig: TriggerConfig,
  triggerEvent: string
): Promise<{
  success: boolean;
  queued: boolean;
  error?: string;
}> {
  try {
    // Fetch inspection with all necessary data
    const inspection = await Inspection.findById(inspectionId)
      .populate('clients', 'email phone firstName lastName companyName isCompany')
      .populate('agents', 'email phone firstName lastName')
      .populate('listingAgent', 'email phone firstName lastName')
      .populate('inspector', 'email phoneNumber firstName lastName')
      .populate('agreements.agreementId', 'name content')
      .lean();

    if (!inspection) {
      return {
        success: false,
        queued: false,
        error: 'Inspection not found',
      };
    }

    // Check if already sent and onlyTriggerOnce is true (safety check)
    if (triggerConfig.onlyTriggerOnce && inspection.triggers?.[triggerIndex]?.sentAt) {
      return {
        success: false,
        queued: false,
        error: 'Trigger already sent (onlyTriggerOnce enabled)',
      };
    }

    // Check if notifications are disabled
    // All triggers should respect disableAutomatedNotifications flag
    // unless the trigger config explicitly allows sending when notifications are disabled
    if (
      inspection.disableAutomatedNotifications &&
      !triggerConfig.sendEvenWhenNotificationsDisabled
    ) {
      return {
        success: false,
        queued: false,
        error: 'Automated notifications are disabled for this inspection',
      };
    }

    // Check timing rules
    const timingCheck = shouldTriggerBasedOnTiming(triggerConfig, inspection, triggerEvent);
    if (!timingCheck.shouldTrigger) {
      return {
        success: false,
        queued: false,
        error: 'Trigger conditions not met (timing)',
      };
    }

    // If execution time is in the future, queue it
    if (timingCheck.executionTime && timingCheck.executionTime > new Date()) {
      await queueTrigger(
        inspectionId.toString(),
        triggerIndex,
        timingCheck.executionTime,
        triggerConfig.automationTrigger
      );
      return {
        success: true,
        queued: true,
      };
    }

    // Evaluate conditions
    if (triggerConfig.conditions && triggerConfig.conditions.length > 0) {
      const conditionsMet = await evaluateConditions(
        triggerConfig.conditions,
        triggerConfig.conditionLogic || 'AND',
        inspection
      );

      if (!conditionsMet) {
        return {
          success: false,
          queued: false,
          error: 'Trigger conditions not met',
        };
      }
    }

    // Send communication
    if (triggerConfig.communicationType === 'EMAIL') {
      if (!triggerConfig.emailTo || triggerConfig.emailTo.length === 0) {
        return {
          success: false,
          queued: false,
          error: 'No email recipients specified',
        };
      }

      const result = await sendAutomationEmail({
        inspectionId,
        to: triggerConfig.emailTo,
        cc: triggerConfig.emailCc,
        bcc: triggerConfig.emailBcc,
        from: triggerConfig.emailFrom || 'COMPANY',
        subject: triggerConfig.emailSubject || '',
        body: triggerConfig.emailBody || '',
      });

      if (!result.success) {
        return {
          success: false,
          queued: false,
          error: result.error || 'Failed to send email',
        };
      }
    } else if (triggerConfig.communicationType === 'TEXT') {
      if (!triggerConfig.emailTo || triggerConfig.emailTo.length === 0) {
        return {
          success: false,
          queued: false,
          error: 'No SMS recipients specified',
        };
      }

      const result = await sendAutomationSMS({
        inspectionId,
        to: triggerConfig.emailTo, // Reused field for SMS recipients
        body: triggerConfig.emailBody || '',
      });

      if (!result.success) {
        return {
          success: false,
          queued: false,
          error: result.error || 'Failed to send SMS',
        };
      }
    }

    // Update trigger status in inspection
    await updateTriggerStatus(inspectionId, triggerIndex, 'sent', new Date());

    return {
      success: true,
      queued: false,
    };
  } catch (error: any) {
    console.error('Error processing trigger:', error);
    return {
      success: false,
      queued: false,
      error: error.message || 'Failed to process trigger',
    };
  }
}

/**
 * Updates trigger status in the inspection document
 */
async function updateTriggerStatus(
  inspectionId: string | mongoose.Types.ObjectId,
  triggerIndex: number,
  status: 'sent' | 'bounced',
  sentAt: Date
): Promise<void> {
  try {
    const inspection = await Inspection.findById(inspectionId);
    if (!inspection || !inspection.triggers || !inspection.triggers[triggerIndex]) {
      return;
    }

    inspection.triggers[triggerIndex].status = status;
    inspection.triggers[triggerIndex].sentAt = sentAt;

    await inspection.save();
  } catch (error) {
    console.error('Error updating trigger status:', error);
  }
}

/**
 * Checks if a trigger was already sent (for onlyTriggerOnce)
 */
export async function wasTriggerAlreadySent(
  inspectionId: string | mongoose.Types.ObjectId,
  actionId: mongoose.Types.ObjectId
): Promise<boolean> {
  try {
    const inspection = await Inspection.findById(inspectionId).lean();
    if (!inspection || !inspection.triggers) {
      return false;
    }

    const trigger = inspection.triggers.find(
      (t: any) => t.actionId && t.actionId.toString() === actionId.toString()
    );

    return trigger?.sentAt ? true : false;
  } catch (error) {
    console.error('Error checking trigger status:', error);
    return false;
  }
}

