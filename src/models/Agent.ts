import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAgent extends Document {
  firstName: string;
  lastName?: string;
  email: string;
  ccEmail?: string;
  phone?: string;
  secondPhone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  birthdayMonth?: string;
  birthdayDay?: number;
  photoUrl?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  websiteUrl?: string;
  categories: mongoose.Types.ObjectId[];
  agency?: mongoose.Types.ObjectId;
  agencyPhone?: string;
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

const AgentSchema = new Schema<IAgent>(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
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
    secondPhone: {
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
    birthdayMonth: {
      type: String,
      enum: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ],
    },
    birthdayDay: {
      type: Number,
      min: 1,
      max: 31,
    },
    photoUrl: {
      type: String,
      trim: true,
    },
    facebookUrl: {
      type: String,
      trim: true,
    },
    linkedinUrl: {
      type: String,
      trim: true,
    },
    twitterUrl: {
      type: String,
      trim: true,
    },
    instagramUrl: {
      type: String,
      trim: true,
    },
    tiktokUrl: {
      type: String,
      trim: true,
    },
    websiteUrl: {
      type: String,
      trim: true,
    },
    categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency',
    },
    agencyPhone: {
      type: String,
      trim: true,
    },
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

AgentSchema.index({ company: 1 });
AgentSchema.index({ email: 1 });
AgentSchema.index({ company: 1, email: 1 }, { unique: true }); // Unique email per company
AgentSchema.index({ categories: 1 });
AgentSchema.index({ agency: 1 });
AgentSchema.index({ excludeFromMassEmail: 1 });
AgentSchema.index({ unsubscribedFromMassEmails: 1 });

const Agent: Model<IAgent> = mongoose.models.Agent || mongoose.model<IAgent>('Agent', AgentSchema);

export default Agent;

