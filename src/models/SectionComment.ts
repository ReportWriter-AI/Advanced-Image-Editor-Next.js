import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { ISection } from './Section';

export interface ISectionComment extends Document {
  section_id: Types.ObjectId | ISection;
  text: string;
  order_index: number;
  createdAt: Date;
  updatedAt: Date;
}

const SectionCommentSchema = new Schema<ISectionComment>(
  {
    section_id: { type: Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    text: { type: String, required: true, trim: true },
    order_index: { type: Number, required: true },
  },
  { timestamps: true }
);

SectionCommentSchema.index({ section_id: 1, order_index: 1 });
SectionCommentSchema.index({ section_id: 1, text: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const SectionComment: Model<ISectionComment> = mongoose.models.SectionComment || mongoose.model<ISectionComment>('SectionComment', SectionCommentSchema);
export default SectionComment;
