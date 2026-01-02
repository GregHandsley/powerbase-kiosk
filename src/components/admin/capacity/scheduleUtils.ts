import { format, getDay } from "date-fns";

export type PeriodType = "High Hybrid" | "Low Hybrid" | "Performance" | "General User" | "Closed";
export type RecurrenceType = "single" | "weekday" | "weekend" | "all_future" | "weekly";

export type TimeSlot = {
  hour: number;
  minute: number;
};

export type ScheduleData = {
  id: number;
  side_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  capacity: number;
  period_type: string;
  recurrence_type: string;
  start_date: string;
  end_date: string | null;
  excluded_dates: string[] | null;
  platforms: number[] | null;
};

export type CapacityData = {
  capacity: number;
  periodType: string;
  scheduleId?: number;
  startTime?: string;
  endTime?: string;
  recurrenceType?: string;
  platforms?: number[];
};

export function parseExcludedDates(excludedDates: unknown): string[] {
  if (Array.isArray(excludedDates)) {
    return excludedDates as string[];
  }
  if (typeof excludedDates === 'string') {
    try {
      return JSON.parse(excludedDates) as string[];
    } catch {
      return [];
    }
  }
  return [];
}

export function isDateExcluded(schedule: ScheduleData, dateStr: string): boolean {
  const excludedDates = parseExcludedDates(schedule.excluded_dates);
  return excludedDates.includes(dateStr);
}

/**
 * Normalize time string to HH:mm format for comparison
 */
function normalizeTime(timeStr: string): string {
  // Handle formats like "09:00:00" or "09:00"
  const parts = timeStr.split(":");
  return `${parts[0].padStart(2, "0")}:${parts[1]?.padStart(2, "0") || "00"}`;
}

/**
 * Compare two time strings (HH:mm format)
 * Returns: -1 if time1 < time2, 0 if equal, 1 if time1 > time2
 */
function compareTimes(time1: string, time2: string): number {
  const t1 = normalizeTime(time1);
  const t2 = normalizeTime(time2);
  if (t1 < t2) return -1;
  if (t1 > t2) return 1;
  return 0;
}

export function doesScheduleApply(
  schedule: ScheduleData,
  dayOfWeek: number,
  dayDate: string,
  timeStr: string
): boolean {
  // Normalize times for comparison (handle both "09:00" and "09:00:00" formats)
  const normalizedTimeStr = normalizeTime(timeStr);
  const normalizedStartTime = normalizeTime(schedule.start_time);
  const normalizedEndTime = normalizeTime(schedule.end_time);
  
  // Check if the schedule's start_time matches or is before this time
  if (compareTimes(normalizedStartTime, normalizedTimeStr) > 0) return false;
  // Schedule applies if timeStr is in [start_time, end_time) - inclusive start, exclusive end
  // So if schedule ends at 09:00, time 09:00 is NOT included (facility opens at 09:00)
  if (compareTimes(normalizedEndTime, normalizedTimeStr) <= 0) return false;

  // Check if this date is excluded
  if (isDateExcluded(schedule, dayDate)) {
    return false;
  }

  // Check if the schedule applies to this day
  if (schedule.recurrence_type === "single") {
    return schedule.day_of_week === dayOfWeek && schedule.start_date === dayDate;
  } else if (schedule.recurrence_type === "weekday") {
    return schedule.day_of_week === dayOfWeek && dayOfWeek >= 1 && dayOfWeek <= 5 && schedule.start_date <= dayDate;
  } else if (schedule.recurrence_type === "weekend") {
    return schedule.day_of_week === dayOfWeek && (dayOfWeek === 0 || dayOfWeek === 6) && schedule.start_date <= dayDate;
  } else if (schedule.recurrence_type === "weekly") {
    return schedule.day_of_week === dayOfWeek && schedule.start_date <= dayDate;
  } else if (schedule.recurrence_type === "all_future") {
    return schedule.day_of_week === dayOfWeek && schedule.start_date <= dayDate;
  }
  return false;
}

export function generateTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hour = 0; hour < 24; hour++) {
    slots.push({ hour, minute: 0 });
    slots.push({ hour, minute: 30 });
  }
  return slots;
}

export function formatTimeSlot(slot: TimeSlot): string {
  return `${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`;
}

export function getCapacityKey(day: Date, timeSlot: TimeSlot): string {
  const dayOfWeek = getDay(day);
  const timeStr = formatTimeSlot(timeSlot);
  return `${dayOfWeek}-${timeStr}`;
}

