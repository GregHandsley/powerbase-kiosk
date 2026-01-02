import { useState, useRef, useMemo } from "react";
import type { TimeSlot } from "../../../admin/capacity/scheduleUtils";
import type { SlotCapacityData, BookingBlock } from "../types";

type DragSelectionState = {
  isDragging: boolean;
  dragStart: { slotIndex: number; rackIndex: number } | null;
  dragEnd: { slotIndex: number; rackIndex: number } | null;
};

type DragSelectionResult = {
  startSlot: number;
  endSlot: number;
  startRack: number;
  endRack: number;
} | null;

export function useDragSelection(
  racks: number[],
  timeSlots: TimeSlot[],
  bookingBlocksByRack: Map<number, BookingBlock[]>,
  slotCapacityData: Map<number, SlotCapacityData>,
  onDragSelection?: (selection: {
    startTimeSlot: TimeSlot;
    endTimeSlot: TimeSlot;
    racks: number[];
  }) => void
) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ slotIndex: number; rackIndex: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ slotIndex: number; rackIndex: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Calculate selected range
  const selectedRange = useMemo<DragSelectionResult>(() => {
    if (!dragStart || !dragEnd) return null;

    const minSlot = Math.min(dragStart.slotIndex, dragEnd.slotIndex);
    const maxSlot = Math.max(dragStart.slotIndex, dragEnd.slotIndex);
    const minRack = Math.min(dragStart.rackIndex, dragEnd.rackIndex);
    const maxRack = Math.max(dragStart.rackIndex, dragEnd.rackIndex);

    return {
      startSlot: minSlot,
      endSlot: maxSlot,
      startRack: minRack,
      endRack: maxRack,
    };
  }, [dragStart, dragEnd]);

  // Check if a cell is in the selected range
  const isCellSelected = (slotIndex: number, rackIndex: number) => {
    if (!selectedRange) return false;
    return (
      slotIndex >= selectedRange.startSlot &&
      slotIndex <= selectedRange.endSlot &&
      rackIndex >= selectedRange.startRack &&
      rackIndex <= selectedRange.endRack
    );
  };

  // Check if the selected range is valid (all cells are free)
  const isSelectionValid = useMemo(() => {
    if (!selectedRange) return false;

    for (let slotIndex = selectedRange.startSlot; slotIndex <= selectedRange.endSlot; slotIndex++) {
      for (let rackIndex = selectedRange.startRack; rackIndex <= selectedRange.endRack; rackIndex++) {
        const rack = racks[rackIndex];
        if (!rack) continue;

        // Check if cell has a booking
        const bookingBlocks = bookingBlocksByRack.get(rack) ?? [];
        const hasBooking = bookingBlocks.some(
          (block) => slotIndex >= block.startSlot && slotIndex <= block.endSlot
        );
        if (hasBooking) return false;

        // Check if cell is unavailable (closed or general user)
        const capacityData = slotCapacityData.get(slotIndex);
        const isAvailable =
          !capacityData ||
          capacityData.availablePlatforms === null ||
          capacityData.availablePlatforms.has(rack);
        const isClosed = capacityData?.isClosed ?? false;
        if (!isAvailable || isClosed) return false;
      }
    }

    return true;
  }, [selectedRange, racks, bookingBlocksByRack, slotCapacityData]);

  // Handle mouse events for drag selection
  const handleMouseDown = (e: React.MouseEvent, slotIndex: number, rackIndex: number) => {
    // Only start drag if clicking on an empty, available cell
    const rack = racks[rackIndex];
    if (!rack) return;

    const bookingBlocks = bookingBlocksByRack.get(rack) ?? [];
    const hasBooking = bookingBlocks.some(
      (block) => slotIndex >= block.startSlot && slotIndex <= block.endSlot
    );
    if (hasBooking) return;

    const capacityData = slotCapacityData.get(slotIndex);
    const isAvailable =
      !capacityData ||
      capacityData.availablePlatforms === null ||
      capacityData.availablePlatforms.has(rack);
    const isClosed = capacityData?.isClosed ?? false;
    if (!isAvailable || isClosed) return;

    // Start drag selection
    setIsDragging(true);
    setDragStart({ slotIndex, rackIndex });
    setDragEnd({ slotIndex, rackIndex });
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart || !gridRef.current) return;

    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate which cell we're over
    // Time column is 120px, each rack column is 120px
    const timeColumnWidth = 120;
    const rackColumnWidth = 120;

    if (x < timeColumnWidth) return; // Over time column

    const rackIndex = Math.floor((x - timeColumnWidth) / rackColumnWidth);
    if (rackIndex < 0 || rackIndex >= racks.length) return;

    // Calculate slot index from Y position
    // Each row is approximately 50px high
    const rowHeight = 50;
    const headerHeight = 50; // Approximate header height
    const slotIndex = Math.floor((y - headerHeight) / rowHeight);
    if (slotIndex < 0 || slotIndex >= timeSlots.length) return;

    setDragEnd({ slotIndex, rackIndex });
  };

  const handleMouseUp = () => {
    if (!isDragging || !dragStart || !dragEnd || !onDragSelection) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    // Calculate final selection
    const minSlot = Math.min(dragStart.slotIndex, dragEnd.slotIndex);
    const maxSlot = Math.max(dragStart.slotIndex, dragEnd.slotIndex);
    const minRack = Math.min(dragStart.rackIndex, dragEnd.rackIndex);
    const maxRack = Math.max(dragStart.rackIndex, dragEnd.rackIndex);

    // Get selected racks
    const selectedRacks: number[] = [];
    for (let i = minRack; i <= maxRack; i++) {
      if (racks[i]) {
        selectedRacks.push(racks[i]);
      }
    }

    // Get time slots
    const startTimeSlot = timeSlots[minSlot];
    // For end time, use the next slot after the last selected slot
    // If we're at the last slot, calculate the end time as the slot's end time (slot time + 30 minutes)
    const endSlotIndex = maxSlot + 1;
    let endTimeSlot: TimeSlot;
    if (endSlotIndex < timeSlots.length) {
      endTimeSlot = timeSlots[endSlotIndex];
    } else {
      // We're at the last slot, so the end time should be the slot's end time (slot + 30 minutes)
      const lastSlot = timeSlots[maxSlot];
      const endHour = lastSlot.minute === 30 ? lastSlot.hour + 1 : lastSlot.hour;
      const endMinute = lastSlot.minute === 30 ? 0 : 30;
      endTimeSlot = { hour: endHour, minute: endMinute };
    }

    // Only trigger if selection is valid
    if (isSelectionValid && selectedRacks.length > 0 && startTimeSlot && endTimeSlot) {
      onDragSelection({
        startTimeSlot,
        endTimeSlot,
        racks: selectedRacks,
      });
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  // Handle mouse leave to cancel drag
  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
    }
  };

  return {
    gridRef,
    isDragging,
    selectedRange,
    isSelectionValid,
    isCellSelected,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  };
}

