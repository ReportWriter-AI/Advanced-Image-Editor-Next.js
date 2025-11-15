import mongoose, { Schema, Document, Model } from 'mongoose';

export type DiscountCodeType = 'percent' | 'amount';

export interface IDiscountCodeAddOn {
  service: mongoose.Types.ObjectId;
  addOnName: string;
  addOnOrderIndex?: number;
}

export interface IDiscountCode extends Document {
  code: string;
  type: DiscountCodeType;
  value: number;
  description?: string;
  notes?: string;
  appliesToServices: mongoose.Types.ObjectId[];
  appliesToAddOns: IDiscountCodeAddOn[];
  maxUses?: number | null;
  expirationDate?: Date | null;
  active: boolean;
  usageCount: number;
  company: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AppliesToAddOnSchema = new Schema<IDiscountCodeAddOn>(
  {
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    addOnName: {
      type: String,
      required: true,
      trim: true,
    },
    addOnOrderIndex: {
      type: Number,
    },
  },
  { _id: false }
);

const DiscountCodeSchema = new Schema<IDiscountCode>(
  {
    code: {
      type: String,
      required: [true, 'Discount code is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['percent', 'amount'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: [0, 'Discount value cannot be negative'],
    },
    description: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    appliesToServices: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Service',
        },
      ],
      default: [],
    },
    appliesToAddOns: {
      type: [AppliesToAddOnSchema],
      default: [],
    },
    maxUses: {
      type: Number,
      min: [0, 'Max uses cannot be negative'],
    },
    expirationDate: {
      type: Date,
    },
    active: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
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
    timestamps: true,
  }
);

DiscountCodeSchema.index({ company: 1, code: 1 }, { unique: true });
DiscountCodeSchema.index({ company: 1, active: 1 });
DiscountCodeSchema.index({ company: 1, expirationDate: 1 });

const DiscountCode: Model<IDiscountCode> =
  mongoose.models.DiscountCode || mongoose.model<IDiscountCode>('DiscountCode', DiscountCodeSchema);

export default DiscountCode;


