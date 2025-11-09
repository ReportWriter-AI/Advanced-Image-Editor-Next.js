import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISampleReport extends Document {
  company: mongoose.Types.ObjectId;
  title: string;
  url: string;
  order: number;
  description?: string;
  inspectionId?: string;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SampleReportSchema = new Schema<ISampleReport>(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    url: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 4000,
    },
    inspectionId: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

SampleReportSchema.index({ company: 1, order: 1 });

export const SampleReport: Model<ISampleReport> =
  mongoose.models.SampleReport ||
  mongoose.model<ISampleReport>('SampleReport', SampleReportSchema);

export default SampleReport;


