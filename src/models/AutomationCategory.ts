import mongoose, { Schema, Document, Model } from 'mongoose';

export type AutomationType =
  | 'Scheduling'
  | 'Rescheduling'
  | 'Publishing'
  | 'Informational - Pre-Inspection'
  | 'Upsell - Pre-Inspection'
  | 'Informational - Post-Inspection'
  | 'Upsell - Post-Inspection'
  | 'Inspector'
  | 'Staff'
  | '3rd Party'
  | 'Other';

export interface IAutomationCategory extends Document {
  name: string;
  automationType?: AutomationType;
  company: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AutomationCategorySchema = new Schema<IAutomationCategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    automationType: {
      type: String,
      enum: [
        'Scheduling',
        'Rescheduling',
        'Publishing',
        'Informational - Pre-Inspection',
        'Upsell - Pre-Inspection',
        'Informational - Post-Inspection',
        'Upsell - Post-Inspection',
        'Inspector',
        'Staff',
        '3rd Party',
        'Other',
      ],
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

AutomationCategorySchema.index({ company: 1 });

export const AutomationCategory: Model<IAutomationCategory> =
  mongoose.models.AutomationCategory ||
  mongoose.model<IAutomationCategory>('AutomationCategory', AutomationCategorySchema);

export default AutomationCategory;

