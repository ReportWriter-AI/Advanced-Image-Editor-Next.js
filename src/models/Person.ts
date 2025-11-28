import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPerson extends Document {
  isCompany: boolean;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  ccEmail?: string;
  phone?: string;
  homePhone?: string;
  mobilePhone?: string;
  personCompany?: string;
  role?: 'Attorney' | 'Insurance agent' | 'Transaction coordinator' | 'Title company' | 'Other';
  categories: mongoose.Types.ObjectId[];
  internalNotes?: string;
  internalAdminNotes?: string;
  company: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PersonSchema = new Schema<IPerson>(
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
    personCompany: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ['Attorney', 'Insurance agent', 'Transaction coordinator', 'Title company', 'Other'],
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

PersonSchema.index({ company: 1 });
PersonSchema.index({ email: 1 });
PersonSchema.index({ categories: 1 });

const Person: Model<IPerson> = mongoose.models.Person || mongoose.model<IPerson>('Person', PersonSchema);

export default Person;

