import { useState } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { ActiveInstance } from "../../../../types/snapshot";

type UseDragHandlersProps = {
  assignments: Map<number, number[]>;
  setAssignments: React.Dispatch<React.SetStateAction<Map<number, number[]>>>;
  initialAssignments: Map<number, number[]>;
};

export function useDragHandlers({ assignments, setAssignments, initialAssignments }: UseDragHandlersProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const bookingId = active.data.current?.bookingId as number | undefined;
    const fromRack = active.data.current?.fromRack as number | undefined;
    if (!bookingId) return;
    if (!fromRack) return;
    const overRackNumber = over.data?.current?.rackNumber as number | null | undefined;
    if (!overRackNumber) return; // only drop on bookable racks

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
    handleDragStart,
    handleDragEnd,
  };
}

