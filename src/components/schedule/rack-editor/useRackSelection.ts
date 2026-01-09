import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../context/AuthContext";
import type { ActiveInstance } from "../../../types/snapshot";
import type { BookingStatus } from "../../../types/db";

type SeriesInstance = {
  id: number;
  start: string;
  end: string;
  sideId: number | null;
};

type UseRackSelectionOptions = {
  editingBooking: ActiveInstance | null;
  setEditingBooking: (booking: ActiveInstance | null) => void;
  /**
   * Optional callback for additional cache invalidation or UI updates
   * after racks are successfully updated.
   */
  onAfterRackUpdate?: () => Promise<void> | void;
};

type WeekTimeRange = { start: string; end: string } | null;

/**
 * Shared rack-selection state and behaviors for both Schedule and MyBookings flows.
 * Mirrors the existing Schedule implementation while keeping functionality identical.
 */
export function useRackSelection({
  editingBooking,
  setEditingBooking,
  onAfterRackUpdate,
}: UseRackSelectionOptions) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [isSelectingRacks, setIsSelectingRacks] = useState(false);
  const [selectedRacks, setSelectedRacks] = useState<number[]>([]);
  const [savingRacks, setSavingRacks] = useState(false);
  const [selectedInstancesForRacks, setSelectedInstancesForRacks] = useState<Set<number>>(
    new Set()
  );
  const [applyRacksToAll, setApplyRacksToAll] = useState(false);
  const [rackValidationError, setRackValidationError] = useState<string | null>(null);
  const [savedSelectedInstances, setSavedSelectedInstances] = useState<Set<number>>(new Set());
  const [rackSelectionWeekIndex, setRackSelectionWeekIndex] = useState(0);
  const [showUpdateRacksConfirm, setShowUpdateRacksConfirm] = useState(false);
  const isEnteringSelectionMode = useRef(false);

  // Fetch all instances in the series for rack selection
  const { data: seriesInstancesForRacks = [] } = useQuery({
    queryKey: ["booking-series-racks", editingBooking?.bookingId],
    queryFn: async () => {
      if (!editingBooking) return [];

      const { data, error } = await supabase
        .from("booking_instances")
        .select("id, start, end, side_id")
        .eq("booking_id", editingBooking.bookingId)
        .order("start", { ascending: true });

      if (error) {
        console.error("Error fetching series instances for racks:", error);
        return [];
      }

      return (data ?? []).map((inst) => ({
        id: inst.id,
        start: inst.start,
        end: inst.end,
        sideId: inst.side_id,
      })) as SeriesInstance[];
    },
    enabled: !!editingBooking && isSelectingRacks,
  });

  const sideIdForRacks = seriesInstancesForRacks[0]?.sideId ?? null;

  // Fetch the booking's side key (Power/Base)
  const { data: bookingSide } = useQuery({
    queryKey: ["side-key", sideIdForRacks],
    queryFn: async () => {
      if (!sideIdForRacks) return null;

      const { data, error } = await supabase
        .from("sides")
        .select("key")
        .eq("id", sideIdForRacks)
        .maybeSingle();

      if (error) {
        console.error("Error fetching side key:", error);
        return null;
      }

      const key = data?.key?.toLowerCase();
      if (key === "power") return "Power";
      if (key === "base") return "Base";
      return null;
    },
    enabled: isSelectingRacks && !!sideIdForRacks,
  });

  // Group instances by week for navigation
  const instancesByWeekForRacks = useMemo(() => {
    const weekMap = new Map<number, SeriesInstance[]>();
    seriesInstancesForRacks.forEach((inst) => {
      const startDate = new Date(inst.start);
      const weekStart = new Date(startDate);
      const dayOfWeek = startDate.getDay();
      const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = weekStart.getTime();

      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(inst);
    });
    return weekMap;
  }, [seriesInstancesForRacks]);

  const weeksForRacks = useMemo(
    () => Array.from(instancesByWeekForRacks.keys()).sort((a, b) => a - b),
    [instancesByWeekForRacks]
  );

  const currentWeekForRacks = useMemo(
    () => weeksForRacks[rackSelectionWeekIndex] ?? weeksForRacks[0] ?? null,
    [weeksForRacks, rackSelectionWeekIndex]
  );

  const currentWeekInstancesForRacks = useMemo(
    () =>
      currentWeekForRacks ? instancesByWeekForRacks.get(currentWeekForRacks) ?? [] : [],
    [currentWeekForRacks, instancesByWeekForRacks]
  );

  // Calculate time range for current week to fetch overlapping bookings
  const currentWeekTimeRange: WeekTimeRange = useMemo(() => {
    if (currentWeekInstancesForRacks.length === 0) return null;
    const starts = currentWeekInstancesForRacks.map((inst) => new Date(inst.start).getTime());
    const ends = currentWeekInstancesForRacks.map((inst) => new Date(inst.end).getTime());
    return {
      start: new Date(Math.min(...starts)).toISOString(),
      end: new Date(Math.max(...ends)).toISOString(),
    };
  }, [currentWeekInstancesForRacks]);

  // Fetch bookings for the current week to check conflicts
  const { data: bookingsForDisplay = [] } = useQuery({
    queryKey: [
      "bookings-for-rack-selection",
      currentWeekTimeRange?.start,
      currentWeekTimeRange?.end,
      sideIdForRacks,
    ],
    queryFn: async () => {
      if (!currentWeekTimeRange || !sideIdForRacks) return [];

      const { data, error } = await supabase
        .from("booking_instances")
        .select(
          `
          id,
          booking_id,
          start,
          "end",
          racks,
          booking:bookings (
            title,
            color
          )
        `
        )
        .eq("side_id", sideIdForRacks)
        .lt("start", currentWeekTimeRange.end)
        .gt("end", currentWeekTimeRange.start);

      if (error) {
        console.error("Error fetching bookings for rack selection:", error);
        return [];
      }

      return (data ?? []).map((row: unknown) => {
        const r = row as {
          id: number;
          booking_id: number;
          start: string;
          end: string;
          racks: number[] | unknown;
          booking?: {
            title?: string;
            color?: string;
          } | null;
        };
        return {
          instanceId: r.id,
          bookingId: r.booking_id,
          start: r.start,
          end: r.end,
          racks: Array.isArray(r.racks) ? r.racks : [],
          title: r.booking?.title ?? "Untitled",
          color: r.booking?.color ?? null,
        };
      }) as ActiveInstance[];
    },
    enabled: !!currentWeekTimeRange && !!sideIdForRacks && isSelectingRacks,
  });

  // Update selected instances when applyRacksToAll changes
  useEffect(() => {
    if (!isSelectingRacks || !editingBooking) return;

    if (applyRacksToAll && seriesInstancesForRacks.length > 0) {
      const allInstanceIds = new Set(seriesInstancesForRacks.map((inst) => inst.id));
      setSelectedInstancesForRacks((prev) => {
        if (prev.size !== allInstanceIds.size || !Array.from(prev).every((id) => allInstanceIds.has(id))) {
          return allInstanceIds;
        }
        return prev;
      });
    } else if (!applyRacksToAll) {
      if (savedSelectedInstances.size > 0) {
        setSelectedInstancesForRacks((prev) => {
          if (
            prev.size !== savedSelectedInstances.size ||
            !Array.from(prev).every((id) => savedSelectedInstances.has(id))
          ) {
            return new Set(savedSelectedInstances);
          }
          return prev;
        });
      } else {
        setSelectedInstancesForRacks((prev) => {
          if (!prev.has(editingBooking.instanceId) || prev.size !== 1) {
            return new Set([editingBooking.instanceId]);
          }
          return prev;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyRacksToAll, seriesInstancesForRacks.length, editingBooking?.instanceId, isSelectingRacks]);

  const startRackSelection = (selectedInstancesFromModal?: Set<number>) => {
    if (!editingBooking) return;

    const initialRacks = [...editingBooking.racks];
    if (selectedInstancesFromModal && selectedInstancesFromModal.size > 0) {
      setSavedSelectedInstances(new Set(selectedInstancesFromModal));
    }

    isEnteringSelectionMode.current = true;
    setIsSelectingRacks(true);
    setSelectedRacks(initialRacks);

    if (selectedInstancesFromModal && selectedInstancesFromModal.size > 0) {
      setSelectedInstancesForRacks(selectedInstancesFromModal);
    } else {
      setSelectedInstancesForRacks(new Set([editingBooking.instanceId]));
      setApplyRacksToAll(false);
    }
  };

  const handleCancelRackSelection = () => {
    setIsSelectingRacks(false);
    setRackValidationError(null);
    setEditingBooking(null);
    if (editingBooking) {
      setSelectedRacks([...editingBooking.racks]);
    }
    isEnteringSelectionMode.current = false;
  };

  // Validate racks for conflicts before saving
  const validateRacksForInstances = async (): Promise<string | null> => {
    if (!editingBooking || selectedRacks.length === 0 || selectedInstancesForRacks.size === 0) {
      return null;
    }

    const instancesToCheck = seriesInstancesForRacks.filter((inst) =>
      selectedInstancesForRacks.has(inst.id)
    );

    if (instancesToCheck.length === 0) {
      return null;
    }

    const sideId = instancesToCheck[0]?.sideId;

    if (!sideId) {
      return "Unable to determine side for validation. Please try again.";
    }

    const conflicts: Array<{
      instanceId: number;
      instanceTime: string;
      rack: number;
      conflictingBooking: string;
    }> = [];

    for (const instance of instancesToCheck) {
      const { data: overlappingInstances, error } = await supabase
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
        .eq("side_id", sideId)
        .lt("start", instance.end)
        .gt("end", instance.start)
        .neq("booking_id", editingBooking.bookingId);

      if (error) {
        console.error("Error checking for conflicts:", error);
        return `Error checking for conflicts: ${error.message}`;
      }

      for (const rack of selectedRacks) {
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
            instanceId: instance.id,
            instanceTime: `${formatDateTime(instance.start)} - ${formatDateTime(instance.end)}`,
            rack,
            conflictingBooking: (conflictingInstance.booking as { title?: string })?.title ?? "Unknown",
          });
        }
      }
    }

    if (conflicts.length > 0) {
      const conflictsByInstance = new Map<number, Array<{ rack: number; conflictingBooking: string }>>();
      conflicts.forEach((conflict) => {
        if (!conflictsByInstance.has(conflict.instanceId)) {
          conflictsByInstance.set(conflict.instanceId, []);
        }
        conflictsByInstance.get(conflict.instanceId)!.push({
          rack: conflict.rack,
          conflictingBooking: conflict.conflictingBooking,
        });
      });

      let errorMessage = "Rack conflicts detected:\n\n";
      conflictsByInstance.forEach((rackConflicts, instanceId) => {
        const instance = instancesToCheck.find((inst) => inst.id === instanceId);
        const timeStr = instance
          ? `${new Date(instance.start).toLocaleString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })} - ${new Date(instance.end).toLocaleString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "Unknown time";
        errorMessage += `Session: ${timeStr}\n`;
        rackConflicts.forEach(({ rack, conflictingBooking }) => {
          errorMessage += `  • Rack ${rack} is booked by "${conflictingBooking}"\n`;
        });
        errorMessage += "\n";
      });

      return errorMessage.trim();
    }

    return null;
  };

  const handleSaveRacks = async () => {
    if (!editingBooking || selectedRacks.length === 0) return;

    if (selectedInstancesForRacks.size === 0) {
      setRackValidationError("Please select at least one session to update");
      return;
    }

    setRackValidationError(null);

    const validationError = await validateRacksForInstances();
    if (validationError) {
      setRackValidationError(validationError);
      return;
    }

    if (selectedInstancesForRacks.size > 1) {
      setShowUpdateRacksConfirm(true);
      return;
    }

    await performRackUpdate();
  };

  const performRackUpdate = async () => {
    if (!editingBooking || selectedRacks.length === 0) return;

    setSavingRacks(true);
    try {
      const instanceIds = Array.from(selectedInstancesForRacks);
      const updates = instanceIds.map(async (instanceId) => {
        const { error } = await supabase
          .from("booking_instances")
          .update({ racks: selectedRacks })
          .eq("id", instanceId);

        if (error) {
          throw new Error(error.message);
        }
      });

      await Promise.all(updates);

      // Update the booking record to mark it as edited and reset status if it was processed
      // This ensures the bookings team sees the change and can reprocess it
      if (editingBooking.bookingId && user?.id) {
        const { data: currentBooking } = await supabase
          .from("bookings")
          .select("status")
          .eq("id", editingBooking.bookingId)
          .maybeSingle();

        const updateData: {
          last_edited_at: string;
          last_edited_by: string;
          status?: BookingStatus;
        } = {
          last_edited_at: new Date().toISOString(),
          last_edited_by: user.id,
        };

        // If booking was processed, reset to pending so bookings team can review the rack changes
        if (currentBooking?.status === "processed") {
          updateData.status = "pending";
        }

        await supabase
          .from("bookings")
          .update(updateData)
          .eq("id", editingBooking.bookingId);
      }

      await queryClient.invalidateQueries({ queryKey: ["schedule-bookings"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-instances-debug"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-series"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-series-racks"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["bookings-team"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"], exact: false });

      if (onAfterRackUpdate) {
        await onAfterRackUpdate();
      }

      setIsSelectingRacks(false);
      setEditingBooking(null);
      setRackValidationError(null);
      setShowUpdateRacksConfirm(false);
      setSavedSelectedInstances(new Set());
    } catch (err) {
      console.error("Failed to save racks", err);
      setRackValidationError(err instanceof Error ? err.message : "Failed to save racks");
    } finally {
      setSavingRacks(false);
    }
  };

  const handleRackClick = (rackNumber: number) => {
    if (!editingBooking || !isSelectingRacks) {
      return;
    }

    const rackUsedByOther = bookingsForDisplay.some(
      // Allow racks already used by the same booking (any instance of it).
      // Only block racks occupied by *other* bookings.
      (b) => b.bookingId !== editingBooking.bookingId && b.racks.includes(rackNumber)
    );
    if (rackUsedByOther) {
      return;
    }

    setSelectedRacks((prev) => {
      const newRacks = prev.includes(rackNumber)
        ? prev.filter((n) => n !== rackNumber).sort((a, b) => a - b)
        : [...prev, rackNumber].sort((a, b) => a - b);
      setRackValidationError(null);
      return newRacks;
    });
  };

  return {
    // state
    isSelectingRacks,
    selectedRacks,
    savingRacks,
    applyRacksToAll,
    rackValidationError,
    selectedInstancesForRacks,
    rackSelectionWeekIndex,
    showUpdateRacksConfirm,
    currentWeekInstancesForRacks,
    weeksForRacks,
    seriesInstancesForRacks,
    currentWeekTimeRange,
    bookingSide,
    savedSelectedInstances,
    enteringSelectionModeRef: isEnteringSelectionMode,
    // setters
    setApplyRacksToAll,
    setSelectedInstancesForRacks,
    setRackSelectionWeekIndex,
    setShowUpdateRacksConfirm,
    setSelectedRacks,
    setRackValidationError,
    // actions
    startRackSelection,
    handleCancelRackSelection,
    handleSaveRacks,
    performRackUpdate,
    handleRackClick,
  };
}


