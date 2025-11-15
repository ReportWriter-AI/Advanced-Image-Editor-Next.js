import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAgreement extends Document {
  name: string;
  content: string;
  company: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AgreementSchema = new Schema<IAgreement>(
  {
    name: {
      type: String,
      required: [true, 'Agreement name is required'],
      trim: true,
    },
    content: {
      type: String,
      required: [true, 'Agreement content is required'],
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
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

AgreementSchema.index({ company: 1, name: 1 });

const Agreement: Model<IAgreement> =
  mongoose.models.Agreement || mongoose.model<IAgreement>('Agreement', AgreementSchema);

export default Agreement;


