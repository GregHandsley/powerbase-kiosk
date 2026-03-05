import type { QueryClient } from '@tanstack/react-query';
import { addWeeks, format } from 'date-fns';
import { supabase } from '../../../../lib/supabaseClient';
import type { ActiveInstance } from '../../../../types/snapshot';
import { checkCapacityViolations } from '../../../admin/booking/useCapacityValidation';
import type { ScheduleData } from '../../../admin/capacity/scheduleUtils';
import { parseExcludedDates } from '../../../admin/capacity/scheduleUtils';
import type { SeriesInstance } from '../types';

export type PerformBookingExtendParams = {
  booking: ActiveInstance;
  userId: string | null;
  seriesInstances: SeriesInstance[];
  extendWeeks: number;
  setExtending: (value: boolean) => void;
  setError: (value: string | null) => void;
  setShowExtendDialog: (value: boolean) => void;
  setExtendWeeks: (value: number) => void;
  queryClient: QueryClient;
};

export async function performBookingExtend(
  params: PerformBookingExtendParams
): Promise<boolean> {
  const {
    booking,
    userId,
    seriesInstances,
    extendWeeks,
    setExtending,
    setError,
    setShowExtendDialog,
    setExtendWeeks,
    queryClient,
  } = params;

  if (seriesInstances.length === 0 || extendWeeks < 1) return false;

  setExtending(true);
  setError(null);

  try {
    const lastInstance = seriesInstances[seriesInstances.length - 1];
    const firstInstance = seriesInstances[0];

    let weekOffset = 1;
    if (seriesInstances.length > 1) {
      const firstDate = new Date(firstInstance.start);
      const secondDate = new Date(seriesInstances[1].start);
      const diffMs = secondDate.getTime() - firstDate.getTime();
      const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
      weekOffset = diffWeeks;
    }

    const lastStart = new Date(lastInstance.start);
    const lastEnd = new Date(lastInstance.end);
    const racks = firstInstance.racks || [];
    const areas = firstInstance.areas || [];
    const sideId = firstInstance.sideId;
    const originalCapacity =
      firstInstance.capacity || lastInstance.capacity || 1;

    const earliestDate = addWeeks(lastStart, weekOffset);
    const latestDate = addWeeks(lastEnd, weekOffset * extendWeeks);
    const weekStartStr = format(earliestDate, 'yyyy-MM-dd');
    const weekEndStr = format(latestDate, 'yyyy-MM-dd');

    const { data: schedules, error: schedulesError } = await supabase
      .from('capacity_schedules')
      .select('*')
      .eq('side_id', sideId)
      .lte('start_date', weekEndStr)
      .or(`end_date.is.null,end_date.gte.${weekStartStr}`);

    if (schedulesError) {
      console.error('Error fetching capacity schedules:', schedulesError);
      throw new Error(
        `Error fetching capacity schedules: ${schedulesError.message}`
      );
    }

    const allSchedules: ScheduleData[] = (schedules ?? []).map((s) => ({
      ...s,
      excluded_dates: parseExcludedDates(s.excluded_dates),
      platforms: Array.isArray(s.platforms) ? s.platforms : [],
    })) as ScheduleData[];

    const { data: existingInstancesData, error: existingInstancesError } =
      await supabase
        .from('booking_instances')
        .select('id, start, end, capacity')
        .eq('side_id', sideId)
        .lt('start', latestDate.toISOString())
        .gt('end', earliestDate.toISOString());

    if (existingInstancesError) {
      console.error(
        'Error fetching existing instances:',
        existingInstancesError
      );
      throw new Error(
        `Error fetching existing instances: ${existingInstancesError.message}`
      );
    }

    const existingInstances: Array<{
      id: number;
      start: string;
      end: string;
      capacity: number;
    }> = (existingInstancesData ?? []).map((inst) => ({
      id: inst.id,
      start: inst.start,
      end: inst.end,
      capacity: (inst as { capacity?: number }).capacity || 0,
    }));

    const capacityViolations: Array<{
      week: number;
      newInstanceTime: string;
      violation: string;
    }> = [];

    const conflicts: Array<{
      week: number;
      rack: number;
      conflictingBooking: string;
      conflictTime: string;
      newInstanceTime: string;
    }> = [];

    const newInstancesForCapacity: Array<{
      start: string;
      end: string;
      capacity: number;
    }> = [];

    for (let i = 1; i <= extendWeeks; i++) {
      const newStart = addWeeks(lastStart, weekOffset * i);
      const newEnd = addWeeks(lastEnd, weekOffset * i);

      const allInstancesForCapacity = [
        ...existingInstances,
        ...newInstancesForCapacity.map((inst) => ({
          id: -1,
          start: inst.start,
          end: inst.end,
          capacity: inst.capacity,
        })),
      ];

      const result = checkCapacityViolations(
        sideId,
        newStart,
        newEnd,
        originalCapacity,
        allInstancesForCapacity,
        allSchedules
      );

      if (!result.isValid) {
        const formatDateTime = (date: Date) =>
          date.toLocaleString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

        const maxViolation = result.violations.reduce(
          (max, v) => (v.used > max.used ? v : max),
          result.violations[0]
        );
        capacityViolations.push({
          week: i,
          newInstanceTime: `${formatDateTime(newStart)} - ${formatDateTime(newEnd)}`,
          violation: `Exceeds capacity by ${result.maxUsed - result.maxLimit} athlete${result.maxUsed - result.maxLimit !== 1 ? 's' : ''} at ${maxViolation.timeStr} (${maxViolation.used} / ${maxViolation.limit}, ${maxViolation.periodType})`,
        });
      } else {
        newInstancesForCapacity.push({
          start: newStart.toISOString(),
          end: newEnd.toISOString(),
          capacity: originalCapacity,
        });
      }

      const { data: overlappingInstances, error: overlapError } = await supabase
        .from('booking_instances')
        .select(
          `
            id,
            start,
            "end",
            racks,
            booking:bookings (
              title
            )
          `
        )
        .eq('side_id', sideId)
        .lt('start', newEnd.toISOString())
        .gt('end', newStart.toISOString())
        .neq('booking_id', booking.bookingId);

      if (overlapError) {
        console.error('Error checking for conflicts:', overlapError);
        throw new Error(
          `Error checking for conflicts: ${overlapError.message}`
        );
      }

      for (const rack of racks) {
        const conflictingInstance = overlappingInstances?.find((inst) => {
          const instRacks = Array.isArray(inst.racks) ? inst.racks : [];
          return instRacks.includes(rack);
        });

        if (conflictingInstance) {
          const formatDateTime = (isoString: string) => {
            const date = new Date(isoString);
            return date.toLocaleString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          };

          conflicts.push({
            week: i,
            rack,
            conflictingBooking:
              (conflictingInstance.booking as { title?: string })?.title ??
              'Unknown',
            conflictTime: `${formatDateTime(conflictingInstance.start)} - ${formatDateTime(conflictingInstance.end)}`,
            newInstanceTime: `${formatDateTime(newStart.toISOString())} - ${formatDateTime(newEnd.toISOString())}`,
          });
        }
      }
    }

    if (capacityViolations.length > 0) {
      const errorParts: string[] = [];
      errorParts.push('⚠️ Capacity exceeded for extension:\n');
      errorParts.push(
        'The following weeks cannot be extended due to capacity limits:\n'
      );

      capacityViolations.forEach((violation) => {
        errorParts.push(
          `\nWeek ${violation.week} (${violation.newInstanceTime}):`
        );
        errorParts.push(`  • ${violation.violation}`);
      });

      setError(errorParts.join('\n'));
      setExtending(false);
      return false;
    }

    if (conflicts.length > 0) {
      const conflictsByWeek = new Map<
        number,
        Map<
          string,
          { racks: number[]; conflictTime: string; newInstanceTime: string }
        >
      >();

      conflicts.forEach((conflict) => {
        if (!conflictsByWeek.has(conflict.week)) {
          conflictsByWeek.set(conflict.week, new Map());
        }
        const weekMap = conflictsByWeek.get(conflict.week)!;
        if (!weekMap.has(conflict.conflictingBooking)) {
          weekMap.set(conflict.conflictingBooking, {
            racks: [],
            conflictTime: conflict.conflictTime,
            newInstanceTime: conflict.newInstanceTime,
          });
        }
        weekMap.get(conflict.conflictingBooking)!.racks.push(conflict.rack);
      });

      const errorParts: string[] = [];
      errorParts.push('⚠️ Extension conflicts detected:\n');
      errorParts.push(
        'The following weeks cannot be extended due to overlapping bookings:\n'
      );

      conflictsByWeek.forEach((weekConflicts, week) => {
        const firstConflict = weekConflicts.values().next().value;
        const newInstanceTime =
          firstConflict?.newInstanceTime ?? 'unknown time';
        errorParts.push(`\nWeek ${week} (${newInstanceTime}):`);

        weekConflicts.forEach((details, bookingTitle) => {
          const racksList = details.racks.sort((a, b) => a - b).join(', ');
          errorParts.push(
            `  • Rack${details.racks.length > 1 ? 's' : ''} ${racksList} conflict with "${bookingTitle}" (${details.conflictTime})`
          );
        });
      });

      setError(errorParts.join('\n'));
      setExtending(false);
      return false;
    }

    const instancesPayload: {
      booking_id: number;
      side_id: number;
      start: string;
      end: string;
      areas: string[];
      racks: number[];
      capacity: number;
    }[] = [];

    for (let i = 1; i <= extendWeeks; i++) {
      const start = addWeeks(lastStart, weekOffset * i);
      const end = addWeeks(lastEnd, weekOffset * i);
      instancesPayload.push({
        booking_id: booking.bookingId,
        side_id: sideId,
        start: start.toISOString(),
        end: end.toISOString(),
        areas,
        racks,
        capacity: originalCapacity,
      });
    }

    const { error: instancesError } = await supabase
      .from('booking_instances')
      .insert(instancesPayload);

    if (instancesError) {
      throw new Error(instancesError.message);
    }

    if (userId) {
      const { data: bookingFullData } = await supabase
        .from('bookings')
        .select('organization_id, site_id, title')
        .eq('id', booking.bookingId)
        .single();

      if (bookingFullData?.organization_id) {
        const { ActivityLogger } =
          await import('../../../../lib/activityLogger');
        ActivityLogger.booking
          .updated(
            bookingFullData.organization_id,
            bookingFullData.site_id ?? null,
            userId,
            booking.bookingId,
            {
              instances_count: seriesInstances.length,
            },
            {
              instances_count: seriesInstances.length + extendWeeks,
            },
            {
              title: bookingFullData.title,
              action: 'extended',
              weeks_added: extendWeeks,
              description: `Extended booking by ${extendWeeks} week${extendWeeks > 1 ? 's' : ''}`,
            }
          )
          .catch((err) => {
            console.error('Failed to log booking extension activity:', err);
          });
      }
    }

    await queryClient.invalidateQueries({
      queryKey: ['snapshot'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['booking-instances-debug'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['booking-instances-for-time'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['booking-series'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['booking-series-racks'],
      exact: false,
    });
    await queryClient.invalidateQueries({
      queryKey: ['schedule-bookings'],
      exact: false,
    });
    await queryClient.refetchQueries({
      queryKey: ['snapshot'],
      exact: false,
    });

    setShowExtendDialog(false);
    setExtendWeeks(1);
    return true;
  } catch (err) {
    console.error('Failed to extend booking', err);
    setError(err instanceof Error ? err.message : 'Failed to extend booking');
    return false;
  } finally {
    setExtending(false);
  }
}
