import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISocialLinks extends Document {
  company: mongoose.Types.ObjectId;
  facebookUrl?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  googlePlusUrl?: string;
  linkedinUrl?: string;
  instagramUrl?: string;
  yelpUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SocialLinksSchema = new Schema<ISocialLinks>(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company is required'],
      unique: true,
    },
    facebookUrl: {
      type: String,
      trim: true,
    },
    twitterUrl: {
      type: String,
      trim: true,
    },
    youtubeUrl: {
      type: String,
      trim: true,
    },
    googlePlusUrl: {
      type: String,
      trim: true,
    },
    linkedinUrl: {
      type: String,
      trim: true,
    },
    instagramUrl: {
      type: String,
      trim: true,
    },
    yelpUrl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

export const SocialLinks: Model<ISocialLinks> =
  mongoose.models.SocialLinks || mongoose.model<ISocialLinks>('SocialLinks', SocialLinksSchema);

export default SocialLinks;

