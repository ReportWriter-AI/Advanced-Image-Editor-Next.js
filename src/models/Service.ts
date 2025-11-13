import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IServiceModifier {
  field: string;
  type?: string;
  greaterThan?: number;
  lessThanOrEqual?: number;
  equals?: string;
  addFee?: number;
  addHours?: number;
}

export interface IServiceAddOn {
  name: string;
  serviceCategory: string;
  description?: string;
  hiddenFromScheduler: boolean;
  baseCost: number;
  baseDurationHours: number;
  defaultInspectionEvents: string[];
  organizationServiceId?: string;
  modifiers: IServiceModifier[];
  allowUpsell: boolean;
  orderIndex: number;
}

export interface IServiceTax {
  name: string;
  addPercent: number;
  orderIndex: number;
}

export interface IService extends Document {
  name: string;
  serviceCategory: string;
  description?: string;
  hiddenFromScheduler: boolean;
  baseCost: number;
  baseDurationHours: number;
  defaultInspectionEvents: string[];
  organizationServiceId?: string;
  modifiers: IServiceModifier[];
  addOns: IServiceAddOn[];
  taxes: IServiceTax[];
  orderIndex: number;
  company: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ModifierSchema = new Schema<IServiceModifier>(
  {
    field: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      trim: true,
    },
    greaterThan: {
      type: Number,
    },
    lessThanOrEqual: {
      type: Number,
    },
    equals: {
      type: String,
      trim: true,
    },
    addFee: {
      type: Number,
    },
    addHours: {
      type: Number,
    },
  },
  { _id: false }
);

const ServiceSchema = new Schema<IService>(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      trim: true,
    },
    serviceCategory: {
      type: String,
      trim: true,
      required: [true, 'Service category is required'],
    },
    description: {
      type: String,
      trim: true,
    },
    hiddenFromScheduler: {
      type: Boolean,
      default: false,
    },
    baseCost: {
      type: Number,
      default: 0,
      min: [0, 'Base cost cannot be negative'],
    },
    baseDurationHours: {
      type: Number,
      default: 0,
      min: [0, 'Base duration cannot be negative'],
    },
    defaultInspectionEvents: {
      type: [String],
      default: [],
      set: (events: string[]) =>
        Array.isArray(events)
          ? events
              .map((event) => (typeof event === 'string' ? event.trim() : ''))
              .filter((event) => event.length > 0)
          : [],
    },
    organizationServiceId: {
      type: String,
      trim: true,
    },
    modifiers: {
      type: [ModifierSchema],
      default: [],
    },
    addOns: {
      type: [
        new Schema<IServiceAddOn>(
          {
            name: {
              type: String,
              required: [true, 'Add-on name is required'],
              trim: true,
            },
            serviceCategory: {
              type: String,
              required: [true, 'Add-on category is required'],
              trim: true,
            },
            description: {
              type: String,
              trim: true,
            },
            hiddenFromScheduler: {
              type: Boolean,
              default: false,
            },
            baseCost: {
              type: Number,
              default: 0,
              min: [0, 'Base cost cannot be negative'],
            },
            baseDurationHours: {
              type: Number,
              default: 0,
              min: [0, 'Base duration cannot be negative'],
            },
            defaultInspectionEvents: {
              type: [String],
              default: [],
              set: (events: string[]) =>
                Array.isArray(events)
                  ? events
                      .map((event) => (typeof event === 'string' ? event.trim() : ''))
                      .filter((event) => event.length > 0)
                  : [],
            },
            organizationServiceId: {
              type: String,
              trim: true,
            },
            modifiers: {
              type: [ModifierSchema],
              default: [],
            },
            allowUpsell: {
              type: Boolean,
              default: false,
            },
            orderIndex: {
              type: Number,
              default: 0,
            },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    taxes: {
      type: [
        new Schema<IServiceTax>(
          {
            name: {
              type: String,
              required: [true, 'Tax name is required'],
              trim: true,
            },
            addPercent: {
              type: Number,
              default: 0,
            },
            orderIndex: {
              type: Number,
              default: 0,
            },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    orderIndex: {
      type: Number,
      default: 0,
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
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

ServiceSchema.pre('save', async function (next) {
  const doc = this as IService & { orderIndex?: number };

  if (
    typeof doc.orderIndex === 'number' &&
    Number.isFinite(doc.orderIndex) &&
    doc.orderIndex > 0
  ) {
    return next();
  }

  try {
    const Model = this.constructor as mongoose.Model<IService>;
    const lastService = await Model.findOne({ company: doc.company })
      .sort({ orderIndex: -1 })
      .select('orderIndex')
      .lean();

    doc.orderIndex =
      typeof lastService?.orderIndex === 'number' && Number.isFinite(lastService.orderIndex)
        ? lastService.orderIndex + 1
        : 1;

    next();
  } catch (error) {
    next(error as Error);
  }
});

ServiceSchema.index({ company: 1, name: 1 });
ServiceSchema.index({ company: 1, orderIndex: 1, createdAt: 1 });

export const Service: Model<IService> =
  mongoose.models.Service || mongoose.model<IService>('Service', ServiceSchema);

export default Service;


