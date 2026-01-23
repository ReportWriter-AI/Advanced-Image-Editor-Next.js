import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITemplateChecklist {
  _id?: mongoose.Types.ObjectId;
  type: 'status' | 'information' | 'defects';
  name: string;
  field?: 'checkbox' | 'multipleAnswers' | 'date' | 'number' | 'numberRange' | 'text';
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

export interface ITemplateSubsection {
  _id?: mongoose.Types.ObjectId;
  name: string;
  informationalOnly: boolean;
  includeInEveryReport: boolean;
  inspectorNotes?: string;
  orderIndex: number;
  checklists?: ITemplateChecklist[];
  deletedAt?: Date;
}

export interface ITemplateSection {
  _id?: mongoose.Types.ObjectId;
  name: string;
  excludeFromSummaryView: boolean;
  includeInEveryReport: boolean;
  startSectionOnNewPage: boolean;
  sectionIcon?: string;
  inspectionGuidelines?: string;
  inspectorNotes?: string;
  orderIndex: number;
  subsections: ITemplateSubsection[];
  deletedAt?: Date;
}

export interface ITemplate extends Document {
  name: string;
  company: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  sections: ITemplateSection[];
  orderIndex: number;
  reportDescription?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const TemplateChecklistSchema = new Schema<ITemplateChecklist>(
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
      enum: ['checkbox', 'multipleAnswers', 'date', 'number', 'numberRange', 'text'],
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

const TemplateSubsectionSchema = new Schema<ITemplateSubsection>(
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
      type: [TemplateChecklistSchema],
      default: [],
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true, timestamps: false }
);

const TemplateSectionSchema = new Schema<ITemplateSection>(
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
      type: [TemplateSubsectionSchema],
      default: [],
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: true, timestamps: false }
);

const TemplateSchema = new Schema<ITemplate>(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
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
    sections: {
      type: [TemplateSectionSchema],
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

TemplateSchema.pre('save', async function (next) {
  const doc = this as ITemplate & { orderIndex?: number };

  if (
    typeof doc.orderIndex === 'number' &&
    Number.isFinite(doc.orderIndex) &&
    doc.orderIndex > 0
  ) {
    return next();
  }

  try {
    const Model = this.constructor as mongoose.Model<ITemplate>;
    const lastTemplate = await Model.findOne({ company: doc.company })
      .sort({ orderIndex: -1 })
      .select('orderIndex')
      .lean();

    doc.orderIndex =
      typeof lastTemplate?.orderIndex === 'number' && Number.isFinite(lastTemplate.orderIndex)
        ? lastTemplate.orderIndex + 1
        : 1;

    next();
  } catch (error) {
    next(error as Error);
  }
});

TemplateSchema.index({ company: 1, name: 1 });
TemplateSchema.index({ company: 1, createdAt: -1 });

export const Template: Model<ITemplate> =
  mongoose.models.Template || mongoose.model<ITemplate>('Template', TemplateSchema);

export default Template;
