import mongoose, { Schema, Document, Model } from 'mongoose';

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
}

export interface ITemplate extends Document {
  name: string;
  company: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  sections: ITemplateSection[];
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

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
