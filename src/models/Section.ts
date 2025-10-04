import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISection extends Document {
  name: string;
  order_index: number;
  createdAt: Date;
  updatedAt: Date;
}

const SectionSchema = new Schema<ISection>(
  {
    name: { type: String, required: true, trim: true },
    order_index: { type: Number, required: true, index: true },
  },
  { timestamps: true }
);

SectionSchema.index({ order_index: 1 });
SectionSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const Section: Model<ISection> = mongoose.models.Section || mongoose.model<ISection>('Section', SectionSchema);
export default Section;
