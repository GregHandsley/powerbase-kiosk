import { format } from 'date-fns';

type Props = {
  position: { slotIndex: number; top: number };
  isToday: boolean;
  numRacks?: number; // Number of rack columns
};

export function CurrentTimeIndicator({ position, isToday, numRacks }: Props) {
  if (!isToday || !position) return null;

  // Calculate total grid width: time column (120px) + all rack columns (120px each)
  const totalGridWidth = numRacks ? 120 + numRacks * 120 : undefined;

  return (
    <div
      className="absolute left-0 z-[15] pointer-events-none"
      style={{
        top: `${position.top}px`,
        width: totalGridWidth ? `${totalGridWidth}px` : '100%',
        minWidth: '100%',
      }}
    >
      <div className="flex items-center w-full">
        {/* Time label on the left - sticky */}
        <div className="sticky left-0 z-[15] bg-amber-400/95 text-slate-950 text-xs font-semibold font-mono px-2 py-0.5 rounded-r border-r-2 border-amber-200 shadow-[0_0_0_1px_rgba(251,191,36,0.4),0_6px_16px_rgba(251,191,36,0.35)] flex-shrink-0">
          NOW {format(new Date(), 'HH:mm')}
        </div>
        {/* High-contrast line across racks */}
        <div
          className="relative flex-1"
          style={{
            minWidth: numRacks ? `${numRacks * 120}px` : undefined,
          }}
        >
          <div className="h-1 w-full bg-amber-500/85 shadow-[0_0_10px_rgba(251,191,36,0.65)]" />
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-white/90" />
        </div>
      </div>
    </div>
  );
}
