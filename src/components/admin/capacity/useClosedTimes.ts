import { useState, useEffect } from 'react';
import { format, getDay } from 'date-fns';
import { supabase } from '../../../lib/supabaseClient';
import {
  doesScheduleApply,
  parseExcludedDates,
  type ScheduleData,
} from './scheduleUtils';

/**
 * Closed period with start and end times
 */
export type ClosedPeriod = {
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
};

/**
 * Hook to check which times are closed for a given date and side
 * Returns an object with closedTimes Set, closedPeriods array, and isLoading boolean
 */
export function useClosedTimes(sideId: number | null, date: string | null) {
  const [closedTimes, setClosedTimes] = useState<Set<string>>(new Set());
  const [closedPeriods, setClosedPeriods] = useState<ClosedPeriod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sideId || !date) {
      setClosedTimes(new Set());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    async function fetchClosedTimes() {
      if (!date) return; // Guard against null
      const dateStr: string = date; // Narrow type after null check
      const dayOfWeek = getDay(new Date(dateStr));
      const dateObj = new Date(dateStr);
      const weekStart = new Date(dateObj);
      weekStart.setDate(dateObj.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      // Fetch all capacity schedules for this side that could apply to this date
      const { data, error } = await supabase
        .from('capacity_schedules')
        .select('*')
        .eq('side_id', sideId)
        .eq('period_type', 'Closed')
        .lte('start_date', format(weekEnd, 'yyyy-MM-dd'))
        .or(`end_date.is.null,end_date.gte.${format(weekStart, 'yyyy-MM-dd')}`);

      if (error) {
        console.error('Error fetching closed times:', error);
        setIsLoading(false);
        return;
      }

      const closedTimeSet = new Set<string>();
      const periods: ClosedPeriod[] = [];

      // For each closed schedule, check if it applies to this date
      data?.forEach((schedule) => {
        const scheduleData: ScheduleData = {
          ...schedule,
          excluded_dates: parseExcludedDates(schedule.excluded_dates),
        };

        // Check if this schedule applies to the selected date by checking the start time
        const appliesToDate = doesScheduleApply(
          scheduleData,
          dayOfWeek,
          dateStr,
          schedule.start_time
        );

        if (appliesToDate) {
          // Store the period for minute-level checking
          periods.push({
            startTime: schedule.start_time,
            endTime: schedule.end_time,
          });

          // This closed schedule applies - mark all hours in its range as closed
          const startHour = parseInt(schedule.start_time.split(':')[0]);
          const startMinute = parseInt(
            schedule.start_time.split(':')[1] || '0'
          );
          const endHour = parseInt(schedule.end_time.split(':')[0]);
          const endMinute = parseInt(schedule.end_time.split(':')[1] || '0');

          // Convert times to minutes for easier comparison
          const startMinutes = startHour * 60 + startMinute;
          const endMinutes = endHour * 60 + endMinute;

          // Mark hours as closed from start hour up to (but not including) the end hour if end is exactly on the hour
          // If the closed period ends at 09:00, hours 00:00-08:00 are closed, but 09:00 is NOT closed (facility opens at 09:00)
          // If the closed period ends at 09:30, hours 00:00-09:00 are closed (hour 09:00 is partially closed)

          // Loop through all hours from 0-23 to check if they overlap with the closed period
          for (let h = 0; h < 24; h++) {
            const hourStartMinutes = h * 60;
            const hourEndMinutes = (h + 1) * 60;

            // An hour is closed if it overlaps with the closed period [startMinutes, endMinutes)
            // The closed period is [startMinutes, endMinutes) - inclusive start, exclusive end
            // An hour overlaps if: hourStart < endMinutes && hourEnd > startMinutes
            // But we need to exclude the case where hourStart exactly equals endMinutes (period ends exactly at hour start)
            const overlaps =
              hourStartMinutes < endMinutes && hourEndMinutes > startMinutes;

            if (overlaps) {
              closedTimeSet.add(`${String(h).padStart(2, '0')}:00`);
            }
          }
        }
      });

      setClosedTimes(closedTimeSet);
      setClosedPeriods(periods);
      setIsLoading(false);
    }

    fetchClosedTimes();
  }, [sideId, date]);

  return { closedTimes, closedPeriods, isLoading };
}

/**
 * Check if a specific time is closed
 * @param closedTimes Set of closed hours (HH:00 format) - for backward compatibility
 * @param time Time to check (HH:mm format)
 * @param closedPeriods Optional array of closed periods for minute-level checking
 * @param isEndTime If true, allow times that are exactly at the start of a closed period (for end times)
 */
export function isTimeClosed(
  closedTimes: Set<string>,
  time: string,
  closedPeriods?: ClosedPeriod[],
  isEndTime?: boolean
): boolean {
  // If closedPeriods are provided, use minute-level checking
  if (closedPeriods && closedPeriods.length > 0) {
    const [timeHour, timeMinute] = time.split(':').map(Number);
    const timeMinutes = timeHour * 60 + timeMinute;

    for (const period of closedPeriods) {
      const [startHour, startMinute] = period.startTime.split(':').map(Number);
      const [endHour, endMinute] = period.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;

      // For end times, allow times that are exactly at the start of a closed period
      // (because a booking can end exactly when the gym closes)
      if (isEndTime && timeMinutes === startMinutes) {
        return false; // Allow this time as an end time
      }

      // Check if time falls within the closed period [startMinutes, endMinutes)
      // Period is inclusive start, exclusive end
      if (timeMinutes >= startMinutes && timeMinutes < endMinutes) {
        return true;
      }
    }
    return false;
  }

  // Fallback to hour-level checking for backward compatibility
  const [hours] = time.split(':').map(Number);
  const timeStr = `${String(hours).padStart(2, '0')}:00`;
  return closedTimes.has(timeStr);
}

/**
 * Check if a time range overlaps with any closed periods
 * @param closedTimes Set of closed hours (HH:00 format) - for backward compatibility
 * @param startTime Start time (HH:mm format)
 * @param endTime End time (HH:mm format)
 * @param closedPeriods Optional array of closed periods for minute-level checking
 */
export function isTimeRangeClosed(
  closedTimes: Set<string>,
  startTime: string,
  endTime: string,
  closedPeriods?: ClosedPeriod[]
): boolean {
  // If closedPeriods are provided, use minute-level checking
  if (closedPeriods && closedPeriods.length > 0) {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // Check if the time range [startMinutes, endMinutes) overlaps with any closed period
    for (const period of closedPeriods) {
      const [periodStartHour, periodStartMinute] = period.startTime
        .split(':')
        .map(Number);
      const [periodEndHour, periodEndMinute] = period.endTime
        .split(':')
        .map(Number);
      const periodStartMinutes = periodStartHour * 60 + periodStartMinute;
      const periodEndMinutes = periodEndHour * 60 + periodEndMinute;

      // Two ranges overlap if: startMinutes < periodEndMinutes && endMinutes > periodStartMinutes
      // Closed period is [periodStartMinutes, periodEndMinutes) - inclusive start, exclusive end
      if (startMinutes < periodEndMinutes && endMinutes > periodStartMinutes) {
        return true;
      }
    }
    return false;
  }

  // Fallback to hour-level checking for backward compatibility
  const [startHour] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  // Check each hour in the range
  for (let hour = startHour; hour <= endHour; hour++) {
    const timeStr = `${String(hour).padStart(2, '0')}:00`;
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
 * @param closedTimes Set of closed hours (HH:00 format) - for backward compatibility
 * @param closedPeriods Optional array of closed periods for minute-level accuracy
 */
export function getAvailableTimeRanges(
  closedTimes: Set<string>,
  closedPeriods?: ClosedPeriod[]
): Array<{ start: string; end: string }> {
  // If closedPeriods are provided, use minute-level calculation
  if (closedPeriods && closedPeriods.length > 0) {
    // Sort periods by start time
    const sortedPeriods = [...closedPeriods].sort((a, b) => {
      const [aHour, aMin] = a.startTime.split(':').map(Number);
      const [bHour, bMin] = b.startTime.split(':').map(Number);
      return aHour * 60 + aMin - (bHour * 60 + bMin);
    });

    const ranges: Array<{ start: string; end: string }> = [];
    let currentStart = 0; // Start from midnight (00:00)

    for (const period of sortedPeriods) {
      const [startHour, startMin] = period.startTime.split(':').map(Number);
      const [endHour, endMin] = period.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      // If there's a gap before this closed period, add it as an available range
      if (currentStart < startMinutes) {
        const gapStartHour = Math.floor(currentStart / 60);
        const gapStartMin = currentStart % 60;
        const gapEndHour = Math.floor(startMinutes / 60);
        const gapEndMin = startMinutes % 60;
        ranges.push({
          start: `${String(gapStartHour).padStart(2, '0')}:${String(gapStartMin).padStart(2, '0')}`,
          end: `${String(gapEndHour).padStart(2, '0')}:${String(gapEndMin).padStart(2, '0')}`,
        });
      }

      // Move current start to the end of this closed period
      currentStart = endMinutes;
    }

    // Add final range if there's time after the last closed period
    // The end time should be the last available 30-minute slot before the closed period starts
    // Since we only allow 30-minute intervals, we need to round appropriately
    if (currentStart < 24 * 60) {
      const finalStartHour = Math.floor(currentStart / 60);
      const finalStartMin = currentStart % 60;

      // Round down to the nearest 30-minute interval for the start
      const roundedStartMin = finalStartMin < 30 ? 0 : 30;
      const finalStartMinutes = finalStartHour * 60 + roundedStartMin;

      // Find the last closed period to determine the actual end time
      const lastPeriod = sortedPeriods[sortedPeriods.length - 1];
      if (lastPeriod) {
        const [lastStartHour, lastStartMin] = lastPeriod.startTime
          .split(':')
          .map(Number);
        const lastStartMinutes = lastStartHour * 60 + lastStartMin;

        // The end time should be the closed period's start time (last available time)
        // But only if there's actually time available before it
        // Also check if the closed period extends to end of day (23:59 or later)
        const [lastEndHour, lastEndMin] = lastPeriod.endTime
          .split(':')
          .map(Number);
        const lastEndMinutes = lastEndHour * 60 + lastEndMin;
        const isClosedToEndOfDay = lastEndMinutes >= 23 * 60 + 30; // 23:30 or later

        if (finalStartMinutes < lastStartMinutes && !isClosedToEndOfDay) {
          const finalStartHourFormatted = Math.floor(finalStartMinutes / 60);
          const finalStartMinFormatted = finalStartMinutes % 60;
          ranges.push({
            start: `${String(finalStartHourFormatted).padStart(2, '0')}:${String(finalStartMinFormatted).padStart(2, '0')}`,
            end: lastPeriod.startTime, // Use the actual closing time
          });
        }
      } else {
        // No closed periods, so available until 23:30 (last 30-minute slot)
        const finalStartHourFormatted = Math.floor(finalStartMinutes / 60);
        const finalStartMinFormatted = finalStartMinutes % 60;
        ranges.push({
          start: `${String(finalStartHourFormatted).padStart(2, '0')}:${String(finalStartMinFormatted).padStart(2, '0')}`,
          end: '23:30',
        });
      }
    }

    return ranges.length > 0 ? ranges : [{ start: '00:00', end: '23:30' }];
  }

  // Fallback to hour-level calculation for backward compatibility
  if (closedTimes.size === 0) {
    return [{ start: '00:00', end: '23:30' }];
  }

  const closedHours = Array.from(closedTimes)
    .map((time) => parseInt(time.split(':')[0]))
    .sort((a, b) => a - b);

  const ranges: Array<{ start: string; end: string }> = [];
  let currentStart = 0;

  for (const closedHour of closedHours) {
    if (currentStart < closedHour) {
      ranges.push({
        start: `${String(currentStart).padStart(2, '0')}:00`,
        end: `${String(closedHour).padStart(2, '0')}:00`,
      });
    }
    currentStart = closedHour + 1;
  }

  // Add final range if there's time after the last closed hour
  // Since we only allow 30-minute intervals, the last available time is 23:30
  if (currentStart < 24) {
    ranges.push({
      start: `${String(currentStart).padStart(2, '0')}:00`,
      end: '23:30',
    });
  }

  return ranges;
}

/**
 * Hook to get General User periods for a given date and side
 * Returns an array of periods with their time ranges and available platforms
 */
export function useGeneralUserPeriods(
  sideId: number | null,
  date: string | null
) {
  const [generalUserPeriods, setGeneralUserPeriods] = useState<
    Array<{
      startTime: string;
      endTime: string;
      platforms: number[];
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!sideId || !date) {
      setGeneralUserPeriods([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    async function fetchGeneralUserPeriods() {
      if (!date) return; // Guard against null
      const dateStr: string = date; // Narrow type after null check
      const dayOfWeek = getDay(new Date(dateStr));
      const dateObj = new Date(dateStr);
      const weekStart = new Date(dateObj);
      weekStart.setDate(dateObj.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      // Fetch all General User capacity schedules for this side
      const { data, error } = await supabase
        .from('capacity_schedules')
        .select('*')
        .eq('side_id', sideId)
        .eq('period_type', 'General User')
        .lte('start_date', format(weekEnd, 'yyyy-MM-dd'))
        .or(`end_date.is.null,end_date.gte.${format(weekStart, 'yyyy-MM-dd')}`);

      if (error) {
        console.error('Error fetching General User periods:', error);
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
        const appliesToDate = doesScheduleApply(
          scheduleData,
          dayOfWeek,
          dateStr,
          schedule.start_time
        );

        if (appliesToDate) {
          const platforms = Array.isArray(schedule.platforms)
            ? schedule.platforms
            : [];
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
  generalUserPeriods: Array<{
    startTime: string;
    endTime: string;
    platforms: number[];
  }>,
  startTime: string,
  endTime: string
): Array<{ startTime: string; endTime: string; platforms: number[] }> {
  const overlappingPeriods: Array<{
    startTime: string;
    endTime: string;
    platforms: number[];
  }> = [];

  for (const period of generalUserPeriods) {
    // Check if the booking time range overlaps with this General User period
    // Period ranges are [start, end) - inclusive start, exclusive end
    // If period ends at 09:00, a booking starting at 09:00 does NOT overlap
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
  overlappingPeriods: Array<{
    startTime: string;
    endTime: string;
    platforms: number[];
  }>
): {
  isValid: boolean;
  unavailablePlatforms: number[];
  availablePlatforms: number[];
} {
  if (overlappingPeriods.length === 0) {
    return { isValid: true, unavailablePlatforms: [], availablePlatforms: [] };
  }

  // Get the union of all available platforms across all overlapping periods
  const availablePlatformsSet = new Set<number>();
  for (const period of overlappingPeriods) {
    period.platforms.forEach((platform) => availablePlatformsSet.add(platform));
  }
  const availablePlatforms = Array.from(availablePlatformsSet);

  // Check which selected platforms are not available
  const unavailablePlatforms = selectedPlatforms.filter(
    (platform) => !availablePlatformsSet.has(platform)
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
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
