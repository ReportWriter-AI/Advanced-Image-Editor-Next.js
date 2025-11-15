import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IModifierField extends Document {
  key: string;
  label: string;
  supportsType: boolean;
  hasEqualsField: boolean;
  requiresRange: boolean;
  group?: 'custom';
  description?: string;
  orderIndex: number;
  company: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ModifierFieldSchema = new Schema<IModifierField>(
  {
    key: {
      type: String,
      required: true,
      trim: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    supportsType: {
      type: Boolean,
      default: false,
    },
    hasEqualsField: {
      type: Boolean,
      default: false,
    },
    requiresRange: {
      type: Boolean,
      default: false,
    },
    group: {
      type: String,
      enum: ['custom'],
    },
    description: {
      type: String,
      trim: true,
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

ModifierFieldSchema.index({ company: 1, key: 1 }, { unique: true });
ModifierFieldSchema.index({ company: 1, orderIndex: 1, createdAt: 1 });

ModifierFieldSchema.pre('save', async function (next) {
  const doc = this as IModifierField & { orderIndex?: number };

  if (typeof doc.orderIndex === 'number' && Number.isFinite(doc.orderIndex) && doc.orderIndex > 0) {
    return next();
  }

  try {
    const Model = this.constructor as mongoose.Model<IModifierField>;
    const last = await Model.findOne({ company: doc.company })
      .sort({ orderIndex: -1 })
      .select('orderIndex')
      .lean();

    doc.orderIndex =
      typeof last?.orderIndex === 'number' && Number.isFinite(last.orderIndex) ? last.orderIndex + 1 : 1;

    next();
  } catch (error) {
    next(error as Error);
  }
});

export const ModifierField: Model<IModifierField> =
  mongoose.models.ModifierField || mongoose.model<IModifierField>('ModifierField', ModifierFieldSchema);

export default ModifierField;


