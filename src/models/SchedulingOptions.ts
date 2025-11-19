import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICustomField {
  _id?: mongoose.Types.ObjectId;
  name: string;
  fieldKey: string; // Unique key for referencing the field
  fieldType: 'Text' | 'Number' | 'Checkbox' | 'Calendar' | 'Paragraph' | 'Dropdown' | 'Date' | 'Date & Time';
  requiredForOnlineScheduler: boolean;
  displayOnSpectoraApp: boolean;
  showInOnlineSchedulerOrGetQuote: boolean;
  calendarIcon?: string;
  dropdownOptions?: string[];
  orderIndex?: number;
}

export interface ISchedulingOptions extends Document {
  company: mongoose.Types.ObjectId;
  inProgressBookingsBlockSchedule: boolean;
  restrictReferralSources: boolean;
  referralSources?: string;
  defaultConfirmed: boolean;
  allowClientCcEmails: boolean;
  captureBuyerAddress: boolean;
  captureClientsAgentAddress: boolean;
  captureListingAgentAddress: boolean;
  customFields?: ICustomField[];
  createdAt: Date;
  updatedAt: Date;
}

const SchedulingOptionsSchema = new Schema<ISchedulingOptions>(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company is required'],
      unique: true,
    },
    inProgressBookingsBlockSchedule: {
      type: Boolean,
      default: false,
    },
    restrictReferralSources: {
      type: Boolean,
      default: false,
    },
    referralSources: {
      type: String,
      trim: true,
    },
    defaultConfirmed: {
      type: Boolean,
      default: false,
    },
    allowClientCcEmails: {
      type: Boolean,
      default: false,
    },
    captureBuyerAddress: {
      type: Boolean,
      default: false,
    },
    captureClientsAgentAddress: {
      type: Boolean,
      default: false,
    },
    captureListingAgentAddress: {
      type: Boolean,
      default: false,
    },
    customFields: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        fieldKey: {
          type: String,
          required: true,
          trim: true,
          unique: true,
        },
        fieldType: {
          type: String,
          enum: ['Text', 'Number', 'Checkbox', 'Calendar', 'Paragraph', 'Dropdown', 'Date', 'Date & Time'],
          required: true,
        },
        requiredForOnlineScheduler: {
          type: Boolean,
          default: false,
        },
        displayOnSpectoraApp: {
          type: Boolean,
          default: true,
        },
        showInOnlineSchedulerOrGetQuote: {
          type: Boolean,
          default: false,
        },
        calendarIcon: {
          type: String,
          trim: true,
        },
        dropdownOptions: [{
          type: String,
          trim: true,
        }],
        orderIndex: {
          type: Number,
          default: 0,
        },
      },
    ],
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

export const SchedulingOptions: Model<ISchedulingOptions> =
  mongoose.models.SchedulingOptions || mongoose.model<ISchedulingOptions>('SchedulingOptions', SchedulingOptionsSchema);

export default SchedulingOptions;

