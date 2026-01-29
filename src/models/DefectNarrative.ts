import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDefectNarrative extends Document {
  company: mongoose.Types.ObjectId;
  template?: mongoose.Types.ObjectId;
  sectionName: string;
  subsectionName: string;
  narrative: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const DefectNarrativeSchema = new Schema<IDefectNarrative>(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company is required'],
      index: true,
    },
    template: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
    },
    sectionName: {
      type: String,
      required: [true, 'Section name is required'],
      trim: true,
    },
    subsectionName: {
      type: String,
      required: [true, 'Subsection name is required'],
      trim: true,
    },
    narrative: {
      type: String,
      required: [true, 'Narrative is required'],
      trim: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
  }
);

// Index for efficient queries by company
DefectNarrativeSchema.index({ company: 1, createdAt: -1 });
// Compound index for efficient queries by company, section, and subsection
DefectNarrativeSchema.index({ company: 1, sectionName: 1, subsectionName: 1 });
// Index for template delete/restore and list by template
DefectNarrativeSchema.index({ company: 1, template: 1 });
// Index for filtering non-deleted DefectNarratives
DefectNarrativeSchema.index({ company: 1, deletedAt: 1 });

export const DefectNarrative: Model<IDefectNarrative> =
  mongoose.models.DefectNarrative || mongoose.model<IDefectNarrative>('DefectNarrative', DefectNarrativeSchema);

export default DefectNarrative;
