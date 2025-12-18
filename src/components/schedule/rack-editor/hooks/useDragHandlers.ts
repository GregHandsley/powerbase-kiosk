import { useState } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { ActiveInstance } from "../../../../types/snapshot";

type UseDragHandlersProps = {
  assignments: Map<number, number[]>;
  setAssignments: React.Dispatch<React.SetStateAction<Map<number, number[]>>>;
  initialAssignments: Map<number, number[]>;
  bookingById: Map<number, ActiveInstance>;
};

export function useDragHandlers({ 
  assignments, 
  setAssignments, 
  initialAssignments,
  bookingById,
}: UseDragHandlersProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setDragError(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) {
      setDragError(null);
      return;
    }
    
    const bookingId = active.data.current?.bookingId as number | undefined;
    const fromRack = active.data.current?.fromRack as number | undefined;
    if (!bookingId) {
      setDragError(null);
      return;
    }
    if (!fromRack) {
      setDragError(null);
      return;
    }
    
    const overRackNumber = over.data?.current?.rackNumber as number | null | undefined;
    if (!overRackNumber) {
      setDragError(null);
      return; // only drop on bookable racks
    }

    // Get the booking being moved
    const movingBooking = bookingById.get(bookingId);
    if (!movingBooking) {
      setDragError(null);
      return;
    }

    // Check if the target rack already has a booking that overlaps in time
    const conflictingBooking = findConflictingBooking(
      overRackNumber,
      movingBooking,
      assignments,
      bookingById
    );

    if (conflictingBooking) {
      const conflictTitle = conflictingBooking.title;
      const conflictTime = `${conflictingBooking.start.slice(11, 16)}–${conflictingBooking.end.slice(11, 16)}`;
      setDragError(
        `Cannot move booking: Rack ${overRackNumber} is already booked by "${conflictTitle}" (${conflictTime})`
      );
      // Clear error after 5 seconds
      setTimeout(() => setDragError(null), 5000);
      return;
    }

    // No conflict, proceed with the move
    setDragError(null);
    setAssignments((prev) => {
      const original = prev.get(bookingId) ?? initialAssignments.get(bookingId) ?? [];
      const replaced = original.map((r) => (r === fromRack ? overRackNumber : r));
      const newRacks = Array.from(new Set(replaced.length ? replaced : [overRackNumber]));
      const next = new Map(prev);
      next.set(bookingId, newRacks);
      return next;
    });
  };

  return {
    activeId,
    dragError,
    handleDragStart,
    handleDragEnd,
  };
}

/**
 * Find if there's a booking on the target rack that overlaps in time with the moving booking
 */
function findConflictingBooking(
  targetRack: number,
  movingBooking: ActiveInstance,
  assignments: Map<number, number[]>,
  bookingById: Map<number, ActiveInstance>
): ActiveInstance | null {
  const movingStart = new Date(movingBooking.start);
  const movingEnd = new Date(movingBooking.end);

  // Check all bookings assigned to the target rack
  for (const [otherBookingId, racks] of assignments.entries()) {
    // Skip the booking being moved
    if (otherBookingId === movingBooking.instanceId) continue;

    // Check if this booking uses the target rack
    if (!racks.includes(targetRack)) continue;

    const otherBooking = bookingById.get(otherBookingId);
    if (!otherBooking) continue;

    // Check if the bookings overlap in time
    const otherStart = new Date(otherBooking.start);
    const otherEnd = new Date(otherBooking.end);

    // Two bookings overlap if: movingStart < otherEnd && movingEnd > otherStart
    if (movingStart < otherEnd && movingEnd > otherStart) {
      return otherBooking;
    }
  }

  return null;
}

