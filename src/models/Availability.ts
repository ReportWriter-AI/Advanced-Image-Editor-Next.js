import mongoose, { Document, Model, Schema } from "mongoose";
import type { DayKey } from "@/src/constants/availability";
import { DAY_KEYS } from "@/src/constants/availability";

export interface TimeBlock {
  start: string;
  end: string;
}

export interface DayAvailability {
  day: DayKey;
  openSchedule: TimeBlock[];
  timeSlots: string[];
}

export interface DateSpecificAvailability {
  date: string;
  start: string;
  end: string;
}

export interface IAvailability extends Document {
  company: mongoose.Types.ObjectId;
  inspector: mongoose.Types.ObjectId;
  days: DayAvailability[];
  dateSpecific: DateSpecificAvailability[];
  updatedAt: Date;
  createdAt: Date;
}

const TimeBlockSchema = new Schema<TimeBlock>(
  {
    start: {
      type: String,
      required: true,
    },
    end: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const DayAvailabilitySchema = new Schema<DayAvailability>(
  {
    day: {
      type: String,
      enum: DAY_KEYS,
      required: true,
    },
    openSchedule: {
      type: [TimeBlockSchema],
      default: [],
    },
    timeSlots: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const DateSpecificAvailabilitySchema = new Schema<DateSpecificAvailability>(
  {
    date: {
      type: String,
      required: true,
    },
    start: {
      type: String,
      required: true,
    },
    end: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

const AvailabilitySchema = new Schema<IAvailability>(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    inspector: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    days: {
      type: [DayAvailabilitySchema],
      default: [],
    },
    dateSpecific: {
      type: [DateSpecificAvailabilitySchema],
      default: [],
    },
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  }
);

AvailabilitySchema.index({ company: 1, inspector: 1 }, { unique: true });

export const Availability: Model<IAvailability> =
  mongoose.models.Availability ||
  mongoose.model<IAvailability>("Availability", AvailabilitySchema);

export default Availability;

