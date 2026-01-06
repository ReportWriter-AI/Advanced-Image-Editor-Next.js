import {
  DAY_KEYS,
  type DayKey,
  SCHEDULE_END_TIME,
  SCHEDULE_INTERVAL_MINUTES,
  SCHEDULE_START_TIME,
} from "@/src/constants/availability";

export interface TimeBlockLike {
  start: string;
  end: string;
}

export interface DayScheduleLike {
  openSchedule: TimeBlockLike[];
  timeSlots: string[];
}

const createDefaultSchedule = (): DayScheduleLike => ({
  openSchedule: [],
  timeSlots: [],
});

export const ALLOWED_TIMES = generateTimes(
  SCHEDULE_START_TIME,
  SCHEDULE_END_TIME,
  SCHEDULE_INTERVAL_MINUTES
);

export function generateTimes(start: string, end: string, intervalMinutes: number) {
  const times: string[] = [];
  const [startHours, startMinutes] = start.split(":").map(Number);
  const [endHours, endMinutes] = end.split(":").map(Number);

  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;

  for (let minutes = startTotal; minutes <= endTotal; minutes += intervalMinutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    times.push(`${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`);
  }

  return times;
}

export function isValidTime(value: string) {
  return ALLOWED_TIMES.includes(value);
}

export function timeToMinutes(value: string | undefined | null): number {
  if (!value || typeof value !== "string") {
    // Return 0 (midnight) as a safe default for undefined/null values
    // This prevents crashes while maintaining valid comparisons
    return 0;
  }
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function validateOpenSchedule(blocks: TimeBlockLike[]) {
  const sorted = [...blocks].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  for (let i = 0; i < sorted.length; i += 1) {
    const { start, end } = sorted[i];

    if (!isValidTime(start) || !isValidTime(end)) {
      return "Blocks must use valid times";
    }

    if (timeToMinutes(end) <= timeToMinutes(start)) {
      return "Block end time must be after start time";
    }

    if (i > 0) {
      const prev = sorted[i - 1];
      if (timeToMinutes(start) < timeToMinutes(prev.end)) {
        return "Blocks cannot overlap";
      }
    }
  }

  return null;
}

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function formatTimeLabel(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return timeFormatter.format(date);
}

export function validateTimeSlots(slots: string[]) {
  const seen = new Set<string>();

  for (const slot of slots) {
    if (!isValidTime(slot)) {
      return "Time slots must use valid times";
    }

    if (seen.has(slot)) {
      return "Duplicate time slots are not allowed";
    }

    seen.add(slot);
  }

  return null;
}

export function normalizeDaysRecord<T extends DayScheduleLike>(
  days: Partial<Record<DayKey, T>>
): Record<DayKey, T> {
  return DAY_KEYS.reduce((acc, day) => {
    const dayValue = days?.[day];
    acc[day] =
      dayValue ??
      (createDefaultSchedule() as unknown as T);
    return acc;
  }, {} as Record<DayKey, T>);
}

export { DAY_KEYS };

