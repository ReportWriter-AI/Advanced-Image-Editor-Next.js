import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInspectionChecklist {
  text: string;
  comment?: string;
  type: 'status' | 'information';
  answer_choices?: string[];
  default_checked?: boolean;
  default_selected_answers?: string[];
  order_index: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IInspectionSection extends Document {
  company: mongoose.Types.ObjectId;
  name: string;
  order_index: number;
  checklists: IInspectionChecklist[];
  createdAt: Date;
  updatedAt: Date;
}

const InspectionChecklistSchema = new Schema<IInspectionChecklist>(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    comment: {
      type: String,  
      trim: true,
    },
    type: {
      type: String,
      enum: ['status', 'information'],
      required: true,
      default: 'information',
    },
    answer_choices: {
      type: [String],
      default: undefined,
    },
    default_checked: {
      type: Boolean,
      default: false,
    },
    default_selected_answers: {
      type: [String],
      default: undefined,
    },
    order_index: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

const InspectionSectionSchema = new Schema<IInspectionSection>(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Section name is required'],
      trim: true,
    },
    order_index: {
      type: Number,
      required: true,
    },
    checklists: {
      type: [InspectionChecklistSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

InspectionSectionSchema.index({ company: 1, order_index: 1 });

InspectionSectionSchema.index(
  { company: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);

export const InspectionSection: Model<IInspectionSection> =
  mongoose.models.InspectionSection ||
  mongoose.model<IInspectionSection>('InspectionSection', InspectionSectionSchema);

export default InspectionSection;

