import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { ISection } from './Section';

export interface ISectionChecklist extends Document {
  section_id: Types.ObjectId | ISection;
  text: string;
  order_index: number;
  createdAt: Date;
  updatedAt: Date;
}

const SectionChecklistSchema = new Schema<ISectionChecklist>(
  {
    section_id: { type: Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    text: { type: String, required: true, trim: true },
    order_index: { type: Number, required: true },
  },
  { timestamps: true }
);

SectionChecklistSchema.index({ section_id: 1, order_index: 1 });
SectionChecklistSchema.index({ section_id: 1, text: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const SectionChecklist: Model<ISectionChecklist> = mongoose.models.SectionChecklist || mongoose.model<ISectionChecklist>('SectionChecklist', SectionChecklistSchema);
export default SectionChecklist;
