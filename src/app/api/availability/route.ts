import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-helpers";
import User from "@/src/models/User";
import Availability, { TimeBlock } from "@/src/models/Availability";
import type { DateSpecificAvailability, IAvailability } from "@/src/models/Availability";
import type { DayKey } from "@/src/constants/availability";
import {
  ALLOWED_TIMES,
  DAY_KEYS,
  generateTimes,
  isValidTime,
  normalizeDaysRecord,
  timeToMinutes,
  validateOpenSchedule,
  validateTimeSlots,
} from "@/src/lib/availability-utils";

interface DateSpecificPayload {
  date: string;
  start: string;
  end?: string | null;
}

interface UpdatePayload {
  inspectorId: string;
  days: Record<DayKey, { openSchedule: TimeBlock[]; timeSlots: string[] }>;
  dateSpecific?: DateSpecificPayload[];
}

function normalizeDays(days: UpdatePayload["days"]) {
  return DAY_KEYS.map((day) => {
    const dayData = days?.[day] ?? { openSchedule: [], timeSlots: [] };
    const openSchedule = (dayData.openSchedule ?? []).map((block) => ({
      start: block.start,
      end: block.end,
    }));
    const timeSlots = [...(dayData.timeSlots ?? [])];

    const openScheduleError = validateOpenSchedule(openSchedule);
    if (openScheduleError) {
      throw new Error(`${day} open schedule error: ${openScheduleError}`);
    }

    const timeSlotsError = validateTimeSlots(timeSlots);
    if (timeSlotsError) {
      throw new Error(`${day} time slots error: ${timeSlotsError}`);
    }

    return {
      day,
      openSchedule,
      timeSlots,
    };
  });
}

function normalizeDateSpecific(entries: DateSpecificPayload[] = []) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sanitized = entries
    .filter((entry) => entry.date && entry.start)
    .map((entry) => {
      const start = entry.start;
      const endValue = entry.end && entry.end.trim() !== "" ? entry.end : start;

      if (!isValidTime(start) || !isValidTime(endValue)) {
        throw new Error("Date specific availability must use valid times");
      }

      if (timeToMinutes(endValue) < timeToMinutes(start)) {
        throw new Error("Date specific availability end time must be after start time");
      }

      const date = new Date(`${entry.date}T00:00:00`);
      date.setHours(0, 0, 0, 0);

      if (Number.isNaN(date.getTime())) {
        throw new Error("Invalid date provided for date specific availability");
      }

      if (date < today) {
        throw new Error("Date specific availability cannot be set in the past");
      }

      return {
        date: entry.date,
        start,
        end: endValue,
      };
    });

  return sanitized.sort((a, b) => {
    if (a.date === b.date) {
      return timeToMinutes(a.start) - timeToMinutes(b.start);
    }
    return a.date.localeCompare(b.date);
  });
}

type DayAvailabilityDoc = IAvailability["days"][number];

function formatAvailabilityResponse(availability: IAvailability[]) {
  const map = new Map<
    string,
    {
      days: Record<DayKey, { openSchedule: TimeBlock[]; timeSlots: string[] }>;
      dateSpecific: DateSpecificAvailability[];
    }
  >();

  availability.forEach((doc) => {
    const days = doc.days.reduce(
      (acc: Record<DayKey, { openSchedule: TimeBlock[]; timeSlots: string[] }>, day: DayAvailabilityDoc) => {
        acc[day.day as DayKey] = {
          openSchedule: day.openSchedule ?? [],
          timeSlots: day.timeSlots ?? [],
        };
        return acc;
      },
      {} as Record<DayKey, { openSchedule: TimeBlock[]; timeSlots: string[] }>
    );

    const normalized = normalizeDaysRecord(days);

    map.set(String(doc.inspector), {
      days: normalized,
      dateSpecific: doc.dateSpecific ?? [],
    });
  });

  return map;
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser || !currentUser.company) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const inspectors = await User.find({
      company: currentUser.company,
      role: "inspector",
      isActive: true,
    })
      .select("_id firstName lastName email")
      .sort({ firstName: 1, lastName: 1 });

    const availabilityDocs = (await Availability.find({
      company: currentUser.company,
      inspector: { $in: inspectors.map((i) => i._id) },
    })) as unknown as IAvailability[];

    const availabilityMap = formatAvailabilityResponse(availabilityDocs);

    const response = inspectors.map((inspector) => {
      const inspectorId = String(inspector._id);
      const inspectorAvailability = availabilityMap.get(inspectorId);
      const availability =
        inspectorAvailability?.days ??
        DAY_KEYS.reduce(
          (acc, day) => {
            acc[day] = { openSchedule: [], timeSlots: [] };
            return acc;
          },
          {} as Record<DayKey, { openSchedule: TimeBlock[]; timeSlots: string[] }>
        );

      return {
        inspectorId,
        inspectorName: `${inspector.firstName} ${inspector.lastName}`.trim(),
        inspectorFirstName: inspector.firstName,
        email: inspector.email,
        availability,
        dateSpecific: inspectorAvailability?.dateSpecific ?? [],
      };
    });

    return NextResponse.json({ inspectors: response, allowedTimes: ALLOWED_TIMES });
  } catch (error: any) {
    console.error("Availability GET error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to fetch availability" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser || !currentUser.company) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as UpdatePayload;

    if (!body?.inspectorId) {
      return NextResponse.json({ error: "inspectorId is required" }, { status: 400 });
    }

    const inspector = await User.findOne({
      _id: body.inspectorId,
      company: currentUser.company,
      role: "inspector",
      isActive: true,
    });

    if (!inspector) {
      return NextResponse.json({ error: "Inspector not found" }, { status: 404 });
    }

    const normalizedDays = normalizeDays(body.days);
    const normalizedDateSpecific = normalizeDateSpecific(body.dateSpecific ?? []);

    const availabilityDoc = await Availability.findOneAndUpdate(
      {
        company: currentUser.company,
        inspector: inspector._id,
      },
      {
        company: currentUser.company,
        inspector: inspector._id,
        days: normalizedDays,
        dateSpecific: normalizedDateSpecific,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

  if (!availabilityDoc) {
    throw new Error("Failed to update availability");
  }

  const formatted = formatAvailabilityResponse([availabilityDoc as IAvailability]);
  const payload = formatted.get(String(inspector._id));

  return NextResponse.json({
    inspectorId: String(inspector._id),
    availability: payload?.days,
    dateSpecific: payload?.dateSpecific ?? [],
  });
  } catch (error: any) {
    console.error("Availability PUT error:", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to update availability" },
      { status: 400 }
    );
  }
}


