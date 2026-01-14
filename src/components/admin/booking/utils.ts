/**
 * Utility functions for booking form
 */

import { parseISO } from 'date-fns';
import type { BookingStatus } from '../../../types/db';

export function combineDateAndTime(dateStr: string, timeStr: string): Date {
  // date: yyyy-mm-dd, time: HH:mm
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * Check if all instances of a booking are in the past
 * @param instances Array of booking instances with start and end times
 * @returns true if all instances have ended, false otherwise
 */
export function isBookingInPast(
  instances: Array<{ start: string; end: string }>
): boolean {
  if (instances.length === 0) return false;
  const now = new Date();
  return instances.every((inst) => {
    const endTime = parseISO(inst.end);
    return endTime < now;
  });
}

/**
 * Check if a booking is in the past but was never processed
 * @param instances Array of booking instances with start and end times
 * @param status The booking status
 * @returns true if booking is past and unprocessed (pending or draft), false otherwise
 */
export function isPastBookingUnprocessed(
  instances: Array<{ start: string; end: string }>,
  status: BookingStatus | undefined
): boolean {
  if (!isBookingInPast(instances)) return false;
  return status === 'pending' || status === 'draft';
}

/**
 * Check if a time slot is in the past
 * @param date The date to check
 * @param timeSlot The time slot to check
 * @returns true if the time slot is in the past, false otherwise
 */
export function isTimeSlotInPast(
  date: Date,
  timeSlot: { hour: number; minute: number }
): boolean {
  const now = new Date();
  const slotDate = new Date(date);
  slotDate.setHours(timeSlot.hour, timeSlot.minute, 0, 0);
  return slotDate < now;
}

/**
 * Check if a session (date + time) is in the past
 * @param date Date string in YYYY-MM-DD format
 * @param time Time string in HH:mm format
 * @returns true if the session time is in the past, false otherwise
 */
export function isSessionInPast(date: string, time: string): boolean {
  const sessionDateTime = combineDateAndTime(date, time);
  const now = new Date();
  return sessionDateTime < now;
}

/**
 * Calculate end time that is `minutes` after start time, respecting closed periods
 * Returns null if no valid end time can be found
 */
export function calculateEndTime(
  startTime: string,
  minutes: number,
  closedTimes: Set<string>
): string | null {
  const [startHour, startMinute] = startTime.split(':').map(Number);

  // Check if start time itself is closed
  const startTimeStr = `${String(startHour).padStart(2, '0')}:00`;
  if (closedTimes.has(startTimeStr)) {
    return null;
  }

  // Calculate total minutes from midnight
  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = startTotalMinutes + minutes;

  // Convert back to hours and minutes
  let endHour = Math.floor(endTotalMinutes / 60);
  let endMinute = endTotalMinutes % 60;

  // If we go past midnight, cap at 23:59
  if (endHour >= 24) {
    endHour = 23;
    endMinute = 59;
  }

  // Check each hour from start to end to see if any are closed
  for (let hour = startHour; hour <= endHour; hour++) {
    const timeStr = `${String(hour).padStart(2, '0')}:00`;
    if (closedTimes.has(timeStr)) {
      // If we hit a closed hour, try to end just before it (at 59 minutes of previous hour)
      if (hour > startHour) {
        const safeEndHour = hour - 1;
        return `${String(safeEndHour).padStart(2, '0')}:59`;
      }
      // If the first hour after start is closed, return null
      return null;
    }
  }

  // If end time falls exactly on a closed hour boundary, adjust it
  const endTimeStr = `${String(endHour).padStart(2, '0')}:00`;
  if (closedTimes.has(endTimeStr) && endMinute === 0) {
    // End time is exactly on a closed hour, end at 59 of previous hour
    if (endHour > startHour) {
      return `${String(endHour - 1).padStart(2, '0')}:59`;
    }
    return null;
  }

  return `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`;
}
