import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAdditionalImage {
	id: string;
	image: string;
	originalImage: string;
	annotations: any[];
	location: string;
	isThreeSixty?: boolean;
}

export interface IDefect extends Document {
	inspection_id: mongoose.Types.ObjectId;
	templateId?: mongoose.Types.ObjectId;
	sectionId?: mongoose.Types.ObjectId;
	subsectionId?: mongoose.Types.ObjectId;
	image: string;
	location: string;
	section: string;
	subsection: string;
	defect_description: string;
	materials: string;
	material_total_cost: number;
	labor_type: string;
	labor_rate: number;
	hours_required: number;
	recommendation: string;
	title: string;
	narrative: string;
	severity: string;
	trade: string;
	color?: string;
	isThreeSixty?: boolean;
	additional_images?: IAdditionalImage[];
	base_cost?: number;
	annotations?: any[];
	originalImage: string;
	deletedAt?: Date;
	parentDefect?: mongoose.Types.ObjectId;
	isFlagged?: boolean;
	createdAt: Date;
	updatedAt: Date;
}

const AdditionalImageSchema = new Schema<IAdditionalImage>(
	{
		id: { type: String, required: true, trim: true },
		image: { type: String, required: true, trim: true },
		originalImage: { type: String, trim: true },
		annotations: { type: [Schema.Types.Mixed] as any, default: [] },
		location: { type: String, trim: true },
		isThreeSixty: { type: Boolean, default: false },
	},
	{ _id: false }
);

const DefectSchema = new Schema<IDefect>(
	{
		inspection_id: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Inspection',
			required: [true, 'Inspection ID is required'],
			index: true,
		},
		templateId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'InspectionTemplate',
			index: true,
		},
		sectionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'InspectionTemplateSection',
			index: true,
		},
		subsectionId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'InspectionTemplateSubsection',
			index: true,
		},
		image: {
			type: String,
			required: [true, 'Image is required'],
			trim: true,
		},
		location: {
			type: String,
			trim: true,
			default: '',
		},
		section: {
			type: String,
			trim: true,
			default: '',
		},
		subsection: {
			type: String,
			trim: true,
			default: '',
		},
		defect_description: {
			type: String,
			trim: true,
			default: '',
		},
		materials: {
			type: String,
			trim: true,
			default: '',
		},
		material_total_cost: {
			type: Number,
			default: 0,
		},
		labor_type: {
			type: String,
			trim: true,
			default: '',
		},
		labor_rate: {
			type: Number,
			default: 0,
		},
		hours_required: {
			type: Number,
			default: 0,
		},
		recommendation: {
			type: String,
			trim: true,
			default: '',
		},
		title: {
			type: String,
			trim: true,
			default: '',
		},
		narrative: {
			type: String,
			trim: true,
			default: '',
		},
		severity: {
			type: String,
			trim: true,
			default: '',
		},
		trade: {
			type: String,
			trim: true,
			default: '',
		},
		color: {
			type: String,
			trim: true,
		},
		isThreeSixty: {
			type: Boolean,
			default: false,
		},
		additional_images: {
			type: [AdditionalImageSchema],
			default: [],
		},
		base_cost: {
			type: Number,
		},
		annotations: {
			type: [Schema.Types.Mixed],
			default: [],
		},
		originalImage: {
			type: String,
			trim: true,
		},
		deletedAt: {
			type: Date,
		},
		parentDefect: {
			type: mongoose.Schema.Types.ObjectId,
			ref: 'Defect',
			index: true,
		},
		isFlagged: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
	}
);

// Index for efficient queries by inspection
DefectSchema.index({ inspection_id: 1, createdAt: -1 });

// Compound index for efficient subsection queries
DefectSchema.index({ inspection_id: 1, templateId: 1, sectionId: 1, subsectionId: 1, createdAt: -1 });

export const Defect: Model<IDefect> =
	mongoose.models.Defect || mongoose.model<IDefect>('Defect', DefectSchema);

export default Defect;
