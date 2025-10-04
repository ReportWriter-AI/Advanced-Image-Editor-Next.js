import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { ISection } from './Section';
import { ISectionChecklist } from './SectionChecklist';
import { ISectionComment } from './SectionComment';

export interface IInspectionInformationBlockImage {
  url: string;
  annotations?: string;
}

export interface IInspectionInformationBlock extends Document {
  inspection_id: Types.ObjectId;
  section_id: Types.ObjectId | ISection;
  selected_checklist_ids: Array<Types.ObjectId | ISectionChecklist>;
  selected_comment_ids: Array<Types.ObjectId | ISectionComment>;
  custom_text?: string;
  images: IInspectionInformationBlockImage[];
  created_at: Date;
  updatedAt: Date;
}

const ImageSchema = new Schema<IInspectionInformationBlockImage>(
  {
    url: { type: String, required: true, trim: true },
    annotations: { type: String, trim: true },
  },
  { _id: false }
);

const InspectionInformationBlockSchema = new Schema<IInspectionInformationBlock>(
  {
    inspection_id: { type: Schema.Types.ObjectId, ref: 'Inspection', required: true, index: true },
    section_id: { type: Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    selected_checklist_ids: [{ type: Schema.Types.ObjectId, ref: 'SectionChecklist' }],
    selected_comment_ids: [{ type: Schema.Types.ObjectId, ref: 'SectionComment' }],
    custom_text: { type: String, trim: true },
    images: { type: [ImageSchema], default: [] },
    created_at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updatedAt' } }
);

InspectionInformationBlockSchema.index({ inspection_id: 1, section_id: 1 }, { unique: true });

export const InspectionInformationBlock: Model<IInspectionInformationBlock> =
  mongoose.models.InspectionInformationBlock ||
  mongoose.model<IInspectionInformationBlock>('InspectionInformationBlock', InspectionInformationBlockSchema);

export default InspectionInformationBlock;
