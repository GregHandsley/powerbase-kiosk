import { useQuery } from '@tanstack/react-query';
import { format, getDay } from 'date-fns';
import { supabase } from '../lib/supabaseClient';
import { getSideIdByKeyNode, type SideKey } from '../nodes/data/sidesNodes';
import {
  doesScheduleApply,
  parseExcludedDates,
  formatTimeSlot,
  type ScheduleData,
} from '../components/admin/capacity/scheduleUtils';

type UseKioskCapacityResult = {
  used: number;
  limit: number | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
};

/**
 * Round time to nearest 15-minute interval for stable query keys
 */
function roundToNearest15Minutes(date: Date): Date {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  const roundedMinutes = Math.floor(minutes / 15) * 15;
  rounded.setMinutes(roundedMinutes, 0, 0);
  return rounded;
}

/**
 * Hook to fetch current capacity usage for a kiosk side at the current time
 * Updates every 15 minutes to match booking intervals
 */
export function useKioskCapacity(
  sideKey: SideKey,
  currentTime: Date
): UseKioskCapacityResult {
  // Round time to nearest 15-minute interval for stable query keys
  // This prevents the query from refetching every second
  const roundedTime = roundToNearest15Minutes(currentTime);
  const dateStr = format(roundedTime, 'yyyy-MM-dd');
  const timeStr = formatTimeSlot({
    hour: roundedTime.getHours(),
    minute: roundedTime.getMinutes(),
  });
  const dayOfWeek = getDay(roundedTime);

  // Fetch sideId
  const { data: sideId } = useQuery({
    queryKey: ['side-id', sideKey],
    queryFn: async () => {
      return await getSideIdByKeyNode(sideKey);
    },
    staleTime: Infinity, // Side ID doesn't change
  });

  // Fetch capacity schedules for the current week
  const {
    data: capacitySchedules = [],
    isLoading: schedulesLoading,
    isFetching: schedulesFetching,
  } = useQuery({
    queryKey: ['kiosk-capacity-schedules', sideId, dateStr, dayOfWeek],
    queryFn: async () => {
      if (!sideId) return [];

      // Calculate week range
      const dateObj = new Date(roundedTime);
      const weekStart = new Date(dateObj);
      weekStart.setDate(dateObj.getDate() - dayOfWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('capacity_schedules')
        .select('*')
        .eq('side_id', sideId)
        .lte('start_date', weekEndStr)
        .or(`end_date.is.null,end_date.gte.${weekStartStr}`);

      if (error) {
        console.error('[Kiosk] Error fetching capacity schedules:', error);
        return [];
      }

      return (data ?? []) as ScheduleData[];
    },
    enabled: !!sideId,
    staleTime: 30000,
    refetchInterval: 900000, // Refresh every 15 minutes (bookings are on 15-min intervals)
    placeholderData: (previousData) => previousData, // Keep previous data during refetch
  });

  // Find applicable schedule for current time
  const applicableSchedule = capacitySchedules.find((schedule) => {
    const scheduleData: ScheduleData = {
      ...schedule,
      excluded_dates: parseExcludedDates(schedule.excluded_dates),
    };
    return doesScheduleApply(scheduleData, dayOfWeek, dateStr, timeStr);
  });

  const capacityLimit =
    applicableSchedule && applicableSchedule.period_type !== 'Closed'
      ? applicableSchedule.capacity
      : null;

  // Fetch current capacity usage from booking instances
  const {
    data: capacityUsage,
    isLoading: usageLoading,
    isFetching: usageFetching,
    error,
  } = useQuery({
    queryKey: [
      'kiosk-capacity-usage',
      sideId,
      roundedTime.toISOString(), // Use rounded time for stable query key
    ],
    queryFn: async () => {
      if (!sideId) return { used: 0 };

      // Use actual currentTime for the query (not rounded) to get real-time data
      const queryTime = currentTime.toISOString();

      // Fetch all booking instances that overlap with current time
      const { data: instances, error: instancesError } = await supabase
        .from('booking_instances')
        .select('id, capacity')
        .eq('side_id', sideId)
        .lte('start', queryTime)
        .gt('end', queryTime);

      if (instancesError) {
        console.error('[Kiosk] Error fetching capacity usage:', instancesError);
        throw instancesError;
      }

      // Sum up the capacity from all overlapping instances
      const used = (instances ?? []).reduce((sum, inst) => {
        return sum + ((inst as { capacity?: number }).capacity || 0);
      }, 0);

      return { used };
    },
    enabled: !!sideId,
    staleTime: 0, // Always fetch fresh data
    refetchInterval: 900000, // Refresh every 15 minutes (bookings are on 15-min intervals)
    placeholderData: (previousData) => previousData, // Keep previous data during refetch
  });

  return {
    used: capacityUsage?.used ?? 0,
    limit: capacityLimit,
    isLoading: schedulesLoading || usageLoading, // Only true on initial load
    isFetching: schedulesFetching || usageFetching, // True during refetches
    error: error instanceof Error ? error.message : null,
  };
}
