import { useMemo, useState } from "react";
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
import { useRackSelection } from "../components/schedule/rack-editor/useRackSelection";
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
  const [newBookingContext, setNewBookingContext] = useState<NewBookingContext>(null);
  const queryClient = useQueryClient();
  const allTimeSlots = generateTimeSlots();
  const sideKey = selectedSide === "Power" ? "power" : "base";

  const {
    isSelectingRacks,
    selectedRacks,
    savingRacks,
    applyRacksToAll,
    setApplyRacksToAll,
    rackValidationError,
    seriesInstancesForRacks,
    weeksForRacks,
    rackSelectionWeekIndex,
    setRackSelectionWeekIndex,
    currentWeekInstancesForRacks,
    selectedInstancesForRacks,
    setSelectedInstancesForRacks,
    setSelectedRacks,
    currentWeekTimeRange,
    bookingSide,
    savedSelectedInstances,
    showUpdateRacksConfirm,
    setShowUpdateRacksConfirm,
    setRackValidationError,
    startRackSelection: handleEditRacks,
    handleCancelRackSelection,
    handleSaveRacks,
    performRackUpdate,
    handleRackClick,
    enteringSelectionModeRef,
  } = useRackSelection({
    editingBooking,
    setEditingBooking,
  });

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

  const handleModalClose = () => {
    // Only clear editingBooking if we're not entering selection mode
    if (!isSelectingRacks && !enteringSelectionModeRef.current) {
      setEditingBooking(null);
    } else {
      enteringSelectionModeRef.current = false; // Reset the flag
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
                sideKey={bookingSide ?? selectedSide}
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
                excludeInstanceIds={new Set(seriesInstancesForRacks.map((inst) => inst.id))}
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
        initialSelectedInstances={
          savedSelectedInstances.size > 0 ? savedSelectedInstances : undefined
        }
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

