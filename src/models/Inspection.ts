import mongoose, { Schema, Document, Model } from 'mongoose';
import './DiscountCode';
import './Service';
import './Agreement';
import './Client';
import './Company';

export interface IInspection extends Document {
  status: string;
  date: Date;
  companyId: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  inspector?: mongoose.Types.ObjectId;
  companyOwnerRequested?: boolean;
  requestedAddons?: Array<{
    serviceId: mongoose.Types.ObjectId;
    addonName: string;
    addFee?: number;
    addHours?: number;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: Date;
    processedAt?: Date;
    processedBy?: mongoose.Types.ObjectId;
  }>;
  discountCode?: mongoose.Types.ObjectId;
  location?: {
    address?: string;
    unit?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    squareFeet?: number;
    yearBuild?: number;
    foundation?: string;
  };
  headerImage?: string;
  headerText?: string;
  headerName?: string;
  headerAddress?: string;
  pdfReportUrl?: string;
  htmlReportUrl?: string;
  pdfReportGeneratedAt?: Date;
  htmlReportGeneratedAt?: Date;
  hidePricing?: boolean;
  requirePaymentToReleaseReports?: boolean;
  paymentNotes?: string;
  isPaid?: boolean;
  paymentInfo?: {
    stripePaymentIntentId?: string;
    stripeSessionId?: string;
    amountPaid?: number;
    paidAt?: Date;
    currency?: string;
    paymentMethod?: string;
  };
  paymentHistory?: Array<{
    amount: number;
    paidAt: Date;
    stripePaymentIntentId?: string;
    currency?: string;
    paymentMethod?: string;
  }>;
  agents?: mongoose.Types.ObjectId[];
  listingAgent?: mongoose.Types.ObjectId[];
  people?: mongoose.Types.ObjectId[];
  clients?: mongoose.Types.ObjectId[];
  agreements?: Array<{
    agreementId: mongoose.Types.ObjectId;
    isSigned: boolean;
    inputData?: Record<string, string>;
  }>;
  orderId?: number;
  referralSource?: string;
  confirmedInspection?: boolean;
  disableAutomatedNotifications?: boolean;
  internalNotes?: string;
  clientNote?: string;
  cancellationReason?: string;
  cancelInspection?: boolean;
  clientAgreedToTerms?: boolean;
  token?: string;
  customData?: Record<string, any>;
  closingDate?: {
    date?: Date;
    lastModifiedBy?: mongoose.Types.ObjectId;
    lastModifiedAt?: Date;
  };
  endOfInspectionPeriod?: {
    date?: Date;
    lastModifiedBy?: mongoose.Types.ObjectId;
    lastModifiedAt?: Date;
  };
  inspectionEndTime?: {
    date?: Date;
    lastModifiedBy?: mongoose.Types.ObjectId;
    lastModifiedAt?: Date;
  };
  officeNotes?: Array<{
    _id: mongoose.Types.ObjectId;
    content: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
  }>;
  additionalDocuments?: Array<{
    _id?: mongoose.Types.ObjectId;
    name: string;
    url: string;
    isInternalOnly: boolean;
    uploadedAt?: Date;
    uploadedBy?: mongoose.Types.ObjectId;
  }>;
  pricing?: {
    items: Array<{
      type: 'service' | 'addon' | 'additional';
      serviceId?: mongoose.Types.ObjectId;
      addonName?: string;
      name: string;
      price: number;
      originalPrice?: number;
      hours?: number;
    }>;
  };
  triggers?: Array<{
    actionId: mongoose.Types.ObjectId;
    name: string;
    automationTrigger: string;
    communicationType?: 'EMAIL' | 'TEXT';
    conditions?: Array<{
      type: string;
      operator: string;
      value?: string;
      serviceId?: mongoose.Types.ObjectId;
      addonName?: string;
      serviceCategory?: string;
      categoryId?: mongoose.Types.ObjectId;
      yearBuild?: number;
      foundation?: string;
      squareFeet?: number;
      zipCode?: string;
      city?: string;
      state?: string;
    }>;
    conditionLogic?: 'AND' | 'OR';
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
    sentAt?: Date;
    status?: 'sent' | 'bounced';
    isDisabled?: boolean;
  }>;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InspectionSchema = new Schema<IInspection>(
  {
    status: {
      type: String,
      default: 'Pending',
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    inspector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    companyOwnerRequested: {
      type: Boolean,
      default: false,
    },
    requestedAddons: [{
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true,
      },
      addonName: {
        type: String,
        required: true,
        trim: true,
      },
      addFee: {
        type: Number,
      },
      addHours: {
        type: Number,
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
        required: true,
      },
      requestedAt: {
        type: Date,
        default: Date.now,
        required: true,
      },
      processedAt: {
        type: Date,
      },
      processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    }],
    discountCode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DiscountCode',
    },
    location: {
      address: {
        type: String,
        trim: true,
      },
      unit: {
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
      zip: {
        type: String,
        trim: true,
      },
      county: {
        type: String,
        trim: true,
      },
      squareFeet: {
        type: Number,
      },
      yearBuild: {
        type: Number,
      },
      foundation: {
        type: String,
        trim: true,
      },
    },
    headerImage: {
      type: String,
      trim: true,
    },
    headerText: {
      type: String,
      trim: true,
    },
    headerName: {
      type: String,
      trim: true,
    },
    headerAddress: {
      type: String,
      trim: true,
    },
    pdfReportUrl: {
      type: String,
      trim: true,
    },
    htmlReportUrl: {
      type: String,
      trim: true,
    },
    pdfReportGeneratedAt: {
      type: Date,
    },
    htmlReportGeneratedAt: {
      type: Date,
    },
    hidePricing: {
      type: Boolean,
      default: false,
    },
    requirePaymentToReleaseReports: {
      type: Boolean,
      default: true,
    },
    paymentNotes: {
      type: String,
      trim: true,
    },
    isPaid: {
      type: Boolean,
      default: false,
    },
    paymentInfo: {
      stripePaymentIntentId: {
        type: String,
        trim: true,
      },
      stripeSessionId: {
        type: String,
        trim: true,
      },
      amountPaid: {
        type: Number,
      },
      paidAt: {
        type: Date,
      },
      currency: {
        type: String,
        default: 'usd',
        trim: true,
      },
      paymentMethod: {
        type: String,
        trim: true,
      },
    },
    paymentHistory: [{
      amount: {
        type: Number,
        required: true,
      },
      paidAt: {
        type: Date,
        required: true,
        default: Date.now,
      },
      stripePaymentIntentId: {
        type: String,
        trim: true,
      },
      currency: {
        type: String,
        default: 'usd',
        trim: true,
      },
      paymentMethod: {
        type: String,
        trim: true,
      },
    }],
    agents: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
    }],
    listingAgent: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
    }],
    people: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Person',
    }],
    clients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
    }],
    agreements: [{
      agreementId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Agreement',
        required: true,
      },
      isSigned: {
        type: Boolean,
        default: false,
      },
      inputData: {
        type: Map,
        of: String,
        default: {},
      },
    }],
    orderId: {
      type: Number,
      unique: true,
      sparse: true,
      index: true,
    },
    referralSource: {
      type: String,
      trim: true,
    },
    confirmedInspection: {
      type: Boolean,
      default: true,
    },
    disableAutomatedNotifications: {
      type: Boolean,
      default: false,
    },
    internalNotes: {
      type: String,
      trim: true,
    },
    clientNote: {
      type: String,
      trim: true,
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    cancelInspection: {
      type: Boolean,
      default: false,
    },
    clientAgreedToTerms: {
      type: Boolean,
      default: false,
    },
    token: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    customData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    closingDate: {
      date: {
        type: Date,
      },
      lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      lastModifiedAt: {
        type: Date,
      },
    },
    endOfInspectionPeriod: {
      date: {
        type: Date,
      },
      lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      lastModifiedAt: {
        type: Date,
      },
    },
    inspectionEndTime: {
      date: {
        type: Date,
      },
      lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      lastModifiedAt: {
        type: Date,
      },
    },
    officeNotes: [{
      content: {
        type: String,
        required: true,
        trim: true,
      },
      createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    }],
    additionalDocuments: [{
      name: {
        type: String,
        required: true,
        trim: true,
      },
      url: {
        type: String,
        required: true,
        trim: true,
      },
      isInternalOnly: {
        type: Boolean,
        default: false,
      },
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    }],
    pricing: {
      items: [{
        type: {
          type: String,
          enum: ['service', 'addon', 'additional'],
          required: true,
        },
        serviceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Service',
        },
        addonName: {
          type: String,
          trim: true,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        originalPrice: {
          type: Number,
          min: 0,
        },
        hours: {
          type: Number,
          min: 0,
        },
      }],
    },
    triggers: [{
      actionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AutomationAction',
        required: true,
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      automationTrigger: {
        type: String,
        required: true,
        trim: true,
      },
      communicationType: {
        type: String,
        enum: ['EMAIL', 'TEXT'],
      },
      conditions: [{
        type: {
          type: String,
          required: true,
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
      }],
      conditionLogic: {
        type: String,
        enum: ['AND', 'OR'],
      },
      sendTiming: {
        type: String,
        enum: ['AFTER', 'BEFORE'],
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
      sentAt: {
        type: Date,
      },
      status: {
        type: String,
        enum: ['sent', 'bounced'],
      },
      isDisabled: {
        type: Boolean,
        default: false,
      },
    }],
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

// Index for efficient queries
InspectionSchema.index({ companyId: 1, updatedAt: -1 });

export const Inspection: Model<IInspection> =
  mongoose.models.Inspection || mongoose.model<IInspection>('Inspection', InspectionSchema);

export default Inspection;

