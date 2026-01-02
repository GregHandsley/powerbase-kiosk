import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabaseClient";
import { useQueryClient } from "@tanstack/react-query";
import { addWeeks } from "date-fns";
import { formatTimeForInput, getTimeDifference } from "../../shared/dateUtils";
import type { ActiveInstance } from "../../../types/snapshot";

type SeriesInstance = {
  id: number;
  start: string;
  end: string;
  racks: number[];
  areas: string[];
  sideId: number;
};

export function useBookingEditor(
  booking: ActiveInstance | null,
  isOpen: boolean,
  initialSelectedInstances?: Set<number>
) {
  const queryClient = useQueryClient();
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<
    "selected" | "series" | null
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

  // Fetch all instances in the series (same booking_id)
  const { data: seriesInstances = [] } = useQuery<SeriesInstance[]>({
    queryKey: ["booking-series", booking?.bookingId],
    queryFn: async () => {
      if (!booking) return [];

      const { data, error } = await supabase
        .from("booking_instances")
        .select("id, start, end, racks, areas, side_id")
        .eq("booking_id", booking.bookingId)
        .order("start", { ascending: true });

      if (error) {
        console.error("Error fetching series instances:", error);
        return [];
      }

      return (data ?? []).map((inst) => ({
        id: inst.id,
        start: inst.start,
        end: inst.end,
        racks: Array.isArray(inst.racks) ? inst.racks : [],
        areas: Array.isArray(inst.areas) ? inst.areas : [],
        sideId: inst.side_id,
      }));
    },
    enabled: !!booking && isOpen,
  });

  // Initialize times and selected instances when booking changes
  useEffect(() => {
    if (booking) {
      setStartTime(formatTimeForInput(booking.start));
      setEndTime(formatTimeForInput(booking.end));
      if (initialSelectedInstances && initialSelectedInstances.size > 0) {
        setSelectedInstances(new Set(initialSelectedInstances));
      } else {
        setSelectedInstances(new Set([booking.instanceId]));
      }
      setApplyToAll(false);
      if (!initialSelectedInstances || initialSelectedInstances.size === 0) {
        setCurrentWeekIndex(0);
      }
    } else {
      setStartTime("");
      setEndTime("");
      setSelectedInstances(new Set());
      setApplyToAll(false);
      setCurrentWeekIndex(0);
    }
    setError(null);
  }, [booking, initialSelectedInstances]);

  // Update selected instances when applyToAll changes
  useEffect(() => {
    if (applyToAll && booking && seriesInstances.length > 0) {
      setSelectedInstances(new Set(seriesInstances.map((inst) => inst.id)));
    } else if (!applyToAll && booking && seriesInstances.length > 0) {
      if (!initialSelectedInstances || initialSelectedInstances.size === 0) {
        setSelectedInstances(new Set([booking.instanceId]));
      }
    }
  }, [applyToAll, booking, seriesInstances, initialSelectedInstances]);

  const hasTimeChanges = useMemo(() => {
    if (!booking) return false;
    return (
      startTime !== formatTimeForInput(booking.start) ||
      endTime !== formatTimeForInput(booking.end)
    );
  }, [booking, startTime, endTime]);

  const handleSaveTime = async (): Promise<boolean> => {
    if (!booking || !hasTimeChanges) {
      // No time changes, so no need to update or show confirmation
      return true; // Return true to indicate "success" (nothing to do)
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      setError("Time must be in HH:mm format");
      return false;
    }

    if (selectedInstances.size === 0) {
      setError("Please select at least one session to update");
      return false;
    }

    if (selectedInstances.size > 1) {
      // Show confirmation modal only if times have changed
      setShowUpdateTimeConfirm(true);
      return false; // Return false to indicate we need confirmation
    }

    // If only one session, proceed directly
    return await performTimeUpdate();
  };

  const performTimeUpdate = async (): Promise<boolean> => {
    if (!booking) return false;

    setSaving(true);
    setError(null);

    try {
      const originalStartTime = formatTimeForInput(booking.start);
      const originalEndTime = formatTimeForInput(booking.end);
      const startDiff = getTimeDifference(originalStartTime, startTime);
      const endDiff = getTimeDifference(originalEndTime, endTime);

      // Calculate new times for all instances being updated
      const instancesToUpdate = Array.from(selectedInstances)
        .map((instanceId) => {
          const instance = seriesInstances.find((inst) => inst.id === instanceId);
          if (!instance) return null;

          const instanceStart = new Date(instance.start);
          const instanceEnd = new Date(instance.end);

          const newStart = new Date(instanceStart);
          newStart.setHours(newStart.getHours() + startDiff.hours);
          newStart.setMinutes(newStart.getMinutes() + startDiff.minutes);

          const newEnd = new Date(instanceEnd);
          newEnd.setHours(newEnd.getHours() + endDiff.hours);
          newEnd.setMinutes(newEnd.getMinutes() + endDiff.minutes);

          return {
            instanceId,
            instance,
            newStart,
            newEnd,
            racks: instance.racks,
            sideId: instance.sideId,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

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
        const { data: overlappingInstances, error: overlapError } = await supabase
          .from("booking_instances")
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
          .eq("side_id", instanceToUpdate.sideId)
          .lt("start", instanceToUpdate.newEnd.toISOString()) // Other booking starts before our new end
          .gt("end", instanceToUpdate.newStart.toISOString()) // Other booking ends after our new start
          .neq("booking_id", booking.bookingId); // Exclude instances from the same booking

        if (overlapError) {
          console.error("Error checking for conflicts:", overlapError);
          throw new Error(`Error checking for conflicts: ${overlapError.message}`);
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
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
            };

            conflicts.push({
              instanceId: instanceToUpdate.instanceId,
              instanceTime: `${formatDateTime(instanceToUpdate.newStart.toISOString())} - ${formatDateTime(instanceToUpdate.newEnd.toISOString())}`,
              rack,
              conflictingBooking:
                (conflictingInstance.booking as { title?: string })?.title ?? "Unknown",
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
          Array<{ rack: number; conflictingBooking: string; conflictTime: string }>
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
        errorParts.push("⚠️ Booking conflicts detected:\n");

        conflictsByInstance.forEach((rackConflicts, instanceId) => {
          const instance = instancesToUpdate.find((inst) => inst.instanceId === instanceId);
          if (!instance) return;

          const formatDate = (date: Date) => {
            return date.toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
          };

          const formatTime = (date: Date) => {
            return date.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
          };

          const dateStr = formatDate(instance.newStart);
          const timeRange = `${formatTime(instance.newStart)} - ${formatTime(instance.newEnd)}`;

          errorParts.push(`\n${dateStr} (${timeRange}):`);

          // Group by conflicting booking
          const byBooking = new Map<string, { racks: number[]; conflictTime: string }>();
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
            const racksList = details.racks.sort((a, b) => a - b).join(", ");
            errorParts.push(
              `  • Rack${details.racks.length > 1 ? "s" : ""} ${racksList} conflict with "${bookingTitle}" (${details.conflictTime})`
            );
          });
        });

        setError(errorParts.join("\n"));
        setSaving(false);
        return false;
      }

      // No conflicts, proceed with updates
      const updates = instancesToUpdate.map(async (instanceToUpdate) => {
        const { error: updateError } = await supabase
          .from("booking_instances")
          .update({
            start: instanceToUpdate.newStart.toISOString(),
            end: instanceToUpdate.newEnd.toISOString(),
          })
          .eq("id", instanceToUpdate.instanceId);

        if (updateError) {
          throw new Error(updateError.message);
        }
      });

      await Promise.all(updates);

      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({
        queryKey: ["booking-instances-debug"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["booking-instances-for-time"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["booking-series"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["schedule-bookings"],
        exact: false,
      });
      return true; // Success
    } catch (err) {
      console.error("Failed to update booking time", err);
      setError(err instanceof Error ? err.message : "Failed to update booking time");
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
        .from("booking_instances")
        .delete()
        .in("id", instanceIds);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      const remainingCount = seriesInstances.length - instanceIds.length;
      if (remainingCount === 0) {
        const { error: bookingError } = await supabase
          .from("bookings")
          .delete()
          .eq("id", booking.bookingId);

        if (bookingError) {
          console.warn(
            "Failed to delete booking after deleting all instances:",
            bookingError
          );
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({
        queryKey: ["booking-instances-debug"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["booking-instances-for-time"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["booking-series"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["booking-series-racks"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["schedule-bookings"],
        exact: false,
      });
      await queryClient.refetchQueries({ queryKey: ["snapshot"], exact: false });
      return true;
    } catch (err) {
      console.error("Failed to delete instances", err);
      setError(err instanceof Error ? err.message : "Failed to delete bookings");
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
        .from("booking_instances")
        .delete()
        .eq("booking_id", booking.bookingId);

      if (instancesError) {
        throw new Error(instancesError.message);
      }

      const { error: bookingError } = await supabase
        .from("bookings")
        .delete()
        .eq("id", booking.bookingId);

      if (bookingError) {
        throw new Error(bookingError.message);
      }

      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({
        queryKey: ["booking-instances-debug"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["booking-instances-for-time"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["booking-series"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["booking-series-racks"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["schedule-bookings"],
        exact: false,
      });
      await queryClient.refetchQueries({ queryKey: ["snapshot"], exact: false });
      return true;
    } catch (err) {
      console.error("Failed to delete series", err);
      setError(err instanceof Error ? err.message : "Failed to delete booking series");
      return false;
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(null);
    }
  };

  const handleExtendBooking = async (): Promise<boolean> => {
    if (!booking || seriesInstances.length === 0 || extendWeeks < 1) return false;

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

      // Check for conflicts before creating new instances
      const conflicts: Array<{
        week: number;
        rack: number;
        conflictingBooking: string;
        conflictTime: string;
        newInstanceTime: string;
      }> = [];

      for (let i = 1; i <= extendWeeks; i++) {
        const newStart = addWeeks(lastStart, weekOffset * i);
        const newEnd = addWeeks(lastEnd, weekOffset * i);

        // Fetch all bookings that overlap with this new instance's time range
        const { data: overlappingInstances, error: overlapError } = await supabase
          .from("booking_instances")
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
          .eq("side_id", sideId)
          .lt("start", newEnd.toISOString()) // Other booking starts before our new end
          .gt("end", newStart.toISOString()) // Other booking ends after our new start
          .neq("booking_id", booking.bookingId); // Exclude instances from the same booking

        if (overlapError) {
          console.error("Error checking for conflicts:", overlapError);
          throw new Error(`Error checking for conflicts: ${overlapError.message}`);
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
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
            };

            conflicts.push({
              week: i,
              rack,
              conflictingBooking:
                (conflictingInstance.booking as { title?: string })?.title ?? "Unknown",
              conflictTime: `${formatDateTime(conflictingInstance.start)} - ${formatDateTime(conflictingInstance.end)}`,
              newInstanceTime: `${formatDateTime(newStart.toISOString())} - ${formatDateTime(newEnd.toISOString())}`,
            });
          }
        }
      }

      // If conflicts found, show detailed error and abort
      if (conflicts.length > 0) {
        // Group conflicts by week for better error message
        const conflictsByWeek = new Map<
          number,
          Map<string, { racks: number[]; conflictTime: string; newInstanceTime: string }>
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
        errorParts.push("⚠️ Extension conflicts detected:\n");
        errorParts.push("The following weeks cannot be extended due to overlapping bookings:\n");

        conflictsByWeek.forEach((weekConflicts, week) => {
          errorParts.push(`\nWeek ${week} (${weekConflicts.values().next().value.newInstanceTime}):`);

          weekConflicts.forEach((details, bookingTitle) => {
            const racksList = details.racks.sort((a, b) => a - b).join(", ");
            errorParts.push(
              `  • Rack${details.racks.length > 1 ? "s" : ""} ${racksList} conflict with "${bookingTitle}" (${details.conflictTime})`
            );
          });
        });

        setError(errorParts.join("\n"));
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
        });
      }

      const { error: instancesError } = await supabase
        .from("booking_instances")
        .insert(instancesPayload);

      if (instancesError) {
        throw new Error(instancesError.message);
      }

      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({
        queryKey: ["booking-instances-debug"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["booking-instances-for-time"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["booking-series"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["booking-series-racks"],
        exact: false,
      });
      await queryClient.invalidateQueries({
        queryKey: ["schedule-bookings"],
        exact: false,
      });
      await queryClient.refetchQueries({ queryKey: ["snapshot"], exact: false });

      setShowExtendDialog(false);
      setExtendWeeks(1);
      return true;
    } catch (err) {
      console.error("Failed to extend booking", err);
      setError(err instanceof Error ? err.message : "Failed to extend booking");
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

    return {
    // State
    startTime,
    endTime,
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
    showUpdateTimeConfirm,
    // Setters
    setStartTime,
    setEndTime,
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
    performTimeUpdate,
    handleDeleteSelected,
    handleDeleteSeries,
    handleExtendBooking,
    handleInstanceToggle,
  };
}

