import { useState, useEffect } from "react";
import { format, getDay } from "date-fns";
import { supabase } from "../../../lib/supabaseClient";
import { doesScheduleApply, parseExcludedDates, type ScheduleData } from "./scheduleUtils";

/**
 * Hook to check which times are closed for a given date and side
 * Returns an object with closedTimes Set and isLoading boolean
 */
export function useClosedTimes(sideId: number | null, date: string | null) {
  const [closedTimes, setClosedTimes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sideId || !date) {
      setClosedTimes(new Set());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    async function fetchClosedTimes() {
      const dayOfWeek = getDay(new Date(date));
      const dateObj = new Date(date);
      const weekStart = new Date(dateObj);
      weekStart.setDate(dateObj.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      // Fetch all capacity schedules for this side that could apply to this date
      const { data, error } = await supabase
        .from("capacity_schedules")
        .select("*")
        .eq("side_id", sideId)
        .eq("period_type", "Closed")
        .lte("start_date", format(weekEnd, "yyyy-MM-dd"))
        .or(`end_date.is.null,end_date.gte.${format(weekStart, "yyyy-MM-dd")}`);

      if (error) {
        console.error("Error fetching closed times:", error);
        setIsLoading(false);
        return;
      }

      const closedTimeSet = new Set<string>();

      // For each closed schedule, check if it applies to this date
      data?.forEach((schedule) => {
        const scheduleData: ScheduleData = {
          ...schedule,
          excluded_dates: parseExcludedDates(schedule.excluded_dates),
        };
        
        // Check if this schedule applies to the selected date by checking the start time
        const appliesToDate = doesScheduleApply(scheduleData, dayOfWeek, date, schedule.start_time);
        
        if (appliesToDate) {
          // This closed schedule applies - mark all hours in its range as closed
          const startHour = parseInt(schedule.start_time.split(":")[0]);
          const endHour = parseInt(schedule.end_time.split(":")[0]);
          const endMinute = parseInt(schedule.end_time.split(":")[1] || "0");
          
          // Add all hours within the closed period
          // Include from start hour up to (but not including) end hour if end is exactly on the hour
          for (let h = startHour; h < endHour; h++) {
            closedTimeSet.add(`${String(h).padStart(2, "0")}:00`);
          }
          
          // If end time has minutes, include the end hour as well
          if (endMinute > 0) {
            closedTimeSet.add(`${String(endHour).padStart(2, "0")}:00`);
          }
        }
      });

      setClosedTimes(closedTimeSet);
      setIsLoading(false);
    }

    fetchClosedTimes();
  }, [sideId, date]);

  return { closedTimes, isLoading };
}

/**
 * Check if a specific time is closed
 */
export function isTimeClosed(closedTimes: Set<string>, time: string): boolean {
  const [hours] = time.split(":").map(Number);
  const timeStr = `${String(hours).padStart(2, "0")}:00`;
  return closedTimes.has(timeStr);
}

/**
 * Check if a time range overlaps with any closed periods
 */
export function isTimeRangeClosed(
  closedTimes: Set<string>,
  startTime: string,
  endTime: string
): boolean {
  const [startHour] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  
  // Check each hour in the range
  for (let hour = startHour; hour <= endHour; hour++) {
    const timeStr = `${String(hour).padStart(2, "0")}:00`;
    if (closedTimes.has(timeStr)) {
      // If it's the end hour and end time is exactly on the hour, don't count it
      if (hour === endHour && endMinute === 0) {
        continue;
      }
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate available time ranges (gaps between closed periods)
 * Returns an array of { start: string, end: string } in HH:mm format
 */
export function getAvailableTimeRanges(closedTimes: Set<string>): Array<{ start: string; end: string }> {
  if (closedTimes.size === 0) {
    return [{ start: "00:00", end: "23:59" }];
  }

  const closedHours = Array.from(closedTimes)
    .map((time) => parseInt(time.split(":")[0]))
    .sort((a, b) => a - b);

  const ranges: Array<{ start: string; end: string }> = [];
  let currentStart = 0;

  for (const closedHour of closedHours) {
    if (currentStart < closedHour) {
      ranges.push({
        start: `${String(currentStart).padStart(2, "0")}:00`,
        end: `${String(closedHour).padStart(2, "0")}:00`,
      });
    }
    currentStart = closedHour + 1;
  }

  // Add final range if there's time after the last closed hour
  if (currentStart < 24) {
    ranges.push({
      start: `${String(currentStart).padStart(2, "0")}:00`,
      end: "23:59",
    });
  }

  return ranges;
}

/**
 * Hook to get General User periods for a given date and side
 * Returns an array of periods with their time ranges and available platforms
 */
export function useGeneralUserPeriods(sideId: number | null, date: string | null) {
  const [generalUserPeriods, setGeneralUserPeriods] = useState<Array<{
    startTime: string;
    endTime: string;
    platforms: number[];
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sideId || !date) {
      setGeneralUserPeriods([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    async function fetchGeneralUserPeriods() {
      const dayOfWeek = getDay(new Date(date));
      const dateObj = new Date(date);
      const weekStart = new Date(dateObj);
      weekStart.setDate(dateObj.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      // Fetch all General User capacity schedules for this side
      const { data, error } = await supabase
        .from("capacity_schedules")
        .select("*")
        .eq("side_id", sideId)
        .eq("period_type", "General User")
        .lte("start_date", format(weekEnd, "yyyy-MM-dd"))
        .or(`end_date.is.null,end_date.gte.${format(weekStart, "yyyy-MM-dd")}`);

      if (error) {
        console.error("Error fetching General User periods:", error);
        setIsLoading(false);
        return;
      }

      const periods: Array<{
        startTime: string;
        endTime: string;
        platforms: number[];
      }> = [];

      // For each General User schedule, check if it applies to this date
      data?.forEach((schedule) => {
        const scheduleData: ScheduleData = {
          ...schedule,
          excluded_dates: parseExcludedDates(schedule.excluded_dates),
        };
        
        // Check if this schedule applies to the selected date
        const appliesToDate = doesScheduleApply(scheduleData, dayOfWeek, date, schedule.start_time);
        
        if (appliesToDate) {
          const platforms = Array.isArray(schedule.platforms) ? schedule.platforms : [];
          periods.push({
            startTime: schedule.start_time,
            endTime: schedule.end_time,
            platforms: platforms as number[],
          });
        }
      });

      setGeneralUserPeriods(periods);
      setIsLoading(false);
    }

    fetchGeneralUserPeriods();
  }, [sideId, date]);

  return { generalUserPeriods, isLoading };
}

/**
 * Check if a time range overlaps with any General User periods
 */
export function doesTimeRangeOverlapGeneralUser(
  generalUserPeriods: Array<{ startTime: string; endTime: string; platforms: number[] }>,
  startTime: string,
  endTime: string
): Array<{ startTime: string; endTime: string; platforms: number[] }> {
  const overlappingPeriods: Array<{ startTime: string; endTime: string; platforms: number[] }> = [];
  
  for (const period of generalUserPeriods) {
    // Check if the booking time range overlaps with this General User period
    const periodStart = timeToMinutes(period.startTime);
    const periodEnd = timeToMinutes(period.endTime);
    const bookingStart = timeToMinutes(startTime);
    const bookingEnd = timeToMinutes(endTime);
    
    // Overlap occurs if booking starts before period ends and booking ends after period starts
    if (bookingStart < periodEnd && bookingEnd > periodStart) {
      overlappingPeriods.push(period);
    }
  }
  
  return overlappingPeriods;
}

/**
 * Check if all selected platforms are available in the overlapping General User periods
 */
export function arePlatformsAvailableInGeneralUser(
  selectedPlatforms: number[],
  overlappingPeriods: Array<{ startTime: string; endTime: string; platforms: number[] }>
): { isValid: boolean; unavailablePlatforms: number[]; availablePlatforms: number[] } {
  if (overlappingPeriods.length === 0) {
    return { isValid: true, unavailablePlatforms: [], availablePlatforms: [] };
  }

  // Get the union of all available platforms across all overlapping periods
  const availablePlatformsSet = new Set<number>();
  for (const period of overlappingPeriods) {
    period.platforms.forEach(platform => availablePlatformsSet.add(platform));
  }
  const availablePlatforms = Array.from(availablePlatformsSet);

  // Check which selected platforms are not available
  const unavailablePlatforms = selectedPlatforms.filter(
    platform => !availablePlatformsSet.has(platform)
  );

  return {
    isValid: unavailablePlatforms.length === 0,
    unavailablePlatforms,
    availablePlatforms,
  };
}

/**
 * Helper function to convert time string to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

