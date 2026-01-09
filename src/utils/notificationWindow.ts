import { addDays, startOfWeek, endOfDay, isAfter, format, getDay, setHours, setMinutes, parse } from "date-fns";
import { supabase } from "../lib/supabaseClient";

export interface NotificationWindowSettings {
  notification_window_enabled: boolean;
  notification_window_day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  notification_window_time: string; // "HH:mm:ss" format
  hard_restriction_enabled: boolean;
  hard_restriction_hours: number;
}

/**
 * Fetches notification window settings from database
 * Falls back to defaults if not configured
 */
export async function getNotificationWindowSettings(): Promise<NotificationWindowSettings> {
  try {
    const { data, error } = await supabase
      .from("notification_settings")
      .select("notification_window_enabled, notification_window_day_of_week, notification_window_time, hard_restriction_enabled, hard_restriction_hours")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      // Return defaults if settings don't exist
      return {
        notification_window_enabled: true,
        notification_window_day_of_week: 4, // Thursday
        notification_window_time: "23:59:00",
        hard_restriction_enabled: true,
        hard_restriction_hours: 12,
      };
    }

    return {
      notification_window_enabled: data.notification_window_enabled ?? true,
      notification_window_day_of_week: data.notification_window_day_of_week ?? 4,
      notification_window_time: data.notification_window_time ?? "23:59:00",
      hard_restriction_enabled: data.hard_restriction_enabled ?? true,
      hard_restriction_hours: data.hard_restriction_hours ?? 12,
    };
  } catch (err) {
    console.error("Error fetching notification window settings:", err);
    // Return defaults on error
    return {
      notification_window_enabled: true,
      notification_window_day_of_week: 4,
      notification_window_time: "23:59:00",
      hard_restriction_enabled: true,
      hard_restriction_hours: 12,
    };
  }
}

/**
 * Calculates the notification window deadline for a given week.
 * This is the configured day/time before the week starts.
 * @param date A date within the week for which to calculate the window.
 * @param settings Notification window settings (if not provided, will fetch)
 * @returns The notification window deadline Date object, or null if disabled
 */
export async function getNotificationWindowDeadline(
  date: Date,
  settings?: NotificationWindowSettings
): Promise<Date | null> {
  const config = settings || await getNotificationWindowSettings();
  
  if (!config.notification_window_enabled) {
    return null; // Notification window is disabled
  }

  const startOfCurrentWeek = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const targetDayOfWeek = config.notification_window_day_of_week; // 0=Sunday, 1=Monday, etc.
  
  // Calculate the target day (e.g., Thursday before the week starts)
  // We want the target day of the week BEFORE the week starts
  // If target is Thursday (4), and week starts Monday (1):
  // - Thursday is 3 days after Monday (4 - 1 = 3)
  // - So we go back 7 days from Monday, then forward 3 days = Thursday of previous week
  // - Or: Monday - (7 - (4 - 1)) = Monday - 4 = previous Thursday
  // For Sunday (0), it's 6 days before Monday, so: Monday - 6 = previous Sunday
  const daysFromMonday = targetDayOfWeek === 0 ? 6 : targetDayOfWeek - 1;
  const daysBeforeWeekStart = 7 - daysFromMonday;
  const targetDate = addDays(startOfCurrentWeek, -daysBeforeWeekStart);
  
  // Parse the time (e.g., "23:59:00")
  const [hours, minutes, seconds = 0] = config.notification_window_time.split(":").map(Number);
  const deadline = setMinutes(setHours(targetDate, hours), minutes);
  
  return deadline;
}

/**
 * Checks if the current time is after the notification window deadline for a given date.
 * @param date A date within the week to check against.
 * @param settings Optional settings (will fetch if not provided)
 * @returns True if current time is after the window deadline, false otherwise (or if disabled)
 */
export async function isAfterNotificationWindow(
  date: Date,
  settings?: NotificationWindowSettings
): Promise<boolean> {
  const deadline = await getNotificationWindowDeadline(date, settings);
  if (!deadline) return false; // Window is disabled, so never "after"
  return isAfter(new Date(), deadline);
}

/**
 * Checks if a booking time is within the hard restriction period (e.g., 12 hours before session).
 * @param sessionStartTime The start time of the session
 * @param settings Optional settings (will fetch if not provided)
 * @returns True if within hard restriction period, false otherwise
 */
export async function isWithinHardRestriction(
  sessionStartTime: Date,
  settings?: NotificationWindowSettings
): Promise<boolean> {
  const config = settings || await getNotificationWindowSettings();
  
  if (!config.hard_restriction_enabled) {
    return false; // Hard restriction is disabled
  }

  const now = new Date();
  const hoursUntilSession = (sessionStartTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  return hoursUntilSession < config.hard_restriction_hours;
}

/**
 * Generates a human-readable message for the notification window deadline.
 * @param date A date within the week for which to get the deadline message.
 * @param settings Optional settings (will fetch if not provided)
 * @returns A string like "Thursday, 8 Jan 2026 at 23:59" or "Notification window is disabled"
 */
export async function getNotificationWindowMessage(
  date: Date,
  settings?: NotificationWindowSettings
): Promise<string> {
  const deadline = await getNotificationWindowDeadline(date, settings);
  if (!deadline) {
    return "Notification window is disabled";
  }
  
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[deadline.getDay()];
  return format(deadline, `'${dayName},' d MMM yyyy 'at' HH:mm`);
}

/**
 * Generates a human-readable message for the hard restriction.
 * @param sessionStartTime The start time of the session
 * @param settings Optional settings (will fetch if not provided)
 * @returns A string like "Bookings cannot be made within 12 hours of session start"
 */
export async function getHardRestrictionMessage(
  sessionStartTime: Date,
  settings?: NotificationWindowSettings
): Promise<string> {
  const config = settings || await getNotificationWindowSettings();
  
  if (!config.hard_restriction_enabled) {
    return "Hard restriction is disabled";
  }
  
  return `Bookings cannot be created or edited within ${config.hard_restriction_hours} hours of the session start time.`;
}

