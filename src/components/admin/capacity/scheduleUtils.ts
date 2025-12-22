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

export function doesScheduleApply(
  schedule: ScheduleData,
  dayOfWeek: number,
  dayDate: string,
  timeStr: string
): boolean {
  // Check if the schedule's start_time matches or is before this time
  if (schedule.start_time > timeStr) return false;
  if (schedule.end_time <= timeStr) return false;

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

