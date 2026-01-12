import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';
import { addWeeks, format } from 'date-fns';
import {
  formatTimeForInput,
  getTimeDifference,
  groupInstancesByWeek,
} from '../../shared/dateUtils';
import type { ActiveInstance } from '../../../types/snapshot';
import { checkCapacityViolations } from '../../admin/booking/useCapacityValidation';
import type { ScheduleData } from '../../admin/capacity/scheduleUtils';
import { parseExcludedDates } from '../../admin/capacity/scheduleUtils';
import { useAuth } from '../../../context/AuthContext';
import type { BookingStatus } from '../../../types/db';
import {
  isAfterCutoff,
  getBookingCutoff,
  getCutoffMessage,
} from '../../../utils/cutoff';
import { createTasksForUsers, getUserIdsByRole } from '../../../hooks/useTasks';
// import toast from 'react-hot-toast';

type SeriesInstance = {
  id: number;
  start: string;
  end: string;
  racks: number[];
  areas: string[];
  sideId: number;
  capacity?: number;
};

export function useBookingEditor(
  booking: ActiveInstance | null,
  isOpen: boolean,
  initialSelectedInstances?: Set<number>
) {
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [capacity, setCapacity] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<
    'selected' | 'series' | null
  >(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedInstances, setSelectedInstances] = useState<Set<number>>(
    new Set()
  );
  const [applyToAll, setApplyToAll] = useState(false);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [showExtendDialog, setShowExtendDialog] = useState(false);
  const [extendWeeks, setExtendWeeks] = useState(1);
  const [extending, setExtending] = useState(false);
  const [showUpdateTimeConfirm, setShowUpdateTimeConfirm] = useState(false);

  // Track original values to detect any changes across all selected instances
  const [originalValues, setOriginalValues] = useState<{
    startTime: string;
    endTime: string;
    capacity: number;
  } | null>(null);

  // Track if user has manually edited values (vs automatic updates from week navigation)
  const [userHasEdited, setUserHasEdited] = useState(false);

  // Fetch all instances in the series (same booking_id)
  const { data: seriesInstances = [] } = useQuery<SeriesInstance[]>({
    queryKey: ['booking-series', booking?.bookingId],
    queryFn: async () => {
      if (!booking) return [];

      const { data, error } = await supabase
        .from('booking_instances')
        .select('id, start, end, racks, areas, side_id, capacity')
        .eq('booking_id', booking.bookingId)
        .order('start', { ascending: true });

      if (error) {
        console.error('Error fetching series instances:', error);
        return [];
      }

      return (data ?? []).map((inst) => ({
        id: inst.id,
        start: inst.start,
        end: inst.end,
        racks: Array.isArray(inst.racks) ? inst.racks : [],
        areas: Array.isArray(inst.areas) ? inst.areas : [],
        sideId: inst.side_id,
        capacity:
          typeof (inst as { capacity?: number }).capacity === 'number'
            ? (inst as { capacity: number }).capacity
            : undefined,
      }));
    },
    enabled: !!booking && isOpen,
  });

  // Initialize times, capacity, and selected instances when booking changes
  useEffect(() => {
    if (booking) {
      const initialStartTime = formatTimeForInput(booking.start);
      const initialEndTime = formatTimeForInput(booking.end);
      const initialCapacity = booking.capacity || 1;

      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setCapacity(initialCapacity);

      // Store original values for comparison
      setOriginalValues({
        startTime: initialStartTime,
        endTime: initialEndTime,
        capacity: initialCapacity,
      });

      if (initialSelectedInstances && initialSelectedInstances.size > 0) {
        setSelectedInstances(new Set(initialSelectedInstances));
      } else {
        setSelectedInstances(new Set([booking.instanceId]));
      }
      setApplyToAll(true); // Default to "Apply to all" for clarity
      if (!initialSelectedInstances || initialSelectedInstances.size === 0) {
        setCurrentWeekIndex(0);
      }
      setUserHasEdited(false);
    } else {
      setStartTime('');
      setEndTime('');
      setCapacity(1);
      setSelectedInstances(new Set());
      setApplyToAll(true); // Default to "Apply to all"
      setCurrentWeekIndex(0);
      setOriginalValues(null);
      setUserHasEdited(false);
    }
    setError(null);
  }, [booking, initialSelectedInstances]);

  // Update selected instances when applyToAll changes
  useEffect(() => {
    if (applyToAll && booking && seriesInstances.length > 0) {
      setSelectedInstances(new Set(seriesInstances.map((inst) => inst.id)));
    } else if (!applyToAll && booking && seriesInstances.length > 0) {
      // When unchecking "Apply to all", clear selection - user must manually select weeks
      if (!initialSelectedInstances || initialSelectedInstances.size === 0) {
        setSelectedInstances(new Set());
      }
    }
  }, [applyToAll, booking, seriesInstances, initialSelectedInstances]);

  // Update capacity when navigating weeks (if not applying to all)
  // Don't auto-select instances - user must manually select them
  // Only update if user hasn't manually edited (to preserve their changes)
  useEffect(() => {
    if (
      !applyToAll &&
      booking &&
      seriesInstances.length > 0 &&
      !userHasEdited
    ) {
      const instancesByWeek = groupInstancesByWeek(seriesInstances);
      const weeks = Array.from(instancesByWeek.keys()).sort((a, b) => a - b);
      const currentWeek = weeks[currentWeekIndex] ?? weeks[0] ?? null;
      const currentWeekInstances = currentWeek
        ? (instancesByWeek.get(currentWeek) ?? [])
        : [];

      // Update capacity to show the capacity of the first instance in current week
      // This helps user see what capacity is set for this week's sessions
      if (currentWeekInstances.length > 0) {
        const firstInstance = currentWeekInstances[0];
        const instanceData = seriesInstances.find(
          (inst) => inst.id === firstInstance.id
        );
        if (instanceData?.capacity !== undefined) {
          setCapacity(instanceData.capacity);
        } else {
          // If no capacity set, use the booking's capacity
          setCapacity(booking.capacity || 1);
        }
      }
    }
  }, [currentWeekIndex, applyToAll, booking, seriesInstances, userHasEdited]);

  const hasTimeChanges = useMemo(() => {
    if (!booking || !originalValues) return false;
    return (
      startTime !== originalValues.startTime ||
      endTime !== originalValues.endTime
    );
  }, [booking, startTime, endTime, originalValues]);

  const hasCapacityChanges = useMemo(() => {
    if (!booking || !originalValues) return false;
    // Check if current capacity differs from original
    // OR if user has manually edited (which means they made a change somewhere)
    return capacity !== originalValues.capacity || userHasEdited;
  }, [booking, capacity, originalValues, userHasEdited]);

  // Check if there are changes AND instances are selected
  // The save button should be enabled if:
  // 1. At least one instance is selected
  // 2. AND there are any changes (time or capacity)
  const hasChanges = useMemo(() => {
    if (!booking || selectedInstances.size === 0) return false;
    return hasTimeChanges || hasCapacityChanges;
  }, [booking, selectedInstances.size, hasTimeChanges, hasCapacityChanges]);

  const handleSaveTime = async (): Promise<boolean> => {
    if (!booking || !hasChanges) {
      // No changes, so no need to update or show confirmation
      return true; // Return true to indicate "success" (nothing to do)
    }

    if (hasTimeChanges) {
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        setError('Time must be in HH:mm format');
        return false;
      }
    }

    if (capacity < 1 || capacity > 100) {
      setError('Number of athletes must be between 1 and 100');
      return false;
    }

    if (selectedInstances.size === 0) {
      setError('Please select at least one session to update');
      return false;
    }

    // Always show confirmation modal for any changes
    setShowUpdateTimeConfirm(true);
    return false; // Return false to indicate we need confirmation
  };

  const performUpdate = async (): Promise<boolean> => {
    if (!booking) return false;

    setSaving(true);
    setError(null);

    try {
      const originalStartTime = formatTimeForInput(booking.start);
      const originalEndTime = formatTimeForInput(booking.end);
      const startDiff = getTimeDifference(originalStartTime, startTime);
      const endDiff = getTimeDifference(originalEndTime, endTime);

      // Calculate new times and capacity for all instances being updated
      const instancesToUpdate = Array.from(selectedInstances)
        .map((instanceId) => {
          const instance = seriesInstances.find(
            (inst) => inst.id === instanceId
          );
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

      // Check for capacity violations if capacity is being changed
      if (hasCapacityChanges) {
        // Fetch capacity schedules for validation
        const sideIds = new Set(instancesToUpdate.map((inst) => inst.sideId));
        const allSchedules: ScheduleData[] = [];

        for (const sideId of sideIds) {
          // Get date range for all instances
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

        // Fetch existing instances for capacity calculation (excluding the ones we're updating)
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

        // Validate capacity for each instance being updated
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
            const formatDate = (date: Date) => {
              return date.toLocaleDateString([], {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              });
            };

            const formatTime = (date: Date) => {
              return date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
            };

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

      // Check for conflicts before updating
      const conflicts: Array<{
        instanceId: number;
        instanceTime: string;
        rack: number;
        conflictingBooking: string;
        conflictTime: string;
      }> = [];

      for (const instanceToUpdate of instancesToUpdate) {
        // Fetch all booking instances that overlap with the new time range
        // and use any of the instance's racks
        const { data: overlappingInstances, error: overlapError } =
          await supabase
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
            .lt('start', instanceToUpdate.newEnd.toISOString()) // Other booking starts before our new end
            .gt('end', instanceToUpdate.newStart.toISOString()) // Other booking ends after our new start
            .neq('booking_id', booking.bookingId); // Exclude instances from the same booking

        if (overlapError) {
          console.error('Error checking for conflicts:', overlapError);
          throw new Error(
            `Error checking for conflicts: ${overlapError.message}`
          );
        }

        // Check each rack for conflicts
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

      // If conflicts found, show detailed error and abort
      if (conflicts.length > 0) {
        // Group conflicts by instance for better error message
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

        // Build detailed error message
        const errorParts: string[] = [];
        errorParts.push('⚠️ Booking conflicts detected:\n');

        conflictsByInstance.forEach((rackConflicts, instanceId) => {
          const instance = instancesToUpdate.find(
            (inst) => inst.instanceId === instanceId
          );
          if (!instance) return;

          const formatDate = (date: Date) => {
            return date.toLocaleDateString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
          };

          const formatTime = (date: Date) => {
            return date.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
          };

          const dateStr = formatDate(instance.newStart);
          const timeRange = `${formatTime(instance.newStart)} - ${formatTime(instance.newEnd)}`;

          errorParts.push(`\n${dateStr} (${timeRange}):`);

          // Group by conflicting booking
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
            byBooking
              .get(conflict.conflictingBooking)!
              .racks.push(conflict.rack);
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

      // Check cutoff deadline for the first instance being updated
      const firstInstance = instancesToUpdate[0];
      if (!firstInstance) {
        throw new Error('No instances selected for update');
      }

      // Use the new start date if time is changing, otherwise use the original start
      const firstInstanceDate = hasTimeChanges
        ? firstInstance.newStart
        : new Date(firstInstance.instance.start);

      const cutoff = getBookingCutoff(firstInstanceDate);
      const isAfterDeadline = isAfterCutoff(firstInstanceDate);

      if (isAfterDeadline && role !== 'admin') {
        // Non-admins cannot edit bookings after cutoff
        const cutoffMessage = getCutoffMessage(firstInstanceDate);
        throw new Error(
          `⚠️ Booking cutoff has passed.\n\n${cutoffMessage}\n\n` +
            `Bookings cannot be created or edited after the cutoff deadline. ` +
            `Please contact an administrator if this is an emergency.`
        );
      }

      // No conflicts, proceed with updates
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

      // Update booking status if it was previously processed
      // When a processed booking is edited, reset status to 'pending'
      // Also update last-minute change flag if after cutoff
      if (booking?.bookingId && user?.id) {
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
          last_edited_by: user.id,
        };

        // Add last-minute change tracking
        if (isAfterDeadline) {
          updateData.last_minute_change = true;
          updateData.cutoff_at = cutoff.toISOString();
          updateData.override_by = role === 'admin' ? user.id : null;
        }

        if (currentBooking?.status === 'processed') {
          // Reset to pending and update edit tracking
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
          // For other statuses (confirmed, completed, cancelled), just update edit tracking
          await supabase
            .from('bookings')
            .update(updateData)
            .eq('id', booking.bookingId);
        } else {
          // For pending/draft, just update edit tracking
          await supabase
            .from('bookings')
            .update(updateData)
            .eq('id', booking.bookingId);
        }

        // Create tasks for all edits (bookings team needs to know about all changes)
        try {
          // Get bookings team and admin user IDs
          const bookingsTeamIds = await getUserIdsByRole('bookings_team');
          const adminIds = await getUserIdsByRole('admin');
          const allNotifyIds = [...new Set([...bookingsTeamIds, ...adminIds])];

          if (allNotifyIds.length > 0) {
            // Get booking title for task
            const { data: bookingData } = await supabase
              .from('bookings')
              .select('title, status')
              .eq('id', booking.bookingId)
              .single();

            const isLastMinute =
              isAfterDeadline && updateData.last_minute_change;
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
                changed_by: user.id,
                is_last_minute: isLastMinute,
                was_processed: wasProcessed,
              },
            });
          }
        } catch (taskError) {
          console.error('Failed to create tasks:', taskError);
          // Don't fail the update if tasks fail
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
      return true; // Success
    } catch (err) {
      console.error('Failed to update booking time', err);
      setError(
        err instanceof Error ? err.message : 'Failed to update booking time'
      );
      return false; // Failure
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelected = async (): Promise<boolean> => {
    if (!booking || selectedInstances.size === 0) return false;

    setDeleting(true);
    setError(null);

    try {
      const instanceIds = Array.from(selectedInstances);
      const { error: deleteError } = await supabase
        .from('booking_instances')
        .delete()
        .in('id', instanceIds);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      const remainingCount = seriesInstances.length - instanceIds.length;
      if (remainingCount === 0) {
        const { error: bookingError } = await supabase
          .from('bookings')
          .delete()
          .eq('id', booking.bookingId);

        if (bookingError) {
          console.warn(
            'Failed to delete booking after deleting all instances:',
            bookingError
          );
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
      return true;
    } catch (err) {
      console.error('Failed to delete instances', err);
      setError(
        err instanceof Error ? err.message : 'Failed to delete bookings'
      );
      return false;
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(null);
    }
  };

  const handleDeleteSeries = async (): Promise<boolean> => {
    if (!booking) return false;

    setDeleting(true);
    setError(null);

    try {
      const { error: instancesError } = await supabase
        .from('booking_instances')
        .delete()
        .eq('booking_id', booking.bookingId);

      if (instancesError) {
        throw new Error(instancesError.message);
      }

      const { error: bookingError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking.bookingId);

      if (bookingError) {
        throw new Error(bookingError.message);
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
      return true;
    } catch (err) {
      console.error('Failed to delete series', err);
      setError(
        err instanceof Error ? err.message : 'Failed to delete booking series'
      );
      return false;
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(null);
    }
  };

  const handleExtendBooking = async (): Promise<boolean> => {
    if (!booking || seriesInstances.length === 0 || extendWeeks < 1)
      return false;

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
      // Use the capacity from the first instance (or last if first doesn't have it)
      const originalCapacity =
        firstInstance.capacity || lastInstance.capacity || 1;

      // Fetch capacity schedules for validation
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

      // Fetch existing instances for capacity calculation
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

      // Check for capacity violations before creating new instances
      const capacityViolations: Array<{
        week: number;
        newInstanceTime: string;
        violation: string;
      }> = [];

      // Check for conflicts before creating new instances
      const conflicts: Array<{
        week: number;
        rack: number;
        conflictingBooking: string;
        conflictTime: string;
        newInstanceTime: string;
      }> = [];

      // Track instances we're about to create for cumulative capacity checking
      const newInstancesForCapacity: Array<{
        start: string;
        end: string;
        capacity: number;
      }> = [];

      for (let i = 1; i <= extendWeeks; i++) {
        const newStart = addWeeks(lastStart, weekOffset * i);
        const newEnd = addWeeks(lastEnd, weekOffset * i);

        // Combine existing instances with instances we're creating in previous weeks
        const allInstancesForCapacity = [
          ...existingInstances,
          ...newInstancesForCapacity.map((inst) => ({
            id: -1, // Temporary ID for instances not yet created
            start: inst.start,
            end: inst.end,
            capacity: inst.capacity,
          })),
        ];

        // Validate capacity for this new instance
        const result = checkCapacityViolations(
          sideId,
          newStart,
          newEnd,
          originalCapacity,
          allInstancesForCapacity,
          allSchedules
        );

        if (!result.isValid) {
          const formatDateTime = (date: Date) => {
            return date.toLocaleString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
          };

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
          // If capacity is valid, add this instance to the list for next week's check
          newInstancesForCapacity.push({
            start: newStart.toISOString(),
            end: newEnd.toISOString(),
            capacity: originalCapacity,
          });
        }

        // Fetch all bookings that overlap with this new instance's time range
        const { data: overlappingInstances, error: overlapError } =
          await supabase
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
            .lt('start', newEnd.toISOString()) // Other booking starts before our new end
            .gt('end', newStart.toISOString()) // Other booking ends after our new start
            .neq('booking_id', booking.bookingId); // Exclude instances from the same booking

        if (overlapError) {
          console.error('Error checking for conflicts:', overlapError);
          throw new Error(
            `Error checking for conflicts: ${overlapError.message}`
          );
        }

        // Check each rack for conflicts
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

      // If capacity violations found, show detailed error and abort
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

      // If conflicts found, show detailed error and abort
      if (conflicts.length > 0) {
        // Group conflicts by week for better error message
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

      // No conflicts, proceed with creating new instances
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
  };

  const handleInstanceToggle = (instanceId: number) => {
    const newSelected = new Set(selectedInstances);
    if (newSelected.has(instanceId)) {
      newSelected.delete(instanceId);
    } else {
      newSelected.add(instanceId);
    }
    setSelectedInstances(newSelected);
    if (newSelected.size === seriesInstances.length) {
      setApplyToAll(true);
    } else if (newSelected.size < seriesInstances.length) {
      setApplyToAll(false);
    }
  };

  // Wrapper functions to track manual edits
  const handleCapacityChange = (value: number) => {
    setCapacity(value);
    setUserHasEdited(true);
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    setUserHasEdited(true);
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
    setUserHasEdited(true);
  };

  return {
    // State
    startTime,
    endTime,
    capacity,
    saving,
    error,
    showDeleteConfirm,
    deleting,
    selectedInstances,
    applyToAll,
    currentWeekIndex,
    showExtendDialog,
    extendWeeks,
    extending,
    seriesInstances,
    hasTimeChanges,
    hasCapacityChanges,
    hasChanges,
    showUpdateTimeConfirm,
    // Setters
    setStartTime: handleStartTimeChange,
    setEndTime: handleEndTimeChange,
    setCapacity: handleCapacityChange,
    setError,
    setShowDeleteConfirm,
    setApplyToAll,
    setCurrentWeekIndex,
    setShowExtendDialog,
    setExtendWeeks,
    setSelectedInstances,
    setShowUpdateTimeConfirm,
    // Handlers
    handleSaveTime,
    performUpdate,
    handleDeleteSelected,
    handleDeleteSeries,
    handleExtendBooking,
    handleInstanceToggle,
  };
}
