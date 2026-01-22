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
      className="absolute left-0 z-30 pointer-events-none"
      style={{
        top: `${position.top}px`,
        width: totalGridWidth ? `${totalGridWidth}px` : '100%',
        minWidth: '100%',
      }}
    >
      <div className="flex items-center w-full">
        {/* Time label on the left - sticky */}
        <div className="sticky left-0 z-30 bg-indigo-600 text-white text-xs font-mono px-2 py-0.5 rounded-r border-r-2 border-indigo-300 shadow-lg flex-shrink-0">
          {format(new Date(), 'HH:mm')}
        </div>
        {/* Line across all racks - spans the full remaining width */}
        <div
          className="h-0.5 bg-indigo-500 flex-1"
          style={{
            minWidth: numRacks ? `${numRacks * 120}px` : undefined,
            boxShadow: '0 0 8px rgba(var(--brand-primary-rgb), 0.6)',
          }}
        />
      </div>
    </div>
  );
}
