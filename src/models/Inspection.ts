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
  services?: Array<{
    serviceId: mongoose.Types.ObjectId;
    addOns?: Array<{
      name: string;
      addFee?: number;
      addHours?: number;
    }>;
  }>;
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
    foundation?: 'Basement' | 'Slab' | 'Crawlspace';
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
  officeNotes?: Array<{
    _id: mongoose.Types.ObjectId;
    content: string;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
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
    services: [{
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true,
      },
      addOns: [{
        name: {
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
      }],
    }],
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
        enum: ['Basement', 'Slab', 'Crawlspace'],
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

