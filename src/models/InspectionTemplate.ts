import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInspectionTemplateChecklist {
  _id?: mongoose.Types.ObjectId;
  type: 'status' | 'information' | 'defects';
  name: string;
  field?: 'checkbox' | 'multipleAnswers' | 'date' | 'number' | 'numberRange' | 'signature' | 'text';
  location?: string;
  comment?: string;
  defaultChecked?: boolean;
  answerChoices?: string[]; // For multipleAnswers, number, numberRange
  orderIndex: number;
  // Answer fields
  textAnswer?: string; // For text field type
  selectedAnswers?: string[]; // For multipleAnswers field type
  dateAnswer?: Date; // For date field type
  numberAnswer?: number; // For number field type
  numberUnit?: string; // For number field type (unit selection)
  rangeFrom?: number; // For numberRange field type
  rangeTo?: number; // For numberRange field type
  rangeUnit?: string; // For numberRange field type (unit selection)
}

export interface IInspectionTemplateSubsection {
  _id?: mongoose.Types.ObjectId;
  name: string;
  informationalOnly: boolean;
  includeInEveryReport: boolean;
  inspectorNotes?: string;
  orderIndex: number;
  checklists?: IInspectionTemplateChecklist[];
  deletedAt?: Date;
}

export interface IInspectionTemplateSection {
  _id?: mongoose.Types.ObjectId;
  name: string;
  excludeFromSummaryView: boolean;
  includeInEveryReport: boolean;
  startSectionOnNewPage: boolean;
  sectionIcon?: string;
  inspectionGuidelines?: string;
  inspectorNotes?: string;
  orderIndex: number;
  subsections: IInspectionTemplateSubsection[];
  deletedAt?: Date;
}

export interface IInspectionTemplate extends Document {
  name: string;
  sections: IInspectionTemplateSection[];
  orderIndex: number;
  reportDescription?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const InspectionTemplateChecklistSchema = new Schema<IInspectionTemplateChecklist>(
  {
    type: {
      type: String,
      enum: ['status', 'information', 'defects'],
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Checklist name is required'],
      trim: true,
    },
    field: {
      type: String,
      enum: ['checkbox', 'multipleAnswers', 'date', 'number', 'numberRange', 'signature', 'text'],
    },
    location: {
      type: String,
      trim: true,
    },
    comment: {
      type: String,
    },
    defaultChecked: {
      type: Boolean,
      default: false,
    },
    answerChoices: {
      type: [String],
      default: undefined,
    },
    orderIndex: {
      type: Number,
      required: true,
    },
    // Answer fields
    textAnswer: {
      type: String,
      trim: true,
    },
    selectedAnswers: {
      type: [String],
      default: undefined,
    },
    dateAnswer: {
      type: Date,
    },
    numberAnswer: {
      type: Number,
    },
    numberUnit: {
      type: String,
      trim: true,
    },
    rangeFrom: {
      type: Number,
    },
    rangeTo: {
      type: Number,
    },
    rangeUnit: {
      type: String,
      trim: true,
    },
  },
  { _id: true, timestamps: false }
);

const InspectionTemplateSubsectionSchema = new Schema<IInspectionTemplateSubsection>(
  {
    name: {
      type: String,
      required: [true, 'Subsection name is required'],
      trim: true,
    },
    informationalOnly: {
      type: Boolean,
      default: false,
    },
    includeInEveryReport: {
      type: Boolean,
      default: true,
    },
    inspectorNotes: {
      type: String,
    },
    orderIndex: {
      type: Number,
      required: true,
    },
    checklists: {
      type: [InspectionTemplateChecklistSchema],
      default: [],
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true, timestamps: false }
);

const InspectionTemplateSectionSchema = new Schema<IInspectionTemplateSection>(
  {
    name: {
      type: String,
      required: [true, 'Section name is required'],
      trim: true,
    },
    excludeFromSummaryView: {
      type: Boolean,
      default: false,
    },
    includeInEveryReport: {
      type: Boolean,
      default: false,
    },
    startSectionOnNewPage: {
      type: Boolean,
      default: false,
    },
    sectionIcon: {
      type: String,
      trim: true,
      default: 'Home',
    },
    inspectionGuidelines: {
      type: String,
    },
    inspectorNotes: {
      type: String,
    },
    orderIndex: {
      type: Number,
      required: true,
    },
    subsections: {
      type: [InspectionTemplateSubsectionSchema],
      default: [],
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true, timestamps: false }
);

const InspectionTemplateSchema = new Schema<IInspectionTemplate>(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
    },
    sections: {
      type: [InspectionTemplateSectionSchema],
      default: [],
    },
    orderIndex: {
      type: Number,
      default: 0,
      index: true,
    },
    reportDescription: {
      type: String,
      trim: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

InspectionTemplateSchema.index({ createdAt: -1 });

export const InspectionTemplate: Model<IInspectionTemplate> =
  mongoose.models.InspectionTemplate || mongoose.model<IInspectionTemplate>('InspectionTemplate', InspectionTemplateSchema);

export default InspectionTemplate;
