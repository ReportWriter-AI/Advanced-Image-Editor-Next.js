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
    order_index: { type: Number, required: true }, // Removed 'index: true' to avoid duplicate
  },
  { timestamps: true }
);

SectionSchema.index({ order_index: 1 }); // Keep this explicit index instead
SectionSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const Section: Model<ISection> = mongoose.models.Section || mongoose.model<ISection>('Section', SectionSchema);
export default Section;
