/**
 * Timezone utility functions for Central Time (CT) with automatic DST switching
 * Uses America/Chicago timezone which handles CST (UTC-6) and CDT (UTC-5) automatically
 */

import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';

const CENTRAL_TIMEZONE = 'America/Chicago';

/**
 * Get the current time in Central Time
 */
export function getCurrentTimeInCT(): Date {
  const now = new Date();
  return toZonedTime(now, CENTRAL_TIMEZONE);
}

/**
 * Convert a UTC date to Central Time
 */
export function convertToCT(date: Date): Date {
  return toZonedTime(date, CENTRAL_TIMEZONE);
}

/**
 * Create a date in Central Time with specified components
 * @param year - Year
 * @param month - Month (1-12)
 * @param day - Day of month
 * @param hour - Hour (0-23) in Central Time
 * @param minute - Minute (0-59) in Central Time
 * @returns Date object representing the specified time in Central Time
 */
export function createDateInCT(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  // Create a Date object using the Date constructor (month is 0-indexed in Date constructor)
  // This creates a date in the local timezone, but we'll reinterpret it as CT
  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);
  
  // Use fromZonedTime to interpret this date as Central Time and convert to UTC
  // This gives us a UTC Date object that represents the specified time in CT
  return fromZonedTime(localDate, CENTRAL_TIMEZONE);
}

/**
 * Get hour and minute components from a date in Central Time
 */
export function getTimeComponentsInCT(date: Date): { hour: number; minute: number } {
  const ctDate = convertToCT(date);
  return {
    hour: ctDate.getHours(),
    minute: ctDate.getMinutes(),
  };
}

/**
 * Check if a given time (in minutes since midnight) is within a time window
 * @param timeMinutes - Time in minutes since midnight (in Central Time)
 * @param startTime - Start time string (HH:mm format, interpreted as Central Time)
 * @param endTime - End time string (HH:mm format, interpreted as Central Time)
 * @returns true if time is within the window
 */
export function isTimeInWindow(
  timeMinutes: number,
  startTime: string,
  endTime: string
): boolean {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startTimeMinutes = startHour * 60 + startMin;
  const endTimeMinutes = endHour * 60 + endMin;

  return timeMinutes >= startTimeMinutes && timeMinutes < endTimeMinutes;
}

/**
 * Check if current Central Time is within a time window
 * @param startTime - Start time string (HH:mm format, interpreted as Central Time)
 * @param endTime - End time string (HH:mm format, interpreted as Central Time)
 * @returns true if current CT time is within the window
 */
export function isCurrentTimeInWindow(startTime: string, endTime: string): boolean {
  const nowCT = getCurrentTimeInCT();
  // nowCT is already in CT, so we can directly get hours/minutes
  const hour = nowCT.getHours();
  const minute = nowCT.getMinutes();
  const currentTimeMinutes = hour * 60 + minute;
  return isTimeInWindow(currentTimeMinutes, startTime, endTime);
}

/**
 * Set the time components (hour, minute) of a date in Central Time
 * This creates a new date with the specified time in CT, preserving the date part
 * @param date - Base date
 * @param hour - Hour (0-23) in Central Time
 * @param minute - Minute (0-59) in Central Time
 * @returns New Date object with the time set in Central Time
 */
export function setTimeInCT(date: Date, hour: number, minute: number): Date {
  const ctDate = convertToCT(date);
  const year = ctDate.getFullYear();
  const month = ctDate.getMonth() + 1; // getMonth() returns 0-11
  const day = ctDate.getDate();
  
  return createDateInCT(year, month, day, hour, minute);
}

/**
 * Get the day of week (0 = Sunday, 6 = Saturday) in Central Time
 */
export function getDayOfWeekInCT(date: Date): number {
  const ctDate = convertToCT(date);
  return ctDate.getDay();
}

/**
 * Format a date as a string in Central Time
 */
export function formatInCT(date: Date, formatString: string): string {
  return format(date, formatString, { timeZone: CENTRAL_TIMEZONE });
}

