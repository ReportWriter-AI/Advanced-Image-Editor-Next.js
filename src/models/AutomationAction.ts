import mongoose, { Schema, Document, Model } from 'mongoose';

export type ConditionType =
  | 'INSPECTION'
  | 'AGREEMENT'
  | 'EVENT_NAME'
  | 'SERVICE'
  | 'ADDONS'
  | 'SERVICE_CATEGORY'
  | 'CLIENT_CATEGORY'
  | 'CLIENT_AGENT_CATEGORY'
  | 'LISTING_AGENT_CATEGORY';

export interface IAutomationCondition {
  type: ConditionType;
  operator: string;
  value?: string; // For EVENT_NAME
  serviceId?: mongoose.Types.ObjectId; // For SERVICE and ADDONS
  addonName?: string; // For ADDONS
  serviceCategory?: string; // For SERVICE_CATEGORY
  categoryId?: mongoose.Types.ObjectId; // For CLIENT_CATEGORY, CLIENT_AGENT_CATEGORY, LISTING_AGENT_CATEGORY
}

export interface IAutomationAction extends Document {
  name: string;
  category: mongoose.Types.ObjectId;
  automationTrigger: string;
  isActive: boolean;
  conditions?: IAutomationCondition[];
  conditionLogic?: 'AND' | 'OR';
  company: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationConditionSchema = new Schema<IAutomationCondition>(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'INSPECTION',
        'AGREEMENT',
        'EVENT_NAME',
        'SERVICE',
        'ADDONS',
        'SERVICE_CATEGORY',
        'CLIENT_CATEGORY',
        'CLIENT_AGENT_CATEGORY',
        'LISTING_AGENT_CATEGORY',
      ],
    },
    operator: {
      type: String,
      required: true,
    },
    value: {
      type: String,
      trim: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    },
    addonName: {
      type: String,
      trim: true,
    },
    serviceCategory: {
      type: String,
      trim: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    },
  },
  { _id: false }
);

const AutomationActionSchema = new Schema<IAutomationAction>(
  {
    name: {
      type: String,
      required: [true, 'Action name is required'],
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AutomationCategory',
      required: [true, 'Category is required'],
    },
    automationTrigger: {
      type: String,
      required: [true, 'Automation trigger is required'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    conditions: {
      type: [AutomationConditionSchema],
      default: [],
    },
    conditionLogic: {
      type: String,
      enum: ['AND', 'OR'],
      default: 'AND',
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

AutomationActionSchema.index({ company: 1 });
AutomationActionSchema.index({ category: 1 });

export const AutomationAction: Model<IAutomationAction> =
  mongoose.models.AutomationAction ||
  mongoose.model<IAutomationAction>('AutomationAction', AutomationActionSchema);

export default AutomationAction;
