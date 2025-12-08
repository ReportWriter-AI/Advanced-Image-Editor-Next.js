import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAdditionalImage {
	url: string;
	location: string;
	isThreeSixty?: boolean;
}

export interface IDefect extends Document {
	inspection_id: mongoose.Types.ObjectId;
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
	color?: string;
	isThreeSixty?: boolean;
	additional_images?: IAdditionalImage[];
	base_cost?: number;
	annotations?: any[];
	originalImage?: string;
	createdAt: Date;
	updatedAt: Date;
}

const AdditionalImageSchema = new Schema<IAdditionalImage>(
	{
		url: { type: String, required: true, trim: true },
		location: { type: String, required: true, trim: true },
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
	},
	{
		timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' },
	}
);

// Index for efficient queries by inspection
DefectSchema.index({ inspection_id: 1, createdAt: -1 });

export const Defect: Model<IDefect> =
	mongoose.models.Defect || mongoose.model<IDefect>('Defect', DefectSchema);

export default Defect;
