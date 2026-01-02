import { getDay, format } from "date-fns";
import { supabase } from "../../../lib/supabaseClient";
import { validateNoOverlaps } from "./useScheduleValidation";
import { parseExcludedDates } from "./scheduleUtils";
import type { PeriodType, RecurrenceType } from "./scheduleUtils";

type SaveCapacityData = {
  capacity: number;
  periodType: PeriodType;
  recurrenceType: RecurrenceType;
  startTime: string;
  endTime: string;
  platforms: number[];
};

export function useScheduleSaving(sideId: number | null) {
  const saveCapacity = async (
    data: SaveCapacityData,
    selectedDate: Date,
    onSuccess: () => void,
    existingScheduleIds: number[] = []
  ) => {
    if (!sideId) return;

    const dayOfWeek = getDay(selectedDate);
    const startDate = format(selectedDate, "yyyy-MM-dd");

    // For "Closed" period type, always use empty platforms array and capacity 0
    let platformsToUse: number[] = [];
    let capacityToUse = data.capacity;
    
    if (data.periodType === "Closed") {
      platformsToUse = [];
      capacityToUse = 0;
    } else {
      // If no platforms selected, try to load defaults from period_type_capacity_defaults
      platformsToUse = data.platforms;
      if (platformsToUse.length === 0) {
        const { data: defaultData } = await supabase
          .from("period_type_capacity_defaults")
          .select("platforms")
          .eq("period_type", data.periodType)
          .eq("side_id", sideId)
          .maybeSingle();
        
        if (defaultData?.platforms && Array.isArray(defaultData.platforms)) {
          platformsToUse = defaultData.platforms as number[];
        }
      }
      capacityToUse = data.capacity;
    }

    const schedulesToCreate: Array<{
      side_id: number;
      day_of_week: number;
      start_time: string;
      end_time: string;
      capacity: number;
      period_type: string;
      recurrence_type: string;
      start_date: string;
      platforms: number[];
    }> = [];

    if (data.recurrenceType === "single") {
      schedulesToCreate.push({
        side_id: sideId,
        day_of_week: dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        capacity: capacityToUse,
        period_type: data.periodType,
        recurrence_type: "single",
        start_date: startDate,
        platforms: platformsToUse,
      });
    } else if (data.recurrenceType === "weekday") {
      for (let day = 1; day <= 5; day++) {
        schedulesToCreate.push({
          side_id: sideId,
          day_of_week: day,
          start_time: data.startTime,
          end_time: data.endTime,
          capacity: capacityToUse,
          period_type: data.periodType,
          recurrence_type: "weekday",
          start_date: startDate,
          platforms: platformsToUse,
        });
      }
    } else if (data.recurrenceType === "weekend") {
      schedulesToCreate.push(
        {
          side_id: sideId,
          day_of_week: 6,
          start_time: data.startTime,
          end_time: data.endTime,
          capacity: capacityToUse,
          period_type: data.periodType,
          recurrence_type: "weekend",
          start_date: startDate,
          platforms: platformsToUse,
        },
        {
          side_id: sideId,
          day_of_week: 0,
          start_time: data.startTime,
          end_time: data.endTime,
          capacity: capacityToUse,
          period_type: data.periodType,
          recurrence_type: "weekend",
          start_date: startDate,
          platforms: platformsToUse,
        }
      );
    } else if (data.recurrenceType === "weekly") {
      schedulesToCreate.push({
        side_id: sideId,
        day_of_week: dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        capacity: capacityToUse,
        period_type: data.periodType,
        recurrence_type: "weekly",
        start_date: startDate,
        platforms: platformsToUse,
      });
    } else if (data.recurrenceType === "all_future") {
      schedulesToCreate.push({
        side_id: sideId,
        day_of_week: dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        capacity: capacityToUse,
        period_type: data.periodType,
        recurrence_type: "all_future",
        start_date: startDate,
        platforms: platformsToUse,
      });
    }

    // Find all schedule IDs that match the pattern we're about to replace
    // This includes the existing schedule and any other schedules in the same series
    // We'll delete these anyway, so exclude them from validation
    const { data: allSchedules } = await supabase
      .from("capacity_schedules")
      .select("*")
      .eq("side_id", sideId);

    const allIdsToExclude: number[] = [...existingScheduleIds];

    // Helper function to check if two time ranges overlap
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(":").map(Number);
      return hours * 60 + minutes;
    };
    
    const doTimeRangesOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
      const start1Min = timeToMinutes(start1);
      const end1Min = timeToMinutes(end1);
      const start2Min = timeToMinutes(start2);
      const end2Min = timeToMinutes(end2);
      return start1Min < end2Min && end1Min > start2Min;
    };

    // First, if we have existingScheduleIds, also find any schedules that match the ORIGINAL pattern
    // This handles the case where the user is changing the time - we need to exclude the original schedule
    // even if it doesn't match the new time pattern
    if (existingScheduleIds.length > 0) {
      const originalSchedules = (allSchedules || []).filter((existing) => 
        existingScheduleIds.includes(existing.id)
      );
      
      // For each original schedule, find other schedules that match its pattern (same day, overlapping time, same period type)
      // These should also be excluded because they're part of the same edit operation
      for (const originalSchedule of originalSchedules) {
        const matchingOriginal = (allSchedules || []).filter((existing) => {
          if (existingScheduleIds.includes(existing.id)) {
            return false; // Already excluded
          }
          
          const matchesDay = existing.day_of_week === originalSchedule.day_of_week;
          const matchesTime = doTimeRangesOverlap(
            originalSchedule.start_time,
            originalSchedule.end_time,
            existing.start_time,
            existing.end_time
          );
          const matchesPeriodType = existing.period_type === originalSchedule.period_type;
          
          // If it's a "single" schedule, also match by start_date
          if (originalSchedule.recurrence_type === "single" && existing.recurrence_type === "single") {
            return matchesDay && matchesTime && matchesPeriodType && 
                   existing.start_date === originalSchedule.start_date;
          }
          
          // For recurring schedules, match by day, time, period type, and recurrence type
          return matchesDay && matchesTime && matchesPeriodType && 
                 existing.recurrence_type === originalSchedule.recurrence_type;
        });
        
        matchingOriginal.forEach((m) => {
          if (!allIdsToExclude.includes(m.id)) {
            allIdsToExclude.push(m.id);
          }
        });
      }
    }

    // For each schedule we're creating, find existing schedules that match the pattern
    // (same day_of_week, overlapping time range, and recurrence_type - these will be replaced)
    for (const newSchedule of schedulesToCreate) {
      const matching = (allSchedules || []).filter((existing) => {
        // Skip if already excluded
        if (allIdsToExclude.includes(existing.id)) {
          return false;
        }
        
        // Match by day_of_week and overlapping time range
        const matchesDay = existing.day_of_week === newSchedule.day_of_week;
        const matchesTime = doTimeRangesOverlap(
          newSchedule.start_time,
          newSchedule.end_time,
          existing.start_time,
          existing.end_time
        );
        
        if (!matchesDay || !matchesTime) {
          return false;
        }
        
        // If creating a "single" schedule, also exclude any recurring schedules (weekly/all_future/weekday/weekend)
        // that match the same day/time, because we're replacing that occurrence
        if (newSchedule.recurrence_type === "single") {
          return (
            existing.recurrence_type === "weekly" ||
            existing.recurrence_type === "all_future" ||
            existing.recurrence_type === "weekday" ||
            existing.recurrence_type === "weekend"
          );
        }
        
        // For other recurrence types, match by day_of_week, time range, and recurrence_type
        return existing.recurrence_type === newSchedule.recurrence_type;
      });
      matching.forEach((m) => {
        if (!allIdsToExclude.includes(m.id)) {
          allIdsToExclude.push(m.id);
        }
      });
    }

    const validationError = await validateNoOverlaps(sideId, schedulesToCreate, allIdsToExclude);
    if (validationError) {
      throw new Error(validationError);
    }

    // If creating a "single" schedule, we need to exclude this date from any recurring schedules
    // that match the same day/time pattern (to create an override)
    if (data.recurrenceType === "single") {
      const recurringSchedulesToExclude = (allSchedules || []).filter((existing) => {
        const matchesDay = existing.day_of_week === dayOfWeek;
        const matchesTime = doTimeRangesOverlap(
          data.startTime,
          data.endTime,
          existing.start_time,
          existing.end_time
        );
        
        if (!matchesDay || !matchesTime) {
          return false;
        }
        
        const isRecurring = existing.recurrence_type === "weekly" ||
                           existing.recurrence_type === "all_future" ||
                           existing.recurrence_type === "weekday" ||
                           existing.recurrence_type === "weekend";
        
        // Only exclude if the schedule applies to this date (start_date <= selectedDate)
        const scheduleStart = new Date(existing.start_date);
        const selectedDateObj = new Date(startDate);
        return isRecurring && scheduleStart <= selectedDateObj;
      });

      // Add the date to excluded_dates for each matching recurring schedule
      for (const recurringSchedule of recurringSchedulesToExclude) {
        const excludedDates = parseExcludedDates(recurringSchedule.excluded_dates);
        
        // Only add if not already excluded
        if (!excludedDates.includes(startDate)) {
          excludedDates.push(startDate);
          
          const { error: excludeError } = await supabase
            .from("capacity_schedules")
            .update({ excluded_dates: excludedDates })
            .eq("id", recurringSchedule.id);

          if (excludeError) {
            console.error("Error excluding date from recurring schedule:", excludeError);
            // Don't throw - continue with creating the single schedule
          }
        }
      }
    }

    for (const schedule of schedulesToCreate) {
      await supabase
        .from("capacity_schedules")
        .delete()
        .eq("side_id", schedule.side_id)
        .eq("day_of_week", schedule.day_of_week)
        .eq("start_time", schedule.start_time)
        .eq("recurrence_type", schedule.recurrence_type);
    }

    const { error } = await supabase.from("capacity_schedules").insert(schedulesToCreate);

    if (error) {
      throw new Error(error.message);
    }

    // For "single" recurrence type schedules, also create/update a period_type_capacity_override
    // This ensures the override table is populated for single-date schedules
    if (data.recurrenceType === "single") {
      const scheduleDate = format(selectedDate, "yyyy-MM-dd");
      
      // Check if an override already exists for this date and period type
      const { data: existingOverride } = await supabase
        .from("period_type_capacity_overrides")
        .select("id")
        .eq("date", scheduleDate)
        .eq("period_type", data.periodType)
        .maybeSingle();

      if (existingOverride) {
        // Update existing override
        await supabase
          .from("period_type_capacity_overrides")
          .update({ capacity: capacityToUse })
          .eq("id", existingOverride.id);
      } else {
        // Create new override
        await supabase
          .from("period_type_capacity_overrides")
          .insert({
            date: scheduleDate,
            period_type: data.periodType,
            capacity: capacityToUse,
            notes: null,
            booking_id: null,
          });
      }
    }

    onSuccess();
  };

  return { saveCapacity };
}

