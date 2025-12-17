import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ActiveInstance } from "../../types/snapshot";

type Props = {
  booking: ActiveInstance;
  fromRack: number;
  activeId?: string | null;
};

export function DraggableBooking({ booking, fromRack, activeId }: Props) {
  const dragId = `booking-${booking.instanceId}-${fromRack}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { bookingId: booking.instanceId, fromRack },
  });

  // Only hide if this item is being dragged (use hook's isDragging state)
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="inline-flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-3 rounded-lg px-4 sm:px-5 py-3 sm:py-4 text-base sm:text-lg text-slate-100 bg-slate-800/60 border-2 border-slate-700 cursor-grab active:cursor-grabbing w-full"
    >
      <div className="font-semibold line-clamp-2 break-words flex-1 min-w-0">
        {booking.title}
      </div>
      <div className="text-sm sm:text-base text-slate-300 whitespace-nowrap flex-shrink-0">
        {booking.start.slice(11, 16)}–{booking.end.slice(11, 16)}
      </div>
    </div>
  );
}

