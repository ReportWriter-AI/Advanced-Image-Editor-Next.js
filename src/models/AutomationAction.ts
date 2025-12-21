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
  | 'LISTING_AGENT_CATEGORY'
  | 'ALL_REPORTS'
  | 'ANY_REPORTS'
  | 'YEAR_BUILD'
  | 'FOUNDATION'
  | 'SQUARE_FEET'
  | 'ZIP_CODE'
  | 'CITY'
  | 'STATE';

export interface IAutomationCondition {
  type: ConditionType;
  operator: string;
  value?: string; // For EVENT_NAME
  serviceId?: mongoose.Types.ObjectId; // For SERVICE and ADDONS
  addonName?: string; // For ADDONS
  serviceCategory?: string; // For SERVICE_CATEGORY
  categoryId?: mongoose.Types.ObjectId; // For CLIENT_CATEGORY, CLIENT_AGENT_CATEGORY, LISTING_AGENT_CATEGORY
  yearBuild?: number; // For YEAR_BUILD
  foundation?: string; // For FOUNDATION
  squareFeet?: number; // For SQUARE_FEET
  zipCode?: string; // For ZIP_CODE
  city?: string; // For CITY
  state?: string; // For STATE
}

export interface IAutomationAction extends Document {
  name: string;
  category: mongoose.Types.ObjectId;
  automationTrigger: string;
  isActive: boolean;
  conditions?: IAutomationCondition[];
  conditionLogic?: 'AND' | 'OR';
  communicationType?: 'EMAIL' | 'TEXT';
  sendTiming?: 'AFTER' | 'BEFORE';
  sendDelay?: number;
  sendDelayUnit?: 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS' | 'MONTHS';
  onlyTriggerOnce?: boolean;
  // alsoSendOnRecurringInspections?: boolean;
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
        'ALL_REPORTS',
        'ANY_REPORTS',
        'YEAR_BUILD',
        'FOUNDATION',
        'SQUARE_FEET',
        'ZIP_CODE',
        'CITY',
        'STATE',
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
    yearBuild: {
      type: Number,
    },
    foundation: {
      type: String,
      trim: true,
    },
    squareFeet: {
      type: Number,
    },
    zipCode: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
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
    communicationType: {
      type: String,
      enum: ['EMAIL', 'TEXT'],
    },
    sendTiming: {
      type: String,
      enum: ['AFTER', 'BEFORE'],
      default: 'AFTER',
    },
    sendDelay: {
      type: Number,
      min: 0,
    },
    sendDelayUnit: {
      type: String,
      enum: ['MINUTES', 'HOURS', 'DAYS', 'WEEKS', 'MONTHS'],
    },
    onlyTriggerOnce: {
      type: Boolean,
      default: false,
    },
    // alsoSendOnRecurringInspections: {
    //   type: Boolean,
    //   default: false,
    // },
    sendEvenWhenNotificationsDisabled: {
      type: Boolean,
      default: false,
    },
    sendDuringCertainHoursOnly: {
      type: Boolean,
      default: false,
    },
    startTime: {
      type: String,
      trim: true,
    },
    endTime: {
      type: String,
      trim: true,
    },
    doNotSendOnWeekends: {
      type: Boolean,
      default: false,
    },
    emailTo: {
      type: [String],
      default: [],
    },
    emailCc: {
      type: [String],
      default: [],
    },
    emailBcc: {
      type: [String],
      default: [],
    },
    emailFrom: {
      type: String,
      enum: ['COMPANY', 'INSPECTOR'],
    },
    emailSubject: {
      type: String,
      trim: true,
    },
    emailBody: {
      type: String,
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
