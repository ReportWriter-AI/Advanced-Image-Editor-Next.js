import mongoose from 'mongoose';
import OrderIdCounter from '@/src/models/OrderIdCounter';
import Inspection from '@/src/models/Inspection';
import Service from '@/src/models/Service';
import AutomationAction from '@/src/models/AutomationAction';
import { generateSecureToken } from '@/src/lib/token-utils';
import { evaluateConditions } from '@/src/lib/automation-executor';

/**
 * Processes post-creation tasks for an inspection:
 * - Generates Order ID using OrderIdCounter
 * - Generates unique token for client view access
 * - Collects agreements from services and saves them to inspection
 * 
 * @param inspectionId - The ID of the created inspection
 * @param companyId - The company ID for Order ID generation
 * @param services - Array of services with serviceId
 * @returns Object containing generated orderId and token (if successful)
 */
export async function processInspectionPostCreation(
  inspectionId: string | mongoose.Types.ObjectId,
  companyId: string | mongoose.Types.ObjectId,
  services: Array<{ serviceId: string }>
): Promise<{
  orderId?: number;
  token?: string;
}> {
  const result: { orderId?: number; token?: string } = {};

  // Ensure inspectionId is valid
  if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
    console.error('Invalid inspection ID for post-creation processing');
    return result;
  }

  const inspectionObjectId = new mongoose.Types.ObjectId(inspectionId);
  const companyObjectId = new mongoose.Types.ObjectId(companyId);

  // 1. Generate Order ID using OrderIdCounter with retry logic for duplicate key errors
  let orderIdAttempts = 0;
  const maxOrderIdAttempts = 5;
  let orderIdGenerated = false;

  while (orderIdAttempts < maxOrderIdAttempts && !orderIdGenerated) {
    try {
      // Increment counter and get new orderId
      const counter = await OrderIdCounter.findOneAndUpdate(
        { company: companyObjectId },
        { $inc: { lastOrderId: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const newOrderId = counter.lastOrderId;

      // Check if this orderId already exists in the database
      const existingInspection = await Inspection.findOne({ orderId: newOrderId });
      if (existingInspection) {
        orderIdAttempts++;
        console.warn(
          `OrderId ${newOrderId} already exists. Retrying with next orderId (attempt ${orderIdAttempts}/${maxOrderIdAttempts})`
        );
        continue; // Retry with next orderId
      }

      // Update inspection with orderId
      try {
        await Inspection.findByIdAndUpdate(inspectionObjectId, {
          orderId: newOrderId,
        });
        result.orderId = newOrderId;
        orderIdGenerated = true;
      } catch (updateError: any) {
        // Check if it's a duplicate key error
        if (updateError.code === 11000) {
          orderIdAttempts++;
          console.warn(
            `Duplicate key error for orderId ${newOrderId}. Retrying with next orderId (attempt ${orderIdAttempts}/${maxOrderIdAttempts})`
          );
          // Continue loop to retry with next orderId
          continue;
        } else {
          // Different error, throw it
          throw updateError;
        }
      }
    } catch (error: any) {
      // Check if it's a duplicate key error from the counter update
      if (error.code === 11000) {
        orderIdAttempts++;
        console.warn(
          `Duplicate key error during orderId generation. Retrying (attempt ${orderIdAttempts}/${maxOrderIdAttempts})`
        );
        continue;
      } else {
        // Different error, log and break
        console.error('Error generating Order ID:', error);
        break;
      }
    }
  }

  if (!orderIdGenerated) {
    console.error(
      `Failed to generate unique orderId after ${maxOrderIdAttempts} attempts. Continuing without orderId.`
    );
    // Continue without orderId if generation fails - it's non-critical
  }

  // 2. Generate unique token for client view access
  let token: string | undefined = undefined;
  let tokenGenerationAttempts = 0;
  const maxTokenAttempts = 5;
  
  while (tokenGenerationAttempts < maxTokenAttempts) {
    try {
      const generatedToken = generateSecureToken();
      // Check if token already exists
      const existingInspection = await Inspection.findOne({ token: generatedToken });
      if (!existingInspection) {
        token = generatedToken;
        break;
      }
      tokenGenerationAttempts++;
    } catch (error) {
      console.error('Error generating token:', error);
      tokenGenerationAttempts++;
    }
  }
  
  if (token) {
    result.token = token;
    // Update inspection with token
    try {
      await Inspection.findByIdAndUpdate(inspectionObjectId, {
        token: token,
      });
    } catch (error) {
      console.error('Error saving token to inspection:', error);
    }
  } else {
    console.error('Failed to generate unique token after multiple attempts');
    // Continue without token - token is optional
  }

  // 3. Collect unique agreements from services
  if (services.length > 0) {
    try {
      const uniqueAgreementIds = new Set<string>();
      
      // Get all service IDs from the inspection
      const serviceIds = services
        .map((s) => s.serviceId)
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      if (serviceIds.length > 0) {
        // Fetch all services to get their agreementIds
        const fetchedServices = await Service.find({
          _id: { $in: serviceIds },
        }).select('agreementIds').lean();

        // Collect agreementIds from main services
        fetchedServices.forEach((service: any) => {
          if (service.agreementIds && Array.isArray(service.agreementIds)) {
            service.agreementIds.forEach((agreementId: any) => {
              if (agreementId && mongoose.Types.ObjectId.isValid(agreementId)) {
                uniqueAgreementIds.add(agreementId.toString());
              }
            });
          }
        });

        // Update inspection with unique agreement IDs (with isSigned: false by default)
        if (uniqueAgreementIds.size > 0) {
          const agreementObjects = Array.from(uniqueAgreementIds).map(
            (id: string) => ({
              agreementId: new mongoose.Types.ObjectId(id),
              isSigned: false,
            })
          );
          
          // Fetch the document first to ensure proper schema handling
          const inspectionDoc = await Inspection.findById(inspectionObjectId);
          if (inspectionDoc) {
            inspectionDoc.agreements = agreementObjects;
            await inspectionDoc.save();
          }
        }
      }
    } catch (error) {
      console.error('Error collecting agreements from services:', error);
      // Don't fail the inspection creation if agreement collection fails
    }
  }

  return result;
}

/**
 * Attaches active automation actions to an inspection.
 * Fetches all active automation actions for the company and stores them in the inspection's triggers field.
 * Only attaches actions whose conditions match the inspection data.
 * 
 * @param inspectionId - The ID of the inspection
 * @param companyId - The company ID to filter automation actions
 */
export async function attachAutomationActionsToInspection(
  inspectionId: string | mongoose.Types.ObjectId,
  companyId: string | mongoose.Types.ObjectId
): Promise<void> {
  // Ensure inspectionId is valid
  if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
    console.error('Invalid inspection ID for attaching automation actions');
    return;
  }

  // Ensure companyId is valid
  if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
    console.error('Invalid company ID for attaching automation actions');
    return;
  }

  const inspectionObjectId = new mongoose.Types.ObjectId(inspectionId);
  const companyObjectId = new mongoose.Types.ObjectId(companyId);

  try {
    // Fetch the inspection with necessary data for condition evaluation
    // Use lean() to get plain JavaScript object for condition evaluation
    const inspection = await Inspection.findById(inspectionObjectId)
      .populate('clients', 'categories')
      .populate('agents', 'categories')
      .populate('listingAgent', 'categories')
      .lean();

    if (!inspection) {
      console.error('Inspection not found for attaching automation actions');
      return;
    }

    // Fetch all active automation actions for the company
    const activeActions = await AutomationAction.find({
      company: companyObjectId,
      isActive: true,
    }).lean();

    if (activeActions.length === 0) {
      // No active actions to attach
      return;
    }

    // Filter actions by evaluating their conditions
    const matchingActions = [];
    for (const action of activeActions) {
      try {
        // If action has no conditions, always attach (existing behavior)
        if (!action.conditions || action.conditions.length === 0) {
          matchingActions.push(action);
          continue;
        }

        // Evaluate conditions against inspection data
        const conditionLogic = action.conditionLogic || 'AND';
        const conditionsMatch = await evaluateConditions(
          action.conditions || [],
          conditionLogic,
          inspection
        );

        // Only include actions whose conditions match
        if (conditionsMatch) {
          matchingActions.push(action);
        }
      } catch (error) {
        // If condition evaluation fails, skip the action (fail-safe approach)
        console.error(`Error evaluating conditions for action ${action._id}:`, error);
        // Don't attach actions with evaluation errors
      }
    }

    // Map matching actions to trigger objects
    const triggers = matchingActions.map((action: any) => ({
      actionId: action._id,
      name: action.name || '',
      automationTrigger: action.automationTrigger || '',
      communicationType: action.communicationType,
      conditions: action.conditions || [],
      conditionLogic: action.conditionLogic,
      sendTiming: action.sendTiming,
      sendDelay: action.sendDelay,
      sendDelayUnit: action.sendDelayUnit,
      onlyTriggerOnce: action.onlyTriggerOnce,
      // alsoSendOnRecurringInspections: action.alsoSendOnRecurringInspections,
      sendEvenWhenNotificationsDisabled: action.sendEvenWhenNotificationsDisabled,
      sendDuringCertainHoursOnly: action.sendDuringCertainHoursOnly,
      startTime: action.startTime,
      endTime: action.endTime,
      doNotSendOnWeekends: action.doNotSendOnWeekends,
      emailTo: action.emailTo || [],
      emailCc: action.emailCc || [],
      emailBcc: action.emailBcc || [],
      emailFrom: action.emailFrom,
      emailSubject: action.emailSubject || '',
      emailBody: action.emailBody || '',
      // sentAt and status are initially undefined, will be set when email is sent
      sentAt: undefined,
      status: undefined,
    }));

    // Update inspection with triggers array (only matching actions)
    await Inspection.findByIdAndUpdate(inspectionObjectId, {
      triggers: triggers,
    });
  } catch (error) {
    console.error('Error attaching automation actions to inspection:', error);
    // Don't fail the inspection creation if automation attachment fails
  }
}

