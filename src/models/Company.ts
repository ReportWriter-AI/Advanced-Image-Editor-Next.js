import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICompany extends Document {
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CompanySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
    },
    plan: {
      type: String,
      enum: ['free', 'pro', 'enterprise'],
      default: 'free',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

export const Company: Model<ICompany> =
  mongoose.models.Company || mongoose.model<ICompany>('Company', CompanySchema);

export default Company;

