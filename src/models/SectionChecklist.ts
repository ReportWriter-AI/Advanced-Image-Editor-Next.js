import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { ISection } from './Section';

export interface ISectionChecklist extends Document {
  section_id: Types.ObjectId | ISection;
  text: string;
  value?: string; // For status items - user-entered values (e.g., "Concrete", "Rain")
  comment?: string; // For information items - template text
  type: 'status' | 'information';
  tab: 'information' | 'limitations'; // Which tab to display this item in
  answer_choices?: string[]; // NEW: Predefined answer choices (e.g., ["AO Smith", "Rheem", "GE"])
  default_checked?: boolean; // NEW: If true, auto-select for new inspections/blocks
  default_selected_answers?: string[]; // NEW: If default_checked and options exist, preselect these template options
  order_index: number;
  createdAt: Date;
  updatedAt: Date;
}

const SectionChecklistSchema = new Schema<ISectionChecklist>(
  {
    section_id: { type: Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
    text: { type: String, required: true, trim: true },
    value: { type: String, trim: true }, // Optional - for status items (user-entered values)
    comment: { type: String, trim: true }, // Optional - for information items (template text)
    type: { type: String, enum: ['status', 'information'], required: true, default: 'information' },
    tab: { type: String, enum: ['information', 'limitations'], required: true, default: 'information' },
    answer_choices: { type: [String], default: undefined }, // NEW: Array of predefined answer choices
    default_checked: { type: Boolean, default: false }, // NEW: Auto-selected by default on new blocks/inspections
    default_selected_answers: { type: [String], default: undefined }, // NEW: Template-level default selected options
    order_index: { type: Number, required: true },
  },
  { timestamps: true }
);

SectionChecklistSchema.index({ section_id: 1, order_index: 1 });
SectionChecklistSchema.index({ section_id: 1, text: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const SectionChecklist: Model<ISectionChecklist> = mongoose.models.SectionChecklist || mongoose.model<ISectionChecklist>('SectionChecklist', SectionChecklistSchema);
export default SectionChecklist;
