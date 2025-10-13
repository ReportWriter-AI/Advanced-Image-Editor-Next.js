import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { ISection } from './Section';
import { ISectionChecklist } from './SectionChecklist';

export interface IInspectionInformationBlockImage {
  url: string;
  annotations?: string;
  checklist_id?: string; // Associate image with specific checklist item
  location?: string; // Location tag for the image (e.g., "Garage", "Left Side of House")
  isThreeSixty?: boolean; // 360° photo flag
}

// Structure to store selected answers for each checklist item
export interface IChecklistSelectedAnswers {
  checklist_id: string;
  selected_answers: string[];
}

export interface IInspectionInformationBlock extends Document {
  inspection_id: Types.ObjectId;
  section_id: Types.ObjectId | ISection;
  selected_checklist_ids: Array<Types.ObjectId | ISectionChecklist>;
  selected_answers?: IChecklistSelectedAnswers[]; // Array of checklist IDs with their selected answers
  custom_text?: string;
  images: IInspectionInformationBlockImage[];
  created_at: Date;
  updatedAt: Date;
}

const ImageSchema = new Schema<IInspectionInformationBlockImage>(
  {
    url: { type: String, required: true, trim: true },
    annotations: { type: String, trim: true },
    checklist_id: { type: String, trim: true }, // ID of the checklist item this image belongs to
    location: { type: String, trim: true }, // Location tag for the image
    isThreeSixty: { type: Boolean, default: false }, // 360° photo flag
  },
  { _id: false }
);

const ChecklistSelectedAnswersSchema = new Schema<IChecklistSelectedAnswers>(
  {
    checklist_id: { type: String, required: true, trim: true },
    selected_answers: { type: [String], default: [] },
  },
  { _id: false }
);

const InspectionInformationBlockSchema = new Schema<IInspectionInformationBlock>(
  {
    inspection_id: { type: Schema.Types.ObjectId, ref: 'Inspection', required: true, index: true },
    section_id: { type: Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    selected_checklist_ids: [{ type: Schema.Types.ObjectId, ref: 'SectionChecklist' }],
    selected_answers: { type: [ChecklistSelectedAnswersSchema], default: [] },
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
