import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, getDay, startOfWeek, addDays } from 'date-fns';
import { supabase } from '../../../lib/supabaseClient';
import {
  doesScheduleApply,
  parseExcludedDates,
  formatTimeSlot,
  type ScheduleData,
  type TimeSlot,
} from '../../admin/capacity/scheduleUtils';
import {
  getSideIdByKeyNode,
  type SideKey,
} from '../../../nodes/data/sidesNodes';

type Args = {
  side: 'power' | 'base';
  date: Date;
  timeSlots: TimeSlot[];
};

type SlotCapacityData = {
  availablePlatforms: Set<number> | null; // null = all available, Set = only these available
  isClosed: boolean;
  periodType: string | null;
  periodEndTime?: string; // The actual end time of the closed period (HH:mm format)
};

export function useScheduleDayCapacity({ side, date, timeSlots }: Args) {
  const [sideId, setSideId] = useState<number | null>(null);

  // Resolve sideId from side key (Power/Base)
  useEffect(() => {
    const sideKey: SideKey = side === 'power' ? 'Power' : 'Base';
    getSideIdByKeyNode(sideKey)
      .then(setSideId)
      .catch((err) => {
        console.error('[Schedule] Error fetching sideId:', err);
        setSideId(null);
      });
  }, [side]);

  const dateStr = format(date, 'yyyy-MM-dd');
  const dayOfWeek = getDay(date);

  // Calculate week range for fetching schedules (week starts on Monday)
  const weekStart = useMemo(() => {
    return startOfWeek(date, { weekStartsOn: 1 });
  }, [date]);

  const weekEnd = useMemo(() => {
    return addDays(weekStart, 6);
  }, [weekStart]);

  // Fetch capacity schedules for the surrounding week
  const { data: capacitySchedules = [], isLoading: schedulesLoading } =
    useQuery({
      queryKey: ['capacity-schedules-for-schedule-day', sideId, dateStr],
      queryFn: async () => {
        if (!sideId) return [];

        const weekStartStr = format(weekStart, 'yyyy-MM-dd');
        const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

        const { data, error } = await supabase
          .from('capacity_schedules')
          .select('*')
          .eq('side_id', sideId)
          .lte('start_date', weekEndStr)
          .or(`end_date.is.null,end_date.gte.${weekStartStr}`);

        if (error) {
          console.error('[Schedule] Error fetching capacity schedules:', error);
          return [];
        }

        return (data ?? []) as ScheduleData[];
      },
      enabled: !!sideId,
      staleTime: 30000,
    });

  // Fetch default platforms for each period type
  const { data: defaultPlatformsByType = new Map() } = useQuery({
    queryKey: ['default-platforms-by-type', sideId],
    queryFn: async () => {
      if (!sideId) return new Map<string, number[]>();

      const { data, error } = await supabase
        .from('period_type_capacity_defaults')
        .select('period_type, platforms')
        .eq('side_id', sideId);

      if (error) {
        console.error('[Schedule] Error fetching default platforms:', error);
        return new Map<string, number[]>();
      }

      const map = new Map<string, number[]>();
      data?.forEach((row) => {
        if (row.platforms && Array.isArray(row.platforms)) {
          map.set(row.period_type, row.platforms as number[]);
        }
      });

      return map;
    },
    enabled: !!sideId,
  });

  // Calculate capacity data for each time slot
  const slotCapacityData = useMemo(() => {
    if (schedulesLoading || !capacitySchedules.length) {
      return new Map<number, SlotCapacityData>();
    }

    const slotData = new Map<number, SlotCapacityData>();

    timeSlots.forEach((slot, slotIndex) => {
      const timeStr = formatTimeSlot(slot);

      // Find the applicable schedule for this time slot
      const potentiallyApplicable = capacitySchedules.filter((schedule) => {
        const scheduleData: ScheduleData = {
          ...schedule,
          excluded_dates: parseExcludedDates(schedule.excluded_dates),
        };
        return doesScheduleApply(scheduleData, dayOfWeek, dateStr, timeStr);
      });

      // Sort to get the most specific schedule
      if (potentiallyApplicable.length > 1) {
        potentiallyApplicable.sort((a, b) => {
          if (a.period_type === 'Closed' && b.period_type !== 'Closed')
            return 1;
          if (a.period_type !== 'Closed' && b.period_type === 'Closed')
            return -1;
          return b.start_time.localeCompare(a.start_time);
        });
      }

      const applicableSchedule = potentiallyApplicable[0] || null;

      if (!applicableSchedule) {
        // No schedule applies, all platforms available
        slotData.set(slotIndex, {
          availablePlatforms: null,
          isClosed: false,
          periodType: null,
        });
        return;
      }

      // Closed period = no platforms available
      if (applicableSchedule.period_type === 'Closed') {
        slotData.set(slotIndex, {
          availablePlatforms: new Set<number>(),
          isClosed: true,
          periodType: 'Closed',
          periodEndTime: applicableSchedule.end_time, // Store the actual end time
        });
        return;
      }

      // Determine available platforms
      // Logic: If platforms is explicitly set (even if empty array), use it
      // If platforms is null/undefined, check defaults
      // If no defaults, all platforms are available (null)
      let availablePlatforms: Set<number> | null = null;

      // Parse platforms from schedule (handle JSONB)
      const schedulePlatforms = applicableSchedule.platforms;
      const parsedPlatforms = Array.isArray(schedulePlatforms)
        ? (schedulePlatforms as number[])
        : schedulePlatforms !== null && schedulePlatforms !== undefined
          ? []
          : null;

      if (parsedPlatforms !== null) {
        // Platforms explicitly set in schedule (could be empty array for General User)
        availablePlatforms = new Set(parsedPlatforms);
      } else {
        // Check defaults for this period type
        const defaults = defaultPlatformsByType.get(
          applicableSchedule.period_type
        );
        if (defaults !== undefined && defaults.length > 0) {
          availablePlatforms = new Set(defaults);
        } else {
          // No defaults or empty defaults, all platforms available
          availablePlatforms = null;
        }
      }

      slotData.set(slotIndex, {
        availablePlatforms,
        isClosed: false,
        periodType: applicableSchedule.period_type,
      });
    });

    return slotData;
  }, [
    capacitySchedules,
    schedulesLoading,
    timeSlots,
    dayOfWeek,
    dateStr,
    defaultPlatformsByType,
  ]);

  return {
    sideId,
    slotCapacityData,
    isLoading: schedulesLoading,
    capacitySchedules,
  };
}
