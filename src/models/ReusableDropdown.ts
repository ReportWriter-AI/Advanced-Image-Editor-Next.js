import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IReusableDropdown extends Document {
  foundation: string;
  role: string;
  referralSources: string;
  location: Array<{ id: string; value: string }>;
  serviceCategory: string;
  defaultDefectColor: string;
  company: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReusableDropdownSchema = new Schema<IReusableDropdown>(
  {
    foundation: {
      type: String,
      default: '',
      trim: true,
    },
    role: {
      type: String,
      default: '',
      trim: true,
    },
    referralSources: {
      type: String,
      default: '',
      trim: true,
    },
    location: {
      type: [{
        id: {
          type: String,
          required: true,
        },
        value: {
          type: String,
          required: true,
          trim: true,
        },
      }],
      default: [],
    },
    serviceCategory: {
      type: String,
      default: '',
      trim: true,
    },
    defaultDefectColor: {
      type: String,
      default: '#FF8C00',
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
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

ReusableDropdownSchema.index({ company: 1 }, { unique: true });

const ReusableDropdown: Model<IReusableDropdown> =
  mongoose.models.ReusableDropdown || mongoose.model<IReusableDropdown>('ReusableDropdown', ReusableDropdownSchema);

export default ReusableDropdown;

