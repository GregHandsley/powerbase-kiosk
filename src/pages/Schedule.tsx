import { useMemo, useState, useRef, useEffect } from "react";
import { addDays, format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateTimeSlots, type TimeSlot } from "../components/admin/capacity/scheduleUtils";

type SlotCapacityData = {
  availablePlatforms: Set<number> | null;
  isClosed: boolean;
  periodType: string | null;
  periodEndTime?: string;
};
import { ScheduleGrid } from "../components/schedule/ScheduleGrid";
import { DayNavigationHeader } from "../components/schedule/DayNavigationHeader";
import { makeBaseLayout, makePowerLayout } from "../components/schedule/shared/layouts";
import { useScheduleDayCapacity } from "../components/schedule/hooks/useScheduleDayCapacity";
import { calculateCapacityExceededSlots } from "../components/schedule/grid/utils/capacityExceeded";
import type { ScheduleData } from "../components/admin/capacity/scheduleUtils";
import { BookingEditorModal } from "../components/schedule/BookingEditorModal";
import { MiniScheduleFloorplan } from "../components/shared/MiniScheduleFloorplan";
import { RackSelectionPanel } from "../components/schedule/rack-editor/RackSelectionPanel";
import { CreateBookingModal } from "../components/schedule/CreateBookingModal";
import { UpdateRacksConfirmationDialog } from "../components/schedule/booking-editor/UpdateRacksConfirmationDialog";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import type { ActiveInstance } from "../types/snapshot";

type NewBookingContext = {
  date: Date;
  timeSlot: TimeSlot;
  rack: number;
  side: "Power" | "Base";
  selectedRacks?: number[]; // For drag selection
  endTimeSlot?: TimeSlot; // For drag selection end time
} | null;

export function Schedule() {
  const { role } = useAuth();
  const [selectedSide, setSelectedSide] = useState<"Power" | "Base">("Power");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingBooking, setEditingBooking] = useState<ActiveInstance | null>(null);
  const [isSelectingRacks, setIsSelectingRacks] = useState(false);
  const [newBookingContext, setNewBookingContext] = useState<NewBookingContext>(null);
  const [selectedRacks, setSelectedRacks] = useState<number[]>([]);
  const [savingRacks, setSavingRacks] = useState(false);
  const [selectedInstancesForRacks, setSelectedInstancesForRacks] = useState<Set<number>>(new Set());
  const [applyRacksToAll, setApplyRacksToAll] = useState(false);
  const [rackValidationError, setRackValidationError] = useState<string | null>(null);
  const [savedSelectedInstances, setSavedSelectedInstances] = useState<Set<number>>(new Set());
  const [rackSelectionWeekIndex, setRackSelectionWeekIndex] = useState(0);
  const [showUpdateRacksConfirm, setShowUpdateRacksConfirm] = useState(false);
  const isEnteringSelectionMode = useRef(false);
  const queryClient = useQueryClient();
  const allTimeSlots = generateTimeSlots();
  const sideKey = selectedSide === "Power" ? "power" : "base";

  // Get capacity data for the day
  const { sideId, slotCapacityData, isLoading: capacityLoading, capacitySchedules } = useScheduleDayCapacity({
    side: sideKey,
    date: currentDate,
    timeSlots: allTimeSlots,
  });

  // Filter time slots to only show available ones (exclude closed periods)
  // Also create a mapping from filtered index to original index for capacity data lookups
  const { timeSlots, slotIndexMap } = useMemo(() => {
    const availableSlots: typeof allTimeSlots = [];
    const indexMap = new Map<number, number>(); // filtered index -> original index

    allTimeSlots.forEach((slot, originalIndex) => {
      const capacityData = slotCapacityData.get(originalIndex);
      const isClosed = capacityData?.isClosed ?? false;

      // Only include slots that are not closed
      if (!isClosed) {
        const filteredIndex = availableSlots.length;
        availableSlots.push(slot);
        indexMap.set(filteredIndex, originalIndex);
      }
    });

    return { timeSlots: availableSlots, slotIndexMap: indexMap };
  }, [allTimeSlots, slotCapacityData]);

  // Create a filtered slotCapacityData map using filtered indices
  const filteredSlotCapacityData = useMemo(() => {
    const filtered = new Map<number, SlotCapacityData>();
    slotIndexMap.forEach((originalIndex, filteredIndex) => {
      const capacityData = slotCapacityData.get(originalIndex);
      if (capacityData) {
        filtered.set(filteredIndex, capacityData);
      }
    });
    return filtered;
  }, [slotIndexMap, slotCapacityData]);

  // Get racks from layout definitions (same approach as LiveView)
  const rackNumbers = useMemo(() => {
    const layout = selectedSide === "Base" ? makeBaseLayout() : makePowerLayout();
    // Extract unique rack numbers, filtering out null (platforms) and disabled racks
    const racks = layout
      .filter((row) => row.rackNumber !== null && !row.disabled)
      .map((row) => row.rackNumber as number)
      .sort((a, b) => a - b);
    return racks;
  }, [selectedSide]);

  const navigateDay = (direction: "prev" | "next") => {
    setCurrentDate((prev) => addDays(prev, direction === "next" ? 1 : -1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Fetch bookings for the selected date
  const dateStr = format(currentDate, "yyyy-MM-dd");
  const startOfDay = new Date(currentDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(currentDate);
  endOfDay.setHours(23, 59, 59, 999);

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ["schedule-bookings", sideId, dateStr],
    queryFn: async () => {
      if (!sideId) return [];

      const { data, error } = await supabase
        .from("booking_instances")
        .select(
          `
          id,
          booking_id,
          side_id,
          start,
          "end",
          racks,
          areas,
          capacity,
          booking:bookings (
            title,
            color,
            is_locked,
            created_by
          )
        `
        )
        .eq("side_id", sideId)
        .lt("start", endOfDay.toISOString()) // instance starts before end of day
        .gt("end", startOfDay.toISOString()) // instance ends after start of day
        .order("start", { ascending: true });

      if (error) {
        console.error("[Schedule] Error fetching bookings:", error);
        return [];
      }

      // Normalize to ActiveInstance format
      return (data ?? []).map((row: unknown) => {
        const r = row as {
          id: number;
          booking_id: number;
          start: string;
          end: string;
          racks: number[] | unknown;
          areas: string[] | unknown;
          capacity?: number;
          booking?: {
            title?: string;
            color?: string;
            is_locked?: boolean;
            created_by?: string;
          } | null;
        };
        return {
          instanceId: r.id,
          bookingId: r.booking_id,
          start: r.start,
          end: r.end,
          racks: Array.isArray(r.racks) ? r.racks : [],
          areas: Array.isArray(r.areas) ? r.areas : [],
          title: r.booking?.title ?? "Untitled",
          color: r.booking?.color ?? null,
          isLocked: r.booking?.is_locked ?? false,
          createdBy: r.booking?.created_by ?? null,
          capacity: typeof r.capacity === "number" ? r.capacity : undefined,
        };
      }) as ActiveInstance[];
    },
    enabled: !!sideId,
  });

  // Calculate capacity-exceeded slots (after bookings are fetched)
  const capacityExceededBySlot = useMemo(() => {
    if (!sideId || !capacitySchedules || capacitySchedules.length === 0 || bookings.length === 0) {
      return new Map<number, Set<number>>();
    }

    return calculateCapacityExceededSlots(
      timeSlots,
      currentDate,
      bookings,
      capacitySchedules as ScheduleData[],
      sideId
    );
  }, [sideId, capacitySchedules, timeSlots, currentDate, bookings]);

  const handleCellClick = (rack: number, timeSlot: TimeSlot) => {
    // Open the create booking modal with pre-filled values
    setNewBookingContext({
      date: currentDate,
      timeSlot,
      rack,
      side: selectedSide,
    });
  };

  const handleDragSelection = (selection: {
    startTimeSlot: TimeSlot;
    endTimeSlot: TimeSlot;
    racks: number[];
  }) => {
    // Open the create booking modal with the drag selection
    // Use the first rack and start time for the initial context
    // The form will be pre-filled with all selected racks
    setNewBookingContext({
      date: currentDate,
      timeSlot: selection.startTimeSlot,
      rack: selection.racks[0], // Use first rack for context
      side: selectedSide,
      selectedRacks: selection.racks, // Pass all selected racks
      endTimeSlot: selection.endTimeSlot, // Pass end time
    });
  };

  const handleCloseNewBookingModal = () => {
    setNewBookingContext(null);
    // Refresh bookings after closing (in case a booking was created)
    queryClient.invalidateQueries({ queryKey: ["schedule-bookings"], exact: false });
  };

  const handleEditBooking = (booking: ActiveInstance) => {
    setEditingBooking(booking);
  };


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
      }));
    },
    enabled: !!editingBooking && isSelectingRacks,
  });

  // Fetch the side key for the booking's side_id
  const { data: bookingSide } = useQuery({
    queryKey: ["side-key", seriesInstancesForRacks[0]?.sideId],
    queryFn: async () => {
      const bookingSideId = seriesInstancesForRacks[0]?.sideId;
      if (!bookingSideId) return null;

      const { data, error } = await supabase
        .from("sides")
        .select("key")
        .eq("id", bookingSideId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching side key:", error);
        return null;
      }

      return (data?.key === "power" ? "Power" : "Base") as "Power" | "Base" | null;
    },
    enabled: isSelectingRacks && !!seriesInstancesForRacks[0]?.sideId,
  });

  // Group instances by week for navigation
  const instancesByWeekForRacks = useMemo(() => {
    const weekMap = new Map<number, typeof seriesInstancesForRacks>();
    seriesInstancesForRacks.forEach((inst) => {
      const startDate = new Date(inst.start);
      // Get the start of the week (Monday)
      const weekStart = new Date(startDate);
      const dayOfWeek = startDate.getDay();
      const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
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
      currentWeekForRacks
        ? instancesByWeekForRacks.get(currentWeekForRacks) ?? []
        : [],
    [currentWeekForRacks, instancesByWeekForRacks]
  );

  // Calculate time range for current week to fetch overlapping bookings
  const currentWeekTimeRange = useMemo(() => {
    if (currentWeekInstancesForRacks.length === 0) return null;
    const starts = currentWeekInstancesForRacks.map(inst => new Date(inst.start).getTime());
    const ends = currentWeekInstancesForRacks.map(inst => new Date(inst.end).getTime());
    return {
      start: new Date(Math.min(...starts)).toISOString(),
      end: new Date(Math.max(...ends)).toISOString(),
    };
  }, [currentWeekInstancesForRacks]);

  // Fetch bookings for the current week to check conflicts
  const { data: bookingsForDisplay = [] } = useQuery({
    queryKey: ["bookings-for-rack-selection", currentWeekTimeRange?.start, currentWeekTimeRange?.end, sideId],
    queryFn: async () => {
      if (!currentWeekTimeRange || !sideId) return [];

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
        .eq("side_id", sideId)
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
    enabled: !!currentWeekTimeRange && !!sideId && isSelectingRacks,
  });

  // Update selected instances when applyRacksToAll changes
  useEffect(() => {
    if (!isSelectingRacks || !editingBooking) return;
    
    if (applyRacksToAll && seriesInstancesForRacks.length > 0) {
      const allInstanceIds = new Set(seriesInstancesForRacks.map((inst) => inst.id));
      setSelectedInstancesForRacks((prev) => {
        // Only update if different to avoid unnecessary re-renders
        if (prev.size !== allInstanceIds.size || !Array.from(prev).every(id => allInstanceIds.has(id))) {
          return allInstanceIds;
        }
        return prev;
      });
    } else if (!applyRacksToAll) {
      if (savedSelectedInstances.size > 0) {
        setSelectedInstancesForRacks((prev) => {
          // Only update if different
          if (prev.size !== savedSelectedInstances.size || !Array.from(prev).every(id => savedSelectedInstances.has(id))) {
            return new Set(savedSelectedInstances);
          }
          return prev;
        });
      } else {
        setSelectedInstancesForRacks((prev) => {
          // Only update if different
          if (!prev.has(editingBooking.instanceId) || prev.size !== 1) {
            return new Set([editingBooking.instanceId]);
          }
          return prev;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyRacksToAll, seriesInstancesForRacks.length, editingBooking?.instanceId, isSelectingRacks]);

  const handleEditRacks = (selectedInstancesFromModal?: Set<number>) => {
    if (editingBooking) {
      const initialRacks = [...editingBooking.racks];
      // Save selected instances from modal for later restoration
      if (selectedInstancesFromModal && selectedInstancesFromModal.size > 0) {
        setSavedSelectedInstances(new Set(selectedInstancesFromModal));
      }
      // Set flag to prevent handleModalClose from clearing editingBooking
      isEnteringSelectionMode.current = true;
      // Set selection mode - modal will close automatically
      setIsSelectingRacks(true);
      setSelectedRacks(initialRacks);
      // Use selected instances from modal if provided, otherwise default to current instance
      if (selectedInstancesFromModal && selectedInstancesFromModal.size > 0) {
        setSelectedInstancesForRacks(selectedInstancesFromModal);
      } else {
        // Initially select only the current instance
        setSelectedInstancesForRacks(new Set([editingBooking.instanceId]));
        setApplyRacksToAll(false);
      }
    }
  };

  const handleCancelRackSelection = () => {
    setIsSelectingRacks(false);
    setRackValidationError(null);
    setEditingBooking(null); // Close the modal and return to schedule view
    if (editingBooking) {
      setSelectedRacks([...editingBooking.racks]);
    }
  };

  // Validate racks for conflicts before saving
  const validateRacksForInstances = async (): Promise<string | null> => {
    if (!editingBooking || selectedRacks.length === 0 || selectedInstancesForRacks.size === 0) {
      return null;
    }

    // Get the selected instances with their time ranges
    const instancesToCheck = seriesInstancesForRacks.filter((inst) =>
      selectedInstancesForRacks.has(inst.id)
    );

    if (instancesToCheck.length === 0) {
      return null;
    }

    // Get the side_id from the first instance
    const sideId = instancesToCheck[0]?.sideId;
    
    if (!sideId) {
      return "Unable to determine side for validation. Please try again.";
    }

    // Check each instance for conflicts
    const conflicts: Array<{
      instanceId: number;
      instanceTime: string;
      rack: number;
      conflictingBooking: string;
    }> = [];

    for (const instance of instancesToCheck) {
      // Fetch all booking instances that overlap with this instance's time range
      // and use any of the selected racks
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

      // Check each selected rack for conflicts
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
            conflictingBooking:
              (conflictingInstance.booking as { title?: string })?.title ?? "Unknown",
          });
        }
      }
    }

    if (conflicts.length > 0) {
      // Group conflicts by instance for better error message
      const conflictsByInstance = new Map<
        number,
        Array<{ rack: number; conflictingBooking: string }>
      >();
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

    // Clear any previous validation errors
    setRackValidationError(null);

    // Validate for conflicts
    const validationError = await validateRacksForInstances();
    if (validationError) {
      setRackValidationError(validationError);
      return;
    }

    // Show confirmation if updating multiple instances
    if (selectedInstancesForRacks.size > 1) {
      setShowUpdateRacksConfirm(true);
      return; // Wait for confirmation
    }

    // If only one session, proceed directly
    await performRackUpdate();
  };

  const performRackUpdate = async () => {
    if (!editingBooking || selectedRacks.length === 0) return;

    setSavingRacks(true);
    try {
      // Update all selected instances
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

      await queryClient.invalidateQueries({ queryKey: ["schedule-bookings"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["snapshot"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-instances-debug"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-series"], exact: false });
      await queryClient.invalidateQueries({ queryKey: ["booking-series-racks"], exact: false });

      setIsSelectingRacks(false);
      setEditingBooking(null);
      setRackValidationError(null);
      setShowUpdateRacksConfirm(false);
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

    // Check if rack is used by another booking
    const rackUsedByOther = bookingsForDisplay.some(
      (b) => b.instanceId !== editingBooking.instanceId && b.racks.includes(rackNumber)
    );
    if (rackUsedByOther) {
      return; // Can't select racks used by others
    }

    setSelectedRacks((prev) => {
      const newRacks = prev.includes(rackNumber)
        ? prev.filter((n) => n !== rackNumber).sort((a, b) => a - b)
        : [...prev, rackNumber].sort((a, b) => a - b);
      // Clear validation error when racks change
      setRackValidationError(null);
      return newRacks;
    });
  };

  const handleModalClose = () => {
    // Only clear editingBooking if we're not entering selection mode
    if (!isSelectingRacks && !isEnteringSelectionMode.current) {
      setEditingBooking(null);
    } else {
      isEnteringSelectionMode.current = false; // Reset the flag
    }
    // Invalidate schedule bookings query when modal closes to refresh the grid
    queryClient.invalidateQueries({ queryKey: ["schedule-bookings"], exact: false });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold">Schedule</h1>
          <p className="text-sm text-slate-300">
            Manage bookings and availability by rack and time.
          </p>
        </div>
        
        {/* Day Navigation */}
        <DayNavigationHeader
          currentDate={currentDate}
          selectedSide={selectedSide}
          onNavigateDay={navigateDay}
          onGoToToday={goToToday}
          onSideChange={setSelectedSide}
          onDateChange={setCurrentDate}
          lockedSide={isSelectingRacks && bookingSide ? bookingSide : undefined}
        />
      </header>

      {/* Rack Selection Panel */}
      {isSelectingRacks && editingBooking && (
        <div className="space-y-4">
          <RackSelectionPanel
            editingBooking={editingBooking}
            selectedRacks={selectedRacks}
            rackValidationError={rackValidationError}
            savingRacks={savingRacks}
            applyRacksToAll={applyRacksToAll}
            setApplyRacksToAll={(value) => {
              setApplyRacksToAll(value);
              if (rackValidationError) {
                setRackValidationError(null);
              }
            }}
            seriesInstancesForRacks={seriesInstancesForRacks}
            weeksForRacks={weeksForRacks}
            rackSelectionWeekIndex={rackSelectionWeekIndex}
            setRackSelectionWeekIndex={setRackSelectionWeekIndex}
            currentWeekInstancesForRacks={currentWeekInstancesForRacks}
            selectedInstancesForRacks={selectedInstancesForRacks}
            setSelectedInstancesForRacks={setSelectedInstancesForRacks}
            handleCancelRackSelection={handleCancelRackSelection}
            handleSaveRacks={handleSaveRacks}
          />
          
          {/* Mini Schedule Floorplan for rack selection */}
          {currentWeekTimeRange && (
            <div className="border border-slate-700 rounded-lg bg-slate-900/60 p-4">
              <MiniScheduleFloorplan
                sideKey={selectedSide}
                selectedRacks={selectedRacks}
                onRackClick={(rackNumber, replaceSelection = false) => {
                  if (replaceSelection) {
                    setSelectedRacks([rackNumber]);
                    setRackValidationError(null);
                    return;
                  }
                  handleRackClick(rackNumber);
                }}
                startTime={currentWeekTimeRange.start}
                endTime={currentWeekTimeRange.end}
                showTitle={true}
                allowConflictingRacks={false}
                ignoreBookings={false}
                excludeInstanceIds={new Set(selectedInstancesForRacks)}
              />
            </div>
          )}
        </div>
      )}

      {/* Schedule Grid */}
      {!isSelectingRacks && (bookingsLoading || capacityLoading ? (
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      ) : (
        <ScheduleGrid
          racks={rackNumbers}
          timeSlots={timeSlots}
          selectedSide={selectedSide}
          bookings={bookings}
          currentDate={currentDate}
          slotCapacityData={filteredSlotCapacityData}
          capacityExceededBySlot={capacityExceededBySlot}
          onCellClick={handleCellClick}
          onBookingClick={handleEditBooking}
          onDragSelection={handleDragSelection}
        />
      ))}

      {/* Booking Editor Modal */}
      <BookingEditorModal
        booking={editingBooking}
        isOpen={editingBooking !== null && !isSelectingRacks}
        onClose={handleModalClose}
        onClearRacks={handleEditRacks}
        initialSelectedInstances={savedSelectedInstances.size > 0 ? savedSelectedInstances : undefined}
      />

      {/* Create Booking Modal */}
      {newBookingContext && (
        <CreateBookingModal
          isOpen={!!newBookingContext}
          onClose={handleCloseNewBookingModal}
          initialDate={newBookingContext.date}
          initialTimeSlot={newBookingContext.timeSlot}
          initialRack={newBookingContext.rack}
          initialSide={newBookingContext.side}
          role={role || "coach"}
          selectedRacks={newBookingContext.selectedRacks}
          endTimeSlot={newBookingContext.endTimeSlot}
          onSuccess={handleCloseNewBookingModal}
        />
      )}

      {/* Update Racks Confirmation Dialog */}
      {isSelectingRacks && (
        <UpdateRacksConfirmationDialog
          isOpen={showUpdateRacksConfirm}
          sessionCount={selectedInstancesForRacks.size}
          racks={selectedRacks}
          onCancel={() => setShowUpdateRacksConfirm(false)}
          onConfirm={performRackUpdate}
          saving={savingRacks}
        />
      )}
    </div>
  );
}

