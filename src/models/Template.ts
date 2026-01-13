import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITemplate extends Document {
  name: string;
  company: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TemplateSchema = new Schema<ITemplate>(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
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

TemplateSchema.index({ company: 1, name: 1 });
TemplateSchema.index({ company: 1, createdAt: -1 });

export const Template: Model<ITemplate> =
  mongoose.models.Template || mongoose.model<ITemplate>('Template', TemplateSchema);

export default Template;
