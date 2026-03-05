import type { QueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '../../../../lib/supabaseClient';
import {
  formatTimeForInput,
  getTimeDifference,
} from '../../../shared/dateUtils';
import type { ActiveInstance } from '../../../../types/snapshot';
import { checkCapacityViolations } from '../../../admin/booking/useCapacityValidation';
import type { ScheduleData } from '../../../admin/capacity/scheduleUtils';
import { parseExcludedDates } from '../../../admin/capacity/scheduleUtils';
import type { BookingStatus } from '../../../../types/db';
import { saveAreaSlotsForInstance } from '../../../../nodes/data/areaSlotsNodes';
import { combineDateAndTime } from '../../../admin/booking/utils';
import {
  isAfterCutoff,
  getBookingCutoff,
  getCutoffMessage,
} from '../../../../utils/cutoff';
import {
  createTasksForUsers,
  getUserIdsByRole,
} from '../../../../hooks/useTasks';
import type { SeriesInstance } from '../types';
import type { AreaSlotFormEntry, OriginalValues } from '../types';

export type PerformBookingUpdateParams = {
  booking: ActiveInstance;
  selectedInstances: Set<number>;
  seriesInstances: SeriesInstance[];
  startTime: string;
  endTime: string;
  capacity: number;
  hasTimeChanges: boolean;
  hasCapacityChanges: boolean;
  areaSlotsForm: AreaSlotFormEntry[];
  originalValues: OriginalValues;
  setError: (value: string | null) => void;
  setSaving: (value: boolean) => void;
  queryClient: QueryClient;
  userId: string | null;
  role: string | undefined;
};

export async function performBookingUpdate(
  params: PerformBookingUpdateParams
): Promise<boolean> {
  const {
    booking,
    selectedInstances,
    seriesInstances,
    startTime,
    endTime,
    capacity,
    hasTimeChanges,
    hasCapacityChanges,
    areaSlotsForm,
    // originalValues,
    setError,
    setSaving,
    queryClient,
    userId,
    role,
  } = params;

  setSaving(true);
  setError(null);

  try {
    const originalStartTime = formatTimeForInput(booking.start);
    const originalEndTime = formatTimeForInput(booking.end);
    const startDiff = getTimeDifference(originalStartTime, startTime);
    const endDiff = getTimeDifference(originalEndTime, endTime);

    const instancesToUpdate = Array.from(selectedInstances)
      .map((instanceId) => {
        const instance = seriesInstances.find((inst) => inst.id === instanceId);
        if (!instance) return null;

        const instanceStart = new Date(instance.start);
        const instanceEnd = new Date(instance.end);

        let newStart = instanceStart;
        let newEnd = instanceEnd;

        if (hasTimeChanges) {
          newStart = new Date(instanceStart);
          newStart.setHours(newStart.getHours() + startDiff.hours);
          newStart.setMinutes(newStart.getMinutes() + startDiff.minutes);

          newEnd = new Date(instanceEnd);
          newEnd.setHours(newEnd.getHours() + endDiff.hours);
          newEnd.setMinutes(newEnd.getMinutes() + endDiff.minutes);
        }

        return {
          instanceId,
          instance,
          newStart,
          newEnd,
          newCapacity: hasCapacityChanges ? capacity : instance.capacity || 1,
          racks: instance.racks,
          sideId: instance.sideId,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (hasCapacityChanges) {
      const sideIds = new Set(instancesToUpdate.map((inst) => inst.sideId));
      const allSchedules: ScheduleData[] = [];

      for (const sideId of sideIds) {
        const earliestDate = instancesToUpdate
          .filter((inst) => inst.sideId === sideId)
          .reduce(
            (earliest, inst) =>
              inst.newStart < earliest ? inst.newStart : earliest,
            instancesToUpdate[0].newStart
          );
        const latestDate = instancesToUpdate
          .filter((inst) => inst.sideId === sideId)
          .reduce(
            (latest, inst) => (inst.newEnd > latest ? inst.newEnd : latest),
            instancesToUpdate[0].newEnd
          );

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
        } else {
          allSchedules.push(
            ...((schedules ?? []).map((s) => ({
              ...s,
              excluded_dates: parseExcludedDates(s.excluded_dates),
              platforms: Array.isArray(s.platforms) ? s.platforms : [],
            })) as ScheduleData[])
          );
        }
      }

      const instanceIdsToExclude = instancesToUpdate.map(
        (inst) => inst.instanceId
      );
      const existingInstances: Array<{
        id: number;
        start: string;
        end: string;
        capacity: number;
      }> = [];

      for (const sideId of sideIds) {
        const { data: instances, error: instancesError } = await supabase
          .from('booking_instances')
          .select('id, start, end, capacity')
          .eq('side_id', sideId)
          .not('id', 'in', `(${instanceIdsToExclude.join(',')})`);

        if (instancesError) {
          console.error('Error fetching existing instances:', instancesError);
        } else {
          existingInstances.push(
            ...(instances ?? []).map((inst) => ({
              id: inst.id,
              start: inst.start,
              end: inst.end,
              capacity: (inst as { capacity?: number }).capacity || 0,
            }))
          );
        }
      }

      for (const instanceToUpdate of instancesToUpdate) {
        const schedulesForSide = allSchedules.filter(
          (s) => s.side_id === instanceToUpdate.sideId
        );
        const existingForSide = existingInstances.filter((inst) => {
          const instStart = new Date(inst.start);
          const instEnd = new Date(inst.end);
          return (
            instStart < instanceToUpdate.newEnd &&
            instEnd > instanceToUpdate.newStart
          );
        });

        const result = checkCapacityViolations(
          instanceToUpdate.sideId,
          instanceToUpdate.newStart,
          instanceToUpdate.newEnd,
          instanceToUpdate.newCapacity,
          existingForSide,
          schedulesForSide
        );

        if (!result.isValid) {
          const formatDate = (date: Date) =>
            date.toLocaleDateString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
          const formatTime = (date: Date) =>
            date.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

          const dateStr = formatDate(instanceToUpdate.newStart);
          const timeRange = `${formatTime(instanceToUpdate.newStart)} - ${formatTime(instanceToUpdate.newEnd)}`;

          const errorParts: string[] = [];
          errorParts.push(
            `⚠️ Capacity exceeded for ${dateStr} (${timeRange}):\n`
          );
          errorParts.push(
            `This change would exceed capacity by ${result.maxUsed - result.maxLimit} athlete${result.maxUsed - result.maxLimit !== 1 ? 's' : ''} at peak times.\n`
          );

          if (result.violations.length > 0) {
            const maxViolation = result.violations.reduce(
              (max, v) => (v.used > max.used ? v : max),
              result.violations[0]
            );
            errorParts.push(
              `Peak violation at ${maxViolation.timeStr}: ${maxViolation.used} / ${maxViolation.limit} athletes (${maxViolation.periodType})`
            );
          }

          setError(errorParts.join('\n'));
          setSaving(false);
          return false;
        }
      }
    }

    const conflicts: Array<{
      instanceId: number;
      instanceTime: string;
      rack: number;
      conflictingBooking: string;
      conflictTime: string;
    }> = [];

    for (const instanceToUpdate of instancesToUpdate) {
      const { data: overlappingInstances, error: overlapError } = await supabase
        .from('booking_instances')
        .select(
          `
            id,
            booking_id,
            start,
            "end",
            racks,
            booking:bookings (
              title
            )
          `
        )
        .eq('side_id', instanceToUpdate.sideId)
        .lt('start', instanceToUpdate.newEnd.toISOString())
        .gt('end', instanceToUpdate.newStart.toISOString())
        .neq('booking_id', booking.bookingId);

      if (overlapError) {
        console.error('Error checking for conflicts:', overlapError);
        throw new Error(
          `Error checking for conflicts: ${overlapError.message}`
        );
      }

      for (const rack of instanceToUpdate.racks) {
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
            instanceId: instanceToUpdate.instanceId,
            instanceTime: `${formatDateTime(instanceToUpdate.newStart.toISOString())} - ${formatDateTime(instanceToUpdate.newEnd.toISOString())}`,
            rack,
            conflictingBooking:
              (conflictingInstance.booking as { title?: string })?.title ??
              'Unknown',
            conflictTime: `${formatDateTime(conflictingInstance.start)} - ${formatDateTime(conflictingInstance.end)}`,
          });
        }
      }
    }

    if (conflicts.length > 0) {
      const conflictsByInstance = new Map<
        number,
        Array<{
          rack: number;
          conflictingBooking: string;
          conflictTime: string;
        }>
      >();

      conflicts.forEach((conflict) => {
        if (!conflictsByInstance.has(conflict.instanceId)) {
          conflictsByInstance.set(conflict.instanceId, []);
        }
        conflictsByInstance.get(conflict.instanceId)!.push({
          rack: conflict.rack,
          conflictingBooking: conflict.conflictingBooking,
          conflictTime: conflict.conflictTime,
        });
      });

      const errorParts: string[] = [];
      errorParts.push('⚠️ Booking conflicts detected:\n');

      conflictsByInstance.forEach((rackConflicts, instanceId) => {
        const instance = instancesToUpdate.find(
          (inst) => inst.instanceId === instanceId
        );
        if (!instance) return;

        const formatDate = (date: Date) =>
          date.toLocaleDateString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
        const formatTime = (date: Date) =>
          date.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

        const dateStr = formatDate(instance.newStart);
        const timeRange = `${formatTime(instance.newStart)} - ${formatTime(instance.newEnd)}`;

        errorParts.push(`\n${dateStr} (${timeRange}):`);

        const byBooking = new Map<
          string,
          { racks: number[]; conflictTime: string }
        >();
        rackConflicts.forEach((conflict) => {
          if (!byBooking.has(conflict.conflictingBooking)) {
            byBooking.set(conflict.conflictingBooking, {
              racks: [],
              conflictTime: conflict.conflictTime,
            });
          }
          byBooking.get(conflict.conflictingBooking)!.racks.push(conflict.rack);
        });

        byBooking.forEach((details, bookingTitle) => {
          const racksList = details.racks.sort((a, b) => a - b).join(', ');
          errorParts.push(
            `  • Rack${details.racks.length > 1 ? 's' : ''} ${racksList} conflict with "${bookingTitle}" (${details.conflictTime})`
          );
        });
      });

      setError(errorParts.join('\n'));
      setSaving(false);
      return false;
    }

    const firstInstance = instancesToUpdate[0];
    if (!firstInstance) {
      throw new Error('No instances selected for update');
    }

    const firstInstanceDate = hasTimeChanges
      ? firstInstance.newStart
      : new Date(firstInstance.instance.start);

    const cutoff = getBookingCutoff(firstInstanceDate);
    const isAfterDeadline = isAfterCutoff(firstInstanceDate);

    if (isAfterDeadline && role !== 'admin') {
      const cutoffMessage = getCutoffMessage(firstInstanceDate);
      throw new Error(
        `⚠️ Booking cutoff has passed.\n\n${cutoffMessage}\n\n` +
          `Bookings cannot be created or edited after the cutoff deadline. ` +
          `Please contact an administrator if this is an emergency.`
      );
    }

    const updates = instancesToUpdate.map(async (instanceToUpdate) => {
      const updateData: {
        start?: string;
        end?: string;
        capacity?: number;
      } = {};

      if (hasTimeChanges) {
        updateData.start = instanceToUpdate.newStart.toISOString();
        updateData.end = instanceToUpdate.newEnd.toISOString();
      }

      if (hasCapacityChanges) {
        updateData.capacity = instanceToUpdate.newCapacity;
      }

      const { error: updateError } = await supabase
        .from('booking_instances')
        .update(updateData)
        .eq('id', instanceToUpdate.instanceId);

      if (updateError) {
        throw new Error(updateError.message);
      }
    });

    await Promise.all(updates);

    await Promise.all(
      instancesToUpdate.map((instanceToUpdate) => {
        const dateStr = format(instanceToUpdate.newStart, 'yyyy-MM-dd');
        const slotsForInstance = areaSlotsForm.map((slot) => ({
          area_key: slot.area_key,
          start: combineDateAndTime(dateStr, slot.start).toISOString(),
          end: combineDateAndTime(dateStr, slot.end).toISOString(),
        }));
        return saveAreaSlotsForInstance(
          instanceToUpdate.instanceId,
          slotsForInstance
        );
      })
    );

    if (booking.bookingId && userId) {
      const { data: currentBooking } = await supabase
        .from('bookings')
        .select('status')
        .eq('id', booking.bookingId)
        .maybeSingle();

      const updateData: {
        status?: BookingStatus;
        last_edited_at: string;
        last_edited_by: string;
        last_minute_change?: boolean;
        cutoff_at?: string;
        override_by?: string | null;
      } = {
        last_edited_at: new Date().toISOString(),
        last_edited_by: userId,
      };

      if (isAfterDeadline) {
        updateData.last_minute_change = true;
        updateData.cutoff_at = cutoff.toISOString();
        updateData.override_by = role === 'admin' ? userId : null;
      }

      if (currentBooking?.status === 'processed') {
        updateData.status = 'pending';
        await supabase
          .from('bookings')
          .update(updateData)
          .eq('id', booking.bookingId);
      } else if (
        currentBooking?.status &&
        currentBooking.status !== 'draft' &&
        currentBooking.status !== 'pending'
      ) {
        await supabase
          .from('bookings')
          .update(updateData)
          .eq('id', booking.bookingId);
      } else {
        await supabase
          .from('bookings')
          .update(updateData)
          .eq('id', booking.bookingId);
      }

      try {
        const bookingsTeamIds = await getUserIdsByRole('bookings_team');
        const adminIds = await getUserIdsByRole('admin');
        const allNotifyIds = [...new Set([...bookingsTeamIds, ...adminIds])];

        if (allNotifyIds.length > 0) {
          const { data: bookingData } = await supabase
            .from('bookings')
            .select('title, status')
            .eq('id', booking.bookingId)
            .single();

          const isLastMinute = isAfterDeadline && updateData.last_minute_change;
          const wasProcessed = currentBooking?.status === 'processed';

          await createTasksForUsers(allNotifyIds, {
            type: isLastMinute ? 'last_minute_change' : 'booking:edited',
            title: isLastMinute
              ? 'Last-Minute Booking Change'
              : wasProcessed
                ? 'Processed Booking Edited'
                : 'Booking Edited',
            message: isLastMinute
              ? `Booking "${bookingData?.title || 'Untitled'}" was edited after the cutoff deadline.`
              : wasProcessed
                ? `Processed booking "${bookingData?.title || 'Untitled'}" was edited and needs reprocessing.`
                : `Booking "${bookingData?.title || 'Untitled'}" was edited.`,
            link: `/bookings-team?booking=${booking.bookingId}`,
            metadata: {
              booking_id: booking.bookingId,
              booking_title: bookingData?.title || null,
              changed_by: userId,
              is_last_minute: isLastMinute,
              was_processed: wasProcessed,
            },
          });
        }
      } catch (taskError) {
        console.error('Failed to create tasks:', taskError);
      }
    }

    if (userId && booking.bookingId) {
      const { data: bookingData } = await supabase
        .from('bookings')
        .select(
          'organization_id, site_id, title, status, booking_type, squad_id, display_name'
        )
        .eq('id', booking.bookingId)
        .single();

      if (bookingData?.organization_id) {
        const oldValue: Record<string, unknown> = {};
        const newValue: Record<string, unknown> = {};

        if (hasTimeChanges) {
          oldValue.start = originalStartTime;
          oldValue.end = originalEndTime;
          newValue.start = startTime;
          newValue.end = endTime;
        }

        if (hasCapacityChanges) {
          oldValue.capacity = booking.capacity || 1;
          newValue.capacity = capacity;
        }

        if (
          Object.keys(oldValue).length > 0 ||
          Object.keys(newValue).length > 0
        ) {
          const { ActivityLogger } =
            await import('../../../../lib/activityLogger');
          ActivityLogger.booking
            .updated(
              bookingData.organization_id,
              bookingData.site_id ?? null,
              userId,
              booking.bookingId,
              oldValue,
              newValue,
              {
                title: bookingData.title,
                status: bookingData.status,
                booking_type: bookingData.booking_type,
                squad_id: bookingData.squad_id,
                display_name: bookingData.display_name,
              }
            )
            .catch((err) => {
              console.error('Failed to log booking update activity:', err);
            });
        }
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
      queryKey: ['schedule-bookings'],
      exact: false,
    });
    return true;
  } catch (err) {
    console.error('Failed to update booking time', err);
    setError(
      err instanceof Error ? err.message : 'Failed to update booking time'
    );
    return false;
  } finally {
    setSaving(false);
  }
}
