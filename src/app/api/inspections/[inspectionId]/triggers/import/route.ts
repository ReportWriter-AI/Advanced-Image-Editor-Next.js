import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Inspection from '@/src/models/Inspection';
import AutomationAction from '@/src/models/AutomationAction';
import { evaluateConditions } from '@/src/lib/automation-executor';

interface RouteParams {
  params: Promise<{
    inspectionId: string;
  }>;
}

export async function POST(
  request: NextRequest,
  context: RouteParams
) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId } = await context.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: 'Invalid inspection ID' },
        { status: 400 }
      );
    }

    if (!currentUser.company) {
      return NextResponse.json(
        { error: 'No company associated with current user' },
        { status: 400 }
      );
    }

    const inspectionObjectId = new mongoose.Types.ObjectId(inspectionId);
    const companyObjectId = new mongoose.Types.ObjectId(currentUser.company);

    // Fetch the inspection with necessary data for condition evaluation
    const inspection = await Inspection.findById(inspectionObjectId)
      .populate('clients', 'categories')
      .populate('agents', 'categories')
      .populate('listingAgent', 'categories')
      .lean();

    if (!inspection) {
      return NextResponse.json(
        { error: 'Inspection not found' },
        { status: 404 }
      );
    }

    // Verify the inspection belongs to the user's company
    if (inspection.companyId.toString() !== companyObjectId.toString()) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get existing trigger actionIds to filter out already attached actions
    const existingActionIds = new Set(
      (inspection.triggers || []).map((t: any) => 
        t.actionId ? t.actionId.toString() : null
      ).filter(Boolean)
    );

    // Fetch all active automation actions for the company
    const activeActions = await AutomationAction.find({
      company: companyObjectId,
      isActive: true,
    }).lean();

    if (activeActions.length === 0) {
      return NextResponse.json({
        message: 'No active actions available',
        importedCount: 0,
      });
    }

    // Filter out actions already attached to the inspection
    const newActions = activeActions.filter(
      (action) => !existingActionIds.has(action._id.toString())
    );

    if (newActions.length === 0) {
      return NextResponse.json({
        message: 'No new actions to import',
        importedCount: 0,
      });
    }

    // Evaluate conditions for new actions and filter matching ones
    const matchingActions = [];
    for (const action of newActions) {
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

    if (matchingActions.length === 0) {
      return NextResponse.json({
        message: 'No matching actions found',
        importedCount: 0,
      });
    }

    // Map matching actions to trigger objects
    const newTriggers = matchingActions.map((action: any) => ({
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

    // Merge new triggers with existing triggers (don't overwrite)
    const existingTriggers = inspection.triggers || [];
    const updatedTriggers = [...existingTriggers, ...newTriggers];

    // Update inspection with merged triggers array
    await Inspection.findByIdAndUpdate(inspectionObjectId, {
      triggers: updatedTriggers,
    });

    return NextResponse.json({
      message: `${matchingActions.length} action(s) imported successfully`,
      importedCount: matchingActions.length,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error importing actions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import actions' },
      { status: 500 }
    );
  }
}

