import { getDay, format } from "date-fns";
import { supabase } from "../../../lib/supabaseClient";
import { validateNoOverlaps } from "./useScheduleValidation";
import type { PeriodType, RecurrenceType } from "./scheduleUtils";

type SaveCapacityData = {
  capacity: number;
  periodType: PeriodType;
  recurrenceType: RecurrenceType;
  startTime: string;
  endTime: string;
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

    const schedulesToCreate: Array<{
      side_id: number;
      day_of_week: number;
      start_time: string;
      end_time: string;
      capacity: number;
      period_type: string;
      recurrence_type: string;
      start_date: string;
    }> = [];

    if (data.recurrenceType === "single") {
      schedulesToCreate.push({
        side_id: sideId,
        day_of_week: dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        capacity: data.capacity,
        period_type: data.periodType,
        recurrence_type: "single",
        start_date: startDate,
      });
    } else if (data.recurrenceType === "weekday") {
      for (let day = 1; day <= 5; day++) {
        schedulesToCreate.push({
          side_id: sideId,
          day_of_week: day,
          start_time: data.startTime,
          end_time: data.endTime,
          capacity: data.capacity,
          period_type: data.periodType,
          recurrence_type: "weekday",
          start_date: startDate,
        });
      }
    } else if (data.recurrenceType === "weekend") {
      schedulesToCreate.push(
        {
          side_id: sideId,
          day_of_week: 6,
          start_time: data.startTime,
          end_time: data.endTime,
          capacity: data.capacity,
          period_type: data.periodType,
          recurrence_type: "weekend",
          start_date: startDate,
        },
        {
          side_id: sideId,
          day_of_week: 0,
          start_time: data.startTime,
          end_time: data.endTime,
          capacity: data.capacity,
          period_type: data.periodType,
          recurrence_type: "weekend",
          start_date: startDate,
        }
      );
    } else if (data.recurrenceType === "weekly") {
      schedulesToCreate.push({
        side_id: sideId,
        day_of_week: dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        capacity: data.capacity,
        period_type: data.periodType,
        recurrence_type: "weekly",
        start_date: startDate,
      });
    } else if (data.recurrenceType === "all_future") {
      schedulesToCreate.push({
        side_id: sideId,
        day_of_week: dayOfWeek,
        start_time: data.startTime,
        end_time: data.endTime,
        capacity: data.capacity,
        period_type: data.periodType,
        recurrence_type: "all_future",
        start_date: startDate,
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

    // For each schedule we're creating, find existing schedules that match the pattern
    // (same day_of_week, start_time, and recurrence_type - these will be replaced)
    for (const newSchedule of schedulesToCreate) {
      const matching = (allSchedules || []).filter((existing) => {
        return existing.day_of_week === newSchedule.day_of_week &&
               existing.start_time === newSchedule.start_time &&
               existing.recurrence_type === newSchedule.recurrence_type;
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
          .update({ capacity: data.capacity })
          .eq("id", existingOverride.id);
      } else {
        // Create new override
        await supabase
          .from("period_type_capacity_overrides")
          .insert({
            date: scheduleDate,
            period_type: data.periodType,
            capacity: data.capacity,
            notes: null,
            booking_id: null,
          });
      }
    }

    onSuccess();
  };

  return { saveCapacity };
}

