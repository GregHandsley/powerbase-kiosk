/**
 * Utilities for booking cutoff calculation and validation
 * 
 * Cutoff rule: Bookings cannot be created/edited after the previous Thursday at 23:59:59
 * This means for a booking on any given week, the cutoff is the Thursday of the previous week
 */

import { startOfWeek, addDays, setHours, setMinutes, setSeconds, isAfter, parseISO } from "date-fns";

/**
 * Get the cutoff date for a given booking date
 * Cutoff is the previous Thursday at 23:59:59
 * 
 * @param bookingDate - The date of the booking session (or first session for block bookings)
 * @returns The cutoff date (previous Thursday at 23:59:59)
 */
export function getBookingCutoff(bookingDate: Date | string): Date {
  const date = typeof bookingDate === "string" ? parseISO(bookingDate) : bookingDate;
  
  // Get the start of the week (Monday) for the booking date
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday = 1
  
  // Previous Thursday is 4 days before Monday (Thursday is day 4, so we go back 3 days from Monday)
  // Actually, we want the Thursday of the PREVIOUS week, so:
  // - Go to Monday of current week
  // - Go back 7 days to get to Monday of previous week
  // - Add 3 days to get to Thursday of previous week
  const previousWeekMonday = addDays(weekStart, -7);
  const previousThursday = addDays(previousWeekMonday, 3);
  
  // Set to 23:59:59
  const cutoff = setSeconds(
    setMinutes(
      setHours(previousThursday, 23),
      59
    ),
    59
  );
  
  return cutoff;
}

/**
 * Check if the current time is after the cutoff for a booking date
 * 
 * @param bookingDate - The date of the booking session (or first session for block bookings)
 * @returns true if current time is after cutoff, false otherwise
 */
export function isAfterCutoff(bookingDate: Date | string): boolean {
  const cutoff = getBookingCutoff(bookingDate);
  const now = new Date();
  return isAfter(now, cutoff);
}

/**
 * Get a human-readable message about the cutoff
 * 
 * @param bookingDate - The date of the booking session
 * @returns A formatted message about when the cutoff is/was
 */
export function getCutoffMessage(bookingDate: Date | string): string {
  const cutoff = getBookingCutoff(bookingDate);
  const now = new Date();
  
  if (isAfter(now, cutoff)) {
    return `Cutoff was ${cutoff.toLocaleDateString("en-GB", { 
      weekday: "long", 
      year: "numeric", 
      month: "long", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  } else {
    return `Cutoff is ${cutoff.toLocaleDateString("en-GB", { 
      weekday: "long", 
      year: "numeric", 
      month: "long", 
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })}`;
  }
}

/**
 * Check if a date range (for block bookings) has any sessions after cutoff
 * 
 * @param firstSessionDate - The date of the first session
 * @param lastSessionDate - The date of the last session
 * @returns true if any session in the range is after cutoff
 */
export function hasSessionsAfterCutoff(
  firstSessionDate: Date | string,
  lastSessionDate: Date | string
): boolean {
  // For block bookings, we check if the first session is after cutoff
  // (if the first session is after cutoff, the whole booking is after cutoff)
  return isAfterCutoff(firstSessionDate);
}

