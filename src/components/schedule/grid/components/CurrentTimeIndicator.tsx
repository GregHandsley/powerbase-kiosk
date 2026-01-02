import { format } from "date-fns";

type Props = {
  position: { slotIndex: number; top: number };
  isToday: boolean;
};

export function CurrentTimeIndicator({ position, isToday }: Props) {
  if (!isToday || !position) return null;

  return (
    <div
      className="absolute left-0 right-0 z-30 pointer-events-none"
      style={{
        top: `${position.top}px`,
      }}
    >
      <div className="flex items-center">
        {/* Time label on the left */}
        <div className="sticky left-0 z-30 bg-indigo-600 text-white text-xs font-mono px-2 py-0.5 rounded-r border-r-2 border-indigo-400 shadow-lg">
          {format(new Date(), "HH:mm")}
        </div>
        {/* Line across all racks */}
        <div className="flex-1 h-0.5 bg-indigo-500 shadow-[0_0_4px_rgba(99,102,241,0.8)]" />
      </div>
    </div>
  );
}

