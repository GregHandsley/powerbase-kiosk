import { addDays, format } from "date-fns";
import clsx from "clsx";

/**
 * Get ordinal suffix for a number (1st, 2nd, 3rd, 4th, etc.)
 */
function getOrdinalSuffix(day: number): string {
  const j = day % 10;
  const k = day % 100;
  if (j === 1 && k !== 11) {
    return "st";
  }
  if (j === 2 && k !== 12) {
    return "nd";
  }
  if (j === 3 && k !== 13) {
    return "rd";
  }
  return "th";
}

type Props = {
  currentDate: Date;
  selectedSide: "Power" | "Base";
  onNavigateDay: (direction: "prev" | "next") => void;
  onGoToToday: () => void;
  onSideChange: (side: "Power" | "Base") => void;
  onDateChange?: (date: Date) => void;
  /** If provided, locks the side selector to this side and disables changes */
  lockedSide?: "Power" | "Base";
};

export function DayNavigationHeader({
  currentDate,
  selectedSide,
  onNavigateDay,
  onGoToToday,
  onSideChange,
  onDateChange,
  lockedSide,
}: Props) {
  const isToday = format(currentDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const dateStr = format(currentDate, "yyyy-MM-dd");

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onDateChange && e.target.value) {
      const newDate = new Date(e.target.value);
      onDateChange(newDate);
    }
  };

  return (
    <div className="flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onNavigateDay("prev")}
          className="p-2 rounded-md border border-slate-600 bg-slate-950 hover:bg-slate-800 text-slate-300 transition-colors"
          aria-label="Previous day"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={onGoToToday}
          className={clsx(
            "px-3 py-2 rounded-md border border-slate-600 text-sm transition-colors",
            isToday
              ? "bg-indigo-600 text-white border-indigo-500"
              : "bg-slate-950 hover:bg-slate-800 text-slate-300"
          )}
        >
          Today
        </button>
        <button
          onClick={() => onNavigateDay("next")}
          className="p-2 rounded-md border border-slate-600 bg-slate-950 hover:bg-slate-800 text-slate-300 transition-colors"
          aria-label="Next day"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="text-sm font-medium text-slate-200 ml-2">
          {(() => {
            const day = parseInt(format(currentDate, "d"), 10);
            const suffix = getOrdinalSuffix(day);
            return `${format(currentDate, "EEEE")} ${day}${suffix} ${format(currentDate, "MMMM yyyy")}`;
          })()}
        </div>
        {onDateChange && (
          <input
            type="date"
            value={dateStr}
            onChange={handleDateChange}
            className="ml-2 px-2 py-1 rounded-md border border-slate-600 bg-slate-950 text-slate-100 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
            aria-label="Select date"
          />
        )}
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-slate-300">Side:</label>
        <div className={clsx(
          "flex rounded-md border overflow-hidden",
          lockedSide ? "border-slate-700 bg-slate-900" : "border-slate-600 bg-slate-950"
        )}>
          <button
            type="button"
            onClick={() => onSideChange("Power")}
            disabled={!!lockedSide}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium transition",
              selectedSide === "Power"
                ? "bg-indigo-600 text-white"
                : "text-slate-300 hover:bg-slate-800",
              lockedSide && "cursor-not-allowed opacity-60"
            )}
            title={lockedSide ? `Side is locked to ${lockedSide} for this booking` : undefined}
          >
            Power
          </button>
          <button
            type="button"
            onClick={() => onSideChange("Base")}
            disabled={!!lockedSide}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium transition",
              selectedSide === "Base"
                ? "bg-indigo-600 text-white"
                : "text-slate-300 hover:bg-slate-800",
              lockedSide && "cursor-not-allowed opacity-60"
            )}
            title={lockedSide ? `Side is locked to ${lockedSide} for this booking` : undefined}
          >
            Base
          </button>
        </div>
      </div>
    </div>
  );
}

