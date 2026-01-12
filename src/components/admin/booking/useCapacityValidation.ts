import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, getDay, addWeeks } from 'date-fns';
import { supabase } from '../../../lib/supabaseClient';
import { getSideIdByKeyNode } from '../../../nodes/data/sidesNodes';
import {
  doesScheduleApply,
  parseExcludedDates,
  formatTimeSlot,
  type ScheduleData,
} from '../capacity/scheduleUtils';
import { combineDateAndTime } from './utils';

type CapacityCheckResult = {
  isValid: boolean;
  violations: Array<{
    time: string; // ISO timestamp
    timeStr: string; // Human-readable time
    used: number;
    limit: number;
    periodType: string;
  }>;
  maxUsed: number;
  maxLimit: number;
  maxViolationTime: string | null;
};

type BookingInstance = {
  id: number;
  start: string;
  end: string;
  capacity: number;
};

/**
 * Calculate capacity usage at a specific point in time
 */
function calculateCapacityAtTime(
  time: Date,
  existingInstances: BookingInstance[],
  proposedCapacity: number,
  proposedStart: Date,
  proposedEnd: Date
): number {
  let total = 0;

  // Add capacity from existing instances that overlap with this time
  for (const instance of existingInstances) {
    const instStart = new Date(instance.start);
    const instEnd = new Date(instance.end);

    // Check if instance overlaps with this time point
    if (instStart <= time && time < instEnd) {
      total += instance.capacity || 0;
    }
  }

  // Add proposed booking capacity if it overlaps with this time
  if (proposedStart <= time && time < proposedEnd) {
    total += proposedCapacity;
  }

  return total;
}

/**
 * Get capacity limit for a specific date and time from schedules
 */
function getCapacityLimit(
  date: Date,
  time: Date,
  schedules: ScheduleData[]
): { capacity: number; periodType: string } | null {
  const dayOfWeek = getDay(date);
  const dateStr = format(date, 'yyyy-MM-dd');
  const timeStr = formatTimeSlot({
    hour: time.getHours(),
    minute: time.getMinutes(),
  });

  // Find applicable schedules
  const applicable = schedules.filter((schedule) => {
    const scheduleData: ScheduleData = {
      ...schedule,
      excluded_dates: parseExcludedDates(schedule.excluded_dates),
    };
    return doesScheduleApply(scheduleData, dayOfWeek, dateStr, timeStr);
  });

  if (applicable.length === 0) {
    // No schedule applies - assume unlimited capacity (or return a default)
    return null;
  }

  // Sort to get the most specific schedule
  applicable.sort((a, b) => {
    if (a.period_type === 'Closed' && b.period_type !== 'Closed') return 1;
    if (a.period_type !== 'Closed' && b.period_type === 'Closed') return -1;
    return b.start_time.localeCompare(a.start_time);
  });

  const schedule = applicable[0];
  return {
    capacity: schedule.capacity,
    periodType: schedule.period_type,
  };
}

/**
 * Check if a proposed booking would exceed capacity at any point in time
 */
export function checkCapacityViolations(
  _sideId: number,
  proposedStart: Date,
  proposedEnd: Date,
  proposedCapacity: number,
  existingInstances: BookingInstance[],
  schedules: ScheduleData[]
): CapacityCheckResult {
  const violations: CapacityCheckResult['violations'] = [];
  let maxUsed = 0;
  let maxLimit = Infinity;
  let maxViolationTime: string | null = null;

  // Generate time points to check (every 15 minutes during the proposed booking)
  const timePoints: Date[] = [];
  let current = new Date(proposedStart);

  while (current < proposedEnd) {
    timePoints.push(new Date(current));
    current = new Date(current.getTime() + 15 * 60 * 1000); // Add 15 minutes
  }

  // Also check the end time (exclusive, so we check just before)
  if (timePoints.length > 0) {
    const lastPoint = new Date(proposedEnd.getTime() - 1);
    if (lastPoint > timePoints[timePoints.length - 1]) {
      timePoints.push(lastPoint);
    }
  }

  // Track all limits encountered to find the most restrictive one
  const limitsEncountered: number[] = [];

  // Check each time point
  for (const timePoint of timePoints) {
    const used = calculateCapacityAtTime(
      timePoint,
      existingInstances,
      proposedCapacity,
      proposedStart,
      proposedEnd
    );

    const limitInfo = getCapacityLimit(proposedStart, timePoint, schedules);

    if (limitInfo) {
      const limit = limitInfo.capacity;
      limitsEncountered.push(limit);

      if (used > limit) {
        violations.push({
          time: timePoint.toISOString(),
          timeStr: format(timePoint, 'HH:mm'),
          used,
          limit,
          periodType: limitInfo.periodType,
        });

        if (used > maxUsed) {
          maxUsed = used;
          maxLimit = limit;
          maxViolationTime = timePoint.toISOString();
        }
      } else {
        // Track max usage even if not violating
        if (used > maxUsed) {
          maxUsed = used;
          maxLimit = limit;
        }
      }
    } else {
      // No limit set - track usage but no violation
      if (used > maxUsed) {
        maxUsed = used;
      }
    }
  }

  // If we never found a limit but encountered usage, try to find the most common limit
  // This handles cases where the booking spans multiple periods with different limits
  if (maxLimit === Infinity && limitsEncountered.length > 0) {
    // Use the minimum limit encountered (most restrictive)
    maxLimit = Math.min(...limitsEncountered);
  }

  return {
    isValid: violations.length === 0,
    violations,
    maxUsed,
    maxLimit,
    maxViolationTime,
  };
}

/**
 * Hook to validate capacity for a proposed booking
 */
export function useCapacityValidation(
  sideKey: 'Power' | 'Base',
  startDate: string | null,
  startTime: string | null,
  endTime: string | null,
  capacity: number,
  weeks: number,
  _weekRacks: Map<number, number[]>,
  weekCapacities: Map<number, number>
) {
  // Resolve side ID
  const { data: sideId } = useQuery({
    queryKey: ['side-id-for-capacity', sideKey],
    queryFn: async () => {
      return getSideIdByKeyNode(sideKey);
    },
    enabled: !!sideKey,
  });

  // Calculate date range for fetching schedules
  const dateRange = useMemo(() => {
    if (!startDate || !startTime || !endTime || !sideId) return null;

    const baseStart = combineDateAndTime(startDate, startTime);
    const baseEnd = combineDateAndTime(startDate, endTime);

    // Calculate the last week's end date
    const lastWeekEnd = addWeeks(baseEnd, weeks - 1);

    return {
      earliest: baseStart,
      latest: lastWeekEnd,
    };
  }, [startDate, startTime, endTime, weeks, sideId]);

  // Fetch capacity schedules
  const { data: schedules = [] } = useQuery({
    queryKey: [
      'capacity-schedules-for-validation',
      sideId,
      dateRange?.earliest,
      dateRange?.latest,
    ],
    queryFn: async () => {
      if (!sideId || !dateRange) return [];

      const weekStartStr = format(dateRange.earliest, 'yyyy-MM-dd');
      const weekEndStr = format(dateRange.latest, 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('capacity_schedules')
        .select('*')
        .eq('side_id', sideId)
        .lte('start_date', weekEndStr)
        .or(`end_date.is.null,end_date.gte.${weekStartStr}`);

      if (error) {
        console.error('[Capacity Validation] Error fetching schedules:', error);
        return [];
      }

      return (data ?? []).map((schedule) => ({
        ...schedule,
        excluded_dates: parseExcludedDates(schedule.excluded_dates),
        platforms: Array.isArray(schedule.platforms) ? schedule.platforms : [],
      })) as ScheduleData[];
    },
    enabled: !!sideId && !!dateRange,
  });

  // Fetch existing booking instances that overlap with the proposed booking
  const { data: existingInstances = [] } = useQuery({
    queryKey: [
      'existing-instances-for-capacity-check',
      sideId,
      dateRange?.earliest,
      dateRange?.latest,
    ],
    queryFn: async () => {
      if (!sideId || !dateRange) return [];

      const { data, error } = await supabase
        .from('booking_instances')
        .select('id, start, end, capacity')
        .eq('side_id', sideId)
        .lt('start', dateRange.latest.toISOString())
        .gt('end', dateRange.earliest.toISOString());

      if (error) {
        console.error('[Capacity Validation] Error fetching instances:', error);
        return [];
      }

      return (data ?? []).map((inst) => ({
        id: inst.id,
        start: inst.start,
        end: inst.end,
        capacity: (inst as { capacity?: number }).capacity || 0,
      })) as BookingInstance[];
    },
    enabled: !!sideId && !!dateRange,
  });

  // Validate capacity for each week
  const validationResults = useMemo(() => {
    if (
      !startDate ||
      !startTime ||
      !endTime ||
      !sideId ||
      schedules.length === 0
    ) {
      return [];
    }

    const results: Array<{
      week: number;
      result: CapacityCheckResult;
      proposedStart: Date;
      proposedEnd: Date;
      proposedCapacity: number;
    }> = [];

    for (let week = 0; week < weeks; week++) {
      const baseStart = combineDateAndTime(startDate, startTime);
      const baseEnd = combineDateAndTime(startDate, endTime);

      const proposedStart = addWeeks(baseStart, week);
      const proposedEnd = addWeeks(baseEnd, week);
      const proposedCapacity = weekCapacities.get(week) || capacity;

      // Filter existing instances to only those that overlap with this week
      const weekInstances = existingInstances.filter((inst) => {
        const instStart = new Date(inst.start);
        const instEnd = new Date(inst.end);
        return instStart < proposedEnd && instEnd > proposedStart;
      });

      const result = checkCapacityViolations(
        sideId,
        proposedStart,
        proposedEnd,
        proposedCapacity,
        weekInstances,
        schedules
      );

      results.push({
        week: week + 1,
        result,
        proposedStart,
        proposedEnd,
        proposedCapacity,
      });
    }

    return results;
  }, [
    startDate,
    startTime,
    endTime,
    sideId,
    schedules,
    existingInstances,
    weeks,
    capacity,
    weekCapacities,
  ]);

  // Overall validation result
  const overallResult = useMemo(() => {
    if (validationResults.length === 0) {
      return {
        isValid: true,
        hasWarnings: false,
        violations: [],
        maxUsed: 0,
        maxLimit: Infinity,
      };
    }

    const allViolations = validationResults.flatMap((r) =>
      r.result.violations.map((v) => ({
        ...v,
        week: r.week,
      }))
    );

    const isValid = allViolations.length === 0;
    const maxUsed = Math.max(
      ...validationResults.map((r) => r.result.maxUsed),
      0
    );
    const maxLimit = Math.min(
      ...validationResults
        .map((r) => r.result.maxLimit)
        .filter((l) => l !== Infinity),
      Infinity
    );

    return {
      isValid,
      hasWarnings: allViolations.length > 0,
      violations: allViolations,
      maxUsed,
      maxLimit,
      weekResults: validationResults,
    };
  }, [validationResults]);

  return {
    ...overallResult,
    isLoading: !sideId || !startDate || !startTime || !endTime,
  };
}
