import { useState } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { ActiveInstance } from '../../../../types/snapshot';

type UseDragHandlersProps = {
  assignments: Map<number, number[]>;
  setAssignments: React.Dispatch<React.SetStateAction<Map<number, number[]>>>;
  initialAssignments: Map<number, number[]>;
  bookingById: Map<number, ActiveInstance>;
  /** Set of available platform numbers based on capacity schedules (null = all available) */
  availablePlatforms?: Set<number> | null;
};

export function useDragHandlers({
  assignments,
  setAssignments,
  initialAssignments,
  bookingById,
  availablePlatforms = null,
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
    const bookingId = active.data.current?.bookingId as number | undefined;
    const fromRack = active.data.current?.fromRack as number | undefined;

    // When we reject the drop (e.g. conflict or invalid target), force state to
    // keep the booking in its current position so it visibly snaps back.
    const restoreOriginalPosition = () => {
      if (bookingId === undefined) return;
      setAssignments((prev) => {
        const current =
          prev.get(bookingId) ?? initialAssignments.get(bookingId) ?? [];
        const next = new Map(prev);
        next.set(bookingId, [...current]);
        return next;
      });
    };

    if (!over) {
      setDragError(null);
      restoreOriginalPosition();
      return;
    }

    if (!bookingId || fromRack === undefined) {
      setDragError(null);
      return;
    }

    const overRackNumber = over.data?.current?.rackNumber as
      | number
      | null
      | undefined;
    if (overRackNumber === undefined || overRackNumber === null) {
      setDragError(null);
      restoreOriginalPosition();
      return; // only drop on bookable racks (e.g. dropped on another booking)
    }

    // Dropping on the same rack is a no-op; snap back to avoid any flicker
    if (fromRack === overRackNumber) {
      setDragError(null);
      restoreOriginalPosition();
      return;
    }

    // Multi-platform booking: if this booking is already on the target rack, we're
    // dragging one of its slots onto another. Allowing that would collapse two
    // slots into one (e.g. [1,2,3,4,5,6] -> [1,2,4,5,6]). Reject and snap back.
    const currentRacks =
      assignments.get(bookingId) ?? initialAssignments.get(bookingId) ?? [];
    if (currentRacks.includes(overRackNumber)) {
      setDragError(null);
      restoreOriginalPosition();
      return;
    }

    // Check if the target rack is available in the capacity schedule
    // If availablePlatforms is null, all platforms are available (no restriction)
    // If availablePlatforms is a Set, only racks in that Set are available
    if (
      availablePlatforms !== null &&
      !availablePlatforms.has(overRackNumber)
    ) {
      setDragError(
        `Cannot move booking: Rack ${overRackNumber} is not available for booking (reserved for General User)`
      );
      setTimeout(() => setDragError(null), 5000);
      restoreOriginalPosition();
      return;
    }

    // Get the booking being moved
    const movingBooking = bookingById.get(bookingId);
    if (!movingBooking) {
      setDragError(null);
      restoreOriginalPosition();
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
      setDragError(null);
      restoreOriginalPosition();
      return;
    }

    // No conflict, proceed with the move
    setDragError(null);
    setAssignments((prev) => {
      const original =
        prev.get(bookingId) ?? initialAssignments.get(bookingId) ?? [];
      const replaced = original.map((r) =>
        r === fromRack ? overRackNumber : r
      );
      const newRacks = Array.from(
        new Set(replaced.length ? replaced : [overRackNumber])
      );
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
