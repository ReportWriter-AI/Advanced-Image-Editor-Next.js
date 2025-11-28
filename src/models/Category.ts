import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICategoryRule {
  operation?: 'AND' | 'OR';
  ruleType: string;
  condition: 'Equal To' | 'Greater Than' | 'Less Than';
  count: number;
  within?: 'Last' | 'Next';
  days?: number;
}

export interface ICategory extends Document {
  name: string;
  color: string;
  autoCategorizing: boolean;
  autoCategoryPerson?: 'Agent' | 'Client';
  rules: ICategoryRule[];
  removeCategoryOnRuleFail: boolean;
  company: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CategoryRuleSchema = new Schema<ICategoryRule>(
  {
    operation: {
      type: String,
      enum: ['AND', 'OR'],
    },
    ruleType: {
      type: String,
      required: true,
    },
    condition: {
      type: String,
      enum: ['Equal To', 'Greater Than', 'Less Than'],
      required: true,
    },
    count: {
      type: Number,
      required: true,
    },
    within: {
      type: String,
      enum: ['Last', 'Next'],
    },
    days: {
      type: Number,
    },
  },
  { _id: false }
);

const CategorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    color: {
      type: String,
      required: [true, 'Category color is required'],
      default: '#3b82f6',
    },
    autoCategorizing: {
      type: Boolean,
      default: false,
    },
    autoCategoryPerson: {
      type: String,
      enum: ['Agent', 'Client'],
    },
    rules: {
      type: [CategoryRuleSchema],
      default: [],
    },
    removeCategoryOnRuleFail: {
      type: Boolean,
      default: false,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

CategorySchema.index({ company: 1, name: 1 });

const Category: Model<ICategory> = mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema);

export default Category;

