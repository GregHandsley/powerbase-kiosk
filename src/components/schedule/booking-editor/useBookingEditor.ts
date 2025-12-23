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
    if (!booking || !hasTimeChanges) return false;

    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      setError("Time must be in HH:mm format");
      return;
    }

    if (selectedInstances.size === 0) {
      setError("Please select at least one session to update");
      return;
    }

    if (selectedInstances.size > 1) {
      const confirmed = window.confirm(
        `Update ${selectedInstances.size} selected sessions with the new times?\n\nStart: ${startTime}\nEnd: ${endTime}`
      );
      if (!confirmed) return;
    }

    setSaving(true);
    setError(null);

    try {
      const originalStartTime = formatTimeForInput(booking.start);
      const originalEndTime = formatTimeForInput(booking.end);
      const startDiff = getTimeDifference(originalStartTime, startTime);
      const endDiff = getTimeDifference(originalEndTime, endTime);

      const updates = Array.from(selectedInstances).map(async (instanceId) => {
        const instance = seriesInstances.find((inst) => inst.id === instanceId);
        if (!instance) return;

        const instanceStart = new Date(instance.start);
        const instanceEnd = new Date(instance.end);

        const newStart = new Date(instanceStart);
        newStart.setHours(newStart.getHours() + startDiff.hours);
        newStart.setMinutes(newStart.getMinutes() + startDiff.minutes);

        const newEnd = new Date(instanceEnd);
        newEnd.setHours(newEnd.getHours() + endDiff.hours);
        newEnd.setMinutes(newEnd.getMinutes() + endDiff.minutes);

        const { error: updateError } = await supabase
          .from("booking_instances")
          .update({
            start: newStart.toISOString(),
            end: newEnd.toISOString(),
          })
          .eq("id", instanceId);

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
    // Handlers
    handleSaveTime,
    handleDeleteSelected,
    handleDeleteSeries,
    handleExtendBooking,
    handleInstanceToggle,
  };
}

