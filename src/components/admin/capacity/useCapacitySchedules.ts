import { useState, useEffect } from "react";
import { addDays, format, startOfWeek, eachDayOfInterval, getDay } from "date-fns";
import { supabase } from "../../../lib/supabaseClient";
import type { ScheduleData, CapacityData, TimeSlot } from "./scheduleUtils";
import { doesScheduleApply, parseExcludedDates, formatTimeSlot, getCapacityKey } from "./scheduleUtils";

export function useCapacitySchedules(sideId: number | null, currentWeek: Date, refreshKey: number) {
  const [capacityData, setCapacityData] = useState<Map<string, CapacityData>>(new Map());
  const [scheduleData, setScheduleData] = useState<Map<number, ScheduleData>>(new Map());

  useEffect(() => {
    if (!sideId) return;

    async function fetchCapacityData() {
      const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 6);

      const { data, error } = await supabase
        .from("capacity_schedules")
        .select("*")
        .eq("side_id", sideId)
        .lte("start_date", format(weekEnd, "yyyy-MM-dd"))
        .or(`end_date.is.null,end_date.gte.${format(weekStart, "yyyy-MM-dd")}`);

      if (error) {
        console.error("Error fetching capacity data:", error);
        return;
      }

      // Store full schedule data by ID
      const scheduleMap = new Map<number, ScheduleData>();
      data?.forEach((schedule) => {
        const excludedDates = parseExcludedDates(schedule.excluded_dates);
        const platforms = Array.isArray(schedule.platforms) ? schedule.platforms : [];
        scheduleMap.set(schedule.id, {
          ...schedule,
          excluded_dates: excludedDates,
          platforms: platforms as number[],
        });
      });
      setScheduleData(scheduleMap);

      // Build a map of capacity data by day and time
      const capacityMap = new Map<string, CapacityData>();
      const currentWeekDays = eachDayOfInterval({
        start: weekStart,
        end: addDays(weekStart, 6),
      });

      currentWeekDays.forEach((day) => {
        const dayOfWeek = getDay(day);
        const dayDate = format(day, "yyyy-MM-dd");

        // Generate time slots for this day
        for (let hour = 0; hour < 24; hour++) {
          const slot: TimeSlot = { hour, minute: 0 };
          const timeStr = formatTimeSlot(slot);
          const key = getCapacityKey(day, slot);

          // Find the most specific schedule that applies
          const applicableSchedule = data?.find((schedule) =>
            doesScheduleApply(
              { ...schedule, excluded_dates: parseExcludedDates(schedule.excluded_dates) } as ScheduleData,
              dayOfWeek,
              dayDate,
              timeStr
            )
          );

          if (applicableSchedule) {
            const platforms = Array.isArray(applicableSchedule.platforms) ? applicableSchedule.platforms : [];
            capacityMap.set(key, {
              capacity: applicableSchedule.capacity,
              periodType: applicableSchedule.period_type,
              scheduleId: applicableSchedule.id,
              startTime: applicableSchedule.start_time,
              endTime: applicableSchedule.end_time,
              recurrenceType: applicableSchedule.recurrence_type,
              platforms: platforms as number[],
            });
          }
        }
      });

      setCapacityData(capacityMap);
    }

    fetchCapacityData();
  }, [sideId, currentWeek, refreshKey]);

  return { capacityData, scheduleData };
}

