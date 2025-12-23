import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, getDay } from "date-fns";
import { supabase } from "../../../lib/supabaseClient";
import {
  doesScheduleApply,
  parseExcludedDates,
  type ScheduleData,
} from "../../admin/capacity/scheduleUtils";
import { getSideIdByKeyNode, type SideKey } from "../../../nodes/data/sidesNodes";

type Args = {
  side: "power" | "base";
  date: string;
  time: string;
};

export function useScheduleViewCapacity({ side, date, time }: Args) {
  const [sideId, setSideId] = useState<number | null>(null);

  // Resolve sideId from side key (Power/Base)
  useEffect(() => {
    const sideKey: SideKey = side === "power" ? "Power" : "Base";
    getSideIdByKeyNode(sideKey)
      .then(setSideId)
      .catch((err) => {
        console.error("[Schedule View] Error fetching sideId:", err);
        setSideId(null);
      });
  }, [side]);

  const bookingDayOfWeek = useMemo(() => {
    if (!date) return null;
    const [year, month, day] = date.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    return getDay(dateObj);
  }, [date]);

  // Fetch capacity schedules for the surrounding week
  const { data: capacitySchedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: ["capacity-schedules-for-schedule-view", sideId, date, bookingDayOfWeek],
    queryFn: async () => {
      if (!sideId || !date || bookingDayOfWeek === null) {
        return [];
      }

      const [year, month, day] = date.split("-").map(Number);
      const dateObj = new Date(year, month - 1, day);
      const dayOfWeek = getDay(dateObj);

      const weekStart = new Date(dateObj);
      weekStart.setDate(dateObj.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekStartStr = format(weekStart, "yyyy-MM-dd");
      const weekEndStr = format(weekEnd, "yyyy-MM-dd");

      const { data, error } = await supabase
        .from("capacity_schedules")
        .select("*")
        .eq("side_id", sideId)
        .lte("start_date", weekEndStr)
        .or(`end_date.is.null,end_date.gte.${weekStartStr}`);

      if (error) {
        console.error("[Schedule View] Error fetching capacity schedules:", error);
        return [];
      }

      return (data ?? []) as ScheduleData[];
    },
    enabled: !!sideId && !!date && bookingDayOfWeek !== null,
    staleTime: 30000,
  });

  // Pick the single schedule that applies to this date/time
  const applicableSchedule = useMemo(() => {
    if (schedulesLoading || !capacitySchedules.length || !time || bookingDayOfWeek === null || !date) {
      return null;
    }

    const potentiallyApplicable = capacitySchedules.filter((schedule) => {
      const scheduleData: ScheduleData = {
        ...schedule,
        excluded_dates: parseExcludedDates(schedule.excluded_dates),
      };
      return doesScheduleApply(scheduleData, bookingDayOfWeek, date, time);
    });

    if (potentiallyApplicable.length > 1) {
      potentiallyApplicable.sort((a, b) => {
        if (a.period_type === "Closed" && b.period_type !== "Closed") return 1;
        if (a.period_type !== "Closed" && b.period_type === "Closed") return -1;
        return b.start_time.localeCompare(a.start_time);
      });
    }

    return potentiallyApplicable[0] || null;
  }, [capacitySchedules, schedulesLoading, time, bookingDayOfWeek, date]);

  // Fetch default platforms for the applicable schedule's period type (if needed)
  const { data: defaultPlatforms } = useQuery({
    queryKey: ["default-platforms-schedule-view", sideId, applicableSchedule?.period_type],
    queryFn: async () => {
      if (!sideId || !applicableSchedule) {
        return null;
      }

      if (applicableSchedule.platforms !== null && applicableSchedule.platforms !== undefined) {
        return null;
      }

      const { data, error } = await supabase
        .from("period_type_capacity_defaults")
        .select("platforms")
        .eq("period_type", applicableSchedule.period_type)
        .eq("side_id", sideId)
        .maybeSingle();

      if (error) {
        console.error("[Schedule View] Error fetching default platforms:", error);
        return null;
      }

      if (data?.platforms && Array.isArray(data.platforms)) {
        return data.platforms as number[];
      }

      return [];
    },
    enabled: !!sideId && !!applicableSchedule,
  });

  // Determine available platforms for this time
  const availablePlatforms = useMemo(() => {
    if (!applicableSchedule) {
      return null; // No schedule applies, all platforms available
    }

    // Closed = no platforms available
    if (applicableSchedule.period_type === "Closed") {
      return new Set<number>();
    }

    if (applicableSchedule.platforms !== null && applicableSchedule.platforms !== undefined) {
      const platforms = Array.isArray(applicableSchedule.platforms)
        ? (applicableSchedule.platforms as number[])
        : [];
      return new Set(platforms);
    }

    if (defaultPlatforms !== null && defaultPlatforms !== undefined) {
      return new Set(defaultPlatforms);
    }

    return null;
  }, [applicableSchedule, defaultPlatforms]);

  const isClosedPeriod = applicableSchedule?.period_type === "Closed";

  return {
    sideId,
    applicableSchedule,
    availablePlatforms,
    isClosedPeriod,
  };
}


