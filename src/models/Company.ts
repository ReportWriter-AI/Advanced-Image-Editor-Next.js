import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICompany extends Document {
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  createdBy?: mongoose.Types.ObjectId;
  address?: string;
  country?: string;
  state?: string;
  city?: string;
  zip?: string;
  displayAddressPublicly: boolean;
  phone?: string;
  website?: string;
  email?: string;
  description?: string;
  videoUrl?: string;
  serviceOffered?: string;
  serviceArea?: string;
  logoUrl?: string;
  headerLogoUrl?: string;
  agreementSignatureType?: 'checkbox' | 'written';
  agreementClientInstructions?: string;
  availabilityViewMode?: 'openSchedule' | 'timeSlots';
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
    address: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    zip: {
      type: String,
      trim: true,
    },
    displayAddressPublicly: {
      type: Boolean,
      default: false,
    },
    phone: {
      type: String,
      trim: true,
    },
    website: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    description: {
      type: String,
    },
    videoUrl: {
      type: String,
      trim: true,
    },
    serviceOffered: {
      type: String,
      trim: true,
    },
    serviceArea: {
      type: String,
      trim: true,
    },
    logoUrl: {
      type: String,
      trim: true,
    },
    headerLogoUrl: {
      type: String,
      trim: true,
    },
    agreementSignatureType: {
      type: String,
      enum: ['checkbox', 'written'],
      default: 'checkbox',
    },
    agreementClientInstructions: {
      type: String,
      default: 'Please read through and sign:',
    },
    availabilityViewMode: {
      type: String,
      enum: ['openSchedule', 'timeSlots'],
      default: 'openSchedule',
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

export const Company: Model<ICompany> =
  mongoose.models.Company || mongoose.model<ICompany>('Company', CompanySchema);

export default Company;

