import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClient extends Document {
  isCompany: boolean;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  ccEmail?: string;
  phone?: string;
  homePhone?: string;
  mobilePhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  categories: mongoose.Types.ObjectId[];
  internalNotes?: string;
  internalAdminNotes?: string;
  excludeFromMassEmail: boolean;
  unsubscribedFromMassEmails: boolean;
  company: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ClientSchema = new Schema<IClient>(
  {
    isCompany: {
      type: Boolean,
      default: false,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    companyName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    ccEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    homePhone: {
      type: String,
      trim: true,
    },
    mobilePhone: {
      type: String,
      trim: true,
    },
    address: {
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
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],
    internalNotes: {
      type: String,
    },
    internalAdminNotes: {
      type: String,
    },
    excludeFromMassEmail: {
      type: Boolean,
      default: false,
    },
    unsubscribedFromMassEmails: {
      type: Boolean,
      default: false,
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
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

ClientSchema.index({ company: 1 });
ClientSchema.index({ email: 1 });
ClientSchema.index({ categories: 1 });
ClientSchema.index({ excludeFromMassEmail: 1 });
ClientSchema.index({ unsubscribedFromMassEmails: 1 });

const Client: Model<IClient> = mongoose.models.Client || mongoose.model<IClient>('Client', ClientSchema);

export default Client;

