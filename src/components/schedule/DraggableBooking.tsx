import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ActiveInstance } from "../../types/snapshot";
import { useAuth } from "../../context/AuthContext";

type Props = {
  booking: ActiveInstance;
  fromRack: number;
  activeId?: string | null;
  onEdit?: (booking: ActiveInstance) => void;
  isSelectingRacks?: boolean;
};

export function DraggableBooking({ booking, fromRack, activeId, onEdit, isSelectingRacks = false }: Props) {
  const { role } = useAuth();
  const dragId = `booking-${booking.instanceId}-${fromRack}`;
  
  // Admins can always drag, coaches cannot drag locked bookings
  const isLocked = booking.isLocked && role !== "admin";
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: { bookingId: booking.instanceId, fromRack },
    disabled: isLocked || isSelectingRacks, // Disable dragging when selecting racks
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
      {...(isLocked || isSelectingRacks ? {} : { ...listeners, ...attributes })}
      onClick={(e) => {
        // Prevent clicks from bubbling up when selecting racks
        if (isSelectingRacks) {
          e.stopPropagation();
        }
      }}
      className={`inline-flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-3 rounded-lg px-4 sm:px-5 py-3 sm:py-4 text-base sm:text-lg w-full border-2 ${
        isLocked
          ? "bg-slate-800/40 border-slate-600/50 text-slate-400 cursor-not-allowed opacity-75"
          : isSelectingRacks
            ? "bg-slate-800/60 border-slate-700 text-slate-100 cursor-default"
            : "bg-slate-800/60 border-slate-700 text-slate-100 cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="font-semibold line-clamp-2 break-words flex-1 min-w-0 flex items-center gap-2">
        {isLocked && (
          <svg
            className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-label="Locked"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        )}
        <span>{booking.title}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="text-sm sm:text-base text-slate-300 whitespace-nowrap">
          {booking.start.slice(11, 16)}–{booking.end.slice(11, 16)}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(booking);
            }}
            disabled={isLocked}
            className="p-1.5 rounded-md hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Edit platforms"
            aria-label="Edit platforms"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

