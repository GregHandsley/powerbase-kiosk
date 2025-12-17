import type { ActiveInstance } from "../../../types/snapshot";

type Props = {
  activeId: string | null;
  bookingById: Map<number, ActiveInstance>;
  zoomLevel: number;
};

export function RackEditorDragOverlay({ activeId, bookingById, zoomLevel }: Props) {
  if (!activeId) return null;

  // Extract booking data from activeId (format: "booking-{instanceId}-{rackNumber}")
  const match = activeId.match(/^booking-(\d+)-(\d+)$/);
  if (!match) return null;

  const instanceId = Number(match[1]);
  const booking = bookingById.get(instanceId);
  if (!booking) return null;

  return (
    <div
      className="inline-flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-3 rounded-lg px-4 sm:px-5 py-3 sm:py-4 text-base sm:text-lg text-slate-100 bg-slate-800/60 border-2 border-slate-700 cursor-grabbing opacity-90 w-full"
      style={{ zoom: zoomLevel }}
    >
      <div className="font-semibold line-clamp-2 break-words flex-1 min-w-0 flex items-center gap-2">
        {booking.isLocked && (
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
      <div className="text-sm sm:text-base text-slate-300 whitespace-nowrap flex-shrink-0">
        {booking.start.slice(11, 16)}–{booking.end.slice(11, 16)}
      </div>
    </div>
  );
}

