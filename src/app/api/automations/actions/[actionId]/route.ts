import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import AutomationAction from '@/src/models/AutomationAction';
import AutomationCategory from '@/src/models/AutomationCategory';
import Service from '@/src/models/Service';
import Category from '@/src/models/Category';
import { isValidTriggerKey } from '@/src/lib/automation-triggers';
import { validateCondition, isValidServiceCategory } from '@/src/lib/automation-conditions';

interface RouteParams {
  params: Promise<{
    actionId: string;
  }>;
}

async function getAuthorizedAction(actionId: string, userCompanyId?: mongoose.Types.ObjectId) {
  if (!mongoose.Types.ObjectId.isValid(actionId)) {
    return null;
  }

  if (!userCompanyId) {
    return null;
  }

  const action = await AutomationAction.findById(actionId);
  if (!action) {
    return null;
  }

  if (!action.company || !action.company.equals(userCompanyId)) {
    return null;
  }

  return action;
}

export async function GET(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { actionId } = await context.params;
    const action = await getAuthorizedAction(actionId, currentUser.company);
    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    const populatedAction = await AutomationAction.findById(actionId)
      .populate('category', 'name')
      .lean();

    return NextResponse.json({ action: populatedAction });
  } catch (error: any) {
    console.error('Get automation action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch action' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { actionId } = await context.params;
    const action = await getAuthorizedAction(actionId, currentUser.company);
    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, category, automationTrigger, isActive, conditions, conditionLogic } = body;

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return NextResponse.json(
          { error: 'Action name is required' },
          { status: 400 }
        );
      }
      action.name = name.trim();
    }

    if (category !== undefined) {
      if (!category) {
        return NextResponse.json(
          { error: 'Category is required' },
          { status: 400 }
        );
      }

      if (!mongoose.Types.ObjectId.isValid(category)) {
        return NextResponse.json(
          { error: 'Invalid category ID' },
          { status: 400 }
        );
      }

      // Verify category exists and belongs to company
      const categoryDoc = await AutomationCategory.findOne({
        _id: category,
        company: currentUser.company,
      });

      if (!categoryDoc) {
        return NextResponse.json(
          { error: 'Category not found or does not belong to your company' },
          { status: 404 }
        );
      }

      action.category = new mongoose.Types.ObjectId(category);
    }

    if (automationTrigger !== undefined) {
      if (!automationTrigger) {
        return NextResponse.json(
          { error: 'Automation trigger is required' },
          { status: 400 }
        );
      }

      // Validate trigger key
      if (!isValidTriggerKey(automationTrigger)) {
        return NextResponse.json(
          { error: 'Invalid automation trigger' },
          { status: 400 }
        );
      }

      action.automationTrigger = automationTrigger;
    }

    if (isActive !== undefined) {
      action.isActive = Boolean(isActive);
    }

    if (conditions !== undefined) {
      if (!Array.isArray(conditions)) {
        return NextResponse.json(
          { error: 'Conditions must be an array' },
          { status: 400 }
        );
      }

      for (let i = 0; i < conditions.length; i++) {
        const condition = conditions[i];
        const validation = validateCondition(condition);
        if (!validation.valid) {
          return NextResponse.json(
            { error: `Condition ${i + 1}: ${validation.error}` },
            { status: 400 }
          );
        }

        // Validate serviceId if present
        if (condition.serviceId) {
          if (!mongoose.Types.ObjectId.isValid(condition.serviceId)) {
            return NextResponse.json(
              { error: `Condition ${i + 1}: Invalid service ID` },
              { status: 400 }
            );
          }

          const service = await Service.findOne({
            _id: condition.serviceId,
            company: currentUser.company,
          });

          if (!service) {
            return NextResponse.json(
              { error: `Condition ${i + 1}: Service not found or does not belong to your company` },
              { status: 404 }
            );
          }

          // For ADDONS, validate addonName exists in service
          if (condition.type === 'ADDONS' && condition.addonName) {
            const addonExists = service.addOns?.some(
              (addon) => addon.name === condition.addonName
            );
            if (!addonExists) {
              return NextResponse.json(
                { error: `Condition ${i + 1}: Addon not found in selected service` },
                { status: 400 }
              );
            }
          }
        }

        // Validate serviceCategory if present
        if (condition.serviceCategory) {
          if (!isValidServiceCategory(condition.serviceCategory)) {
            return NextResponse.json(
              { error: `Condition ${i + 1}: Invalid service category` },
              { status: 400 }
            );
          }
        }

        // Validate categoryId if present
        if (condition.categoryId) {
          if (!mongoose.Types.ObjectId.isValid(condition.categoryId)) {
            return NextResponse.json(
              { error: `Condition ${i + 1}: Invalid category ID` },
              { status: 400 }
            );
          }

          const categoryDoc = await Category.findOne({
            _id: condition.categoryId,
            company: currentUser.company,
          });

          if (!categoryDoc) {
            return NextResponse.json(
              { error: `Condition ${i + 1}: Category not found or does not belong to your company` },
              { status: 404 }
            );
          }
        }
      }

      action.conditions = conditions.map((cond: any) => ({
        type: cond.type,
        operator: cond.operator,
        value: cond.value?.trim(),
        serviceId: cond.serviceId ? new mongoose.Types.ObjectId(cond.serviceId) : undefined,
        addonName: cond.addonName?.trim(),
        serviceCategory: cond.serviceCategory,
        categoryId: cond.categoryId ? new mongoose.Types.ObjectId(cond.categoryId) : undefined,
      }));
      
      // Set conditionLogic if conditions exist
      if (conditionLogic !== undefined && (conditionLogic === 'AND' || conditionLogic === 'OR')) {
        action.conditionLogic = conditionLogic;
      } else if (conditions.length > 1 && !action.conditionLogic) {
        // Default to AND if multiple conditions but no logic specified
        action.conditionLogic = 'AND';
      } else if (conditions.length === 0) {
        // Clear conditionLogic if no conditions
        action.conditionLogic = undefined;
      }
    } else if (conditions === undefined && conditionLogic !== undefined) {
      // Allow updating conditionLogic even if conditions aren't being updated
      if (conditionLogic === 'AND' || conditionLogic === 'OR') {
        action.conditionLogic = conditionLogic;
      }
    }

    const updatedAction = await action.save();

    const populatedAction = await AutomationAction.findById(updatedAction._id)
      .populate('category', 'name')
      .lean();

    return NextResponse.json({
      message: 'Action updated successfully',
      action: populatedAction,
    });
  } catch (error: any) {
    console.error('Update automation action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update action' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { actionId } = await context.params;
    const action = await getAuthorizedAction(actionId, currentUser.company);
    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    await action.deleteOne();

    return NextResponse.json({ message: 'Action deleted successfully' });
  } catch (error: any) {
    console.error('Delete automation action error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete action' },
      { status: 500 }
    );
  }
}
