import mongoose, { Schema, Document, Model } from 'mongoose';

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
  agents?: mongoose.Types.ObjectId[];
  listingAgent?: mongoose.Types.ObjectId[];
  people?: mongoose.Types.ObjectId[];
  clients?: mongoose.Types.ObjectId[];
  orderId?: number;
  referralSource?: string;
  confirmedInspection?: boolean;
  disableAutomatedNotifications?: boolean;
  internalNotes?: string;
  customData?: Record<string, any>;
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
    customData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
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

