import { useState } from "react";
import { addDays, format, startOfWeek, eachDayOfInterval } from "date-fns";
import clsx from "clsx";

type TimeSlot = {
  hour: number;
  minute: number;
};

type DayCapacity = {
  day: string;
  date: Date;
  slots: Map<string, { capacity: number; periodType: string }>;
};

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const PERIOD_TYPES = ["High Hybrid", "Low Hybrid", "Performance", "General User"];

// Generate time slots from 00:00 to 23:00 (hourly)
const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  for (let hour = 0; hour < 24; hour++) {
    slots.push({ hour, minute: 0 });
  }
  return slots;
};

export function CapacityManagement() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedSide, setSelectedSide] = useState<"Power" | "Base">("Power");
  const timeSlots = generateTimeSlots();

  // Get the start of the current week (Monday)
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentWeek((prev) => addDays(prev, direction === "next" ? 7 : -7));
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek("prev")}
            className="p-2 rounded-md border border-slate-600 bg-slate-950 hover:bg-slate-800 text-slate-300 transition-colors"
            aria-label="Previous week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-2 rounded-md border border-slate-600 bg-slate-950 hover:bg-slate-800 text-slate-300 text-sm transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => navigateWeek("next")}
            className="p-2 rounded-md border border-slate-600 bg-slate-950 hover:bg-slate-800 text-slate-300 transition-colors"
            aria-label="Next week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <div className="text-sm font-medium text-slate-200 ml-2">
            {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-300">Side:</label>
          <div className="flex rounded-md border border-slate-600 bg-slate-950 overflow-hidden">
            <button
              type="button"
              onClick={() => setSelectedSide("Power")}
              className={clsx(
                "px-3 py-1.5 text-xs font-medium transition",
                selectedSide === "Power"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              )}
            >
              Power
            </button>
            <button
              type="button"
              onClick={() => setSelectedSide("Base")}
              className={clsx(
                "px-3 py-1.5 text-xs font-medium transition",
                selectedSide === "Base"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-300 hover:bg-slate-800"
              )}
            >
              Base
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 bg-slate-900 border border-slate-700 rounded-lg overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <div className="min-w-full">
            {/* Days Header - Sticky */}
            <div className="sticky top-0 z-20 grid grid-cols-[100px_repeat(7,1fr)] border-b border-slate-700 bg-slate-900">
              <div className="p-3 border-r border-slate-700 bg-slate-950/50"></div>
              {weekDays.map((day, index) => (
                <div
                  key={index}
                  className="p-3 border-r border-slate-700 last:border-r-0 bg-slate-950/50 text-center"
                >
                  <div className="text-sm font-medium text-slate-200">
                    {format(day, "EEE")}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {format(day, "M/d")}
                  </div>
                </div>
              ))}
            </div>

            {/* Time Slots */}
            {timeSlots.map((slot, slotIndex) => (
              <div
                key={slotIndex}
                className="grid grid-cols-[100px_repeat(7,1fr)] border-b border-slate-800 hover:bg-slate-800/30"
              >
                {/* Time Label - Sticky */}
                <div className="sticky left-0 z-10 p-3 border-r border-slate-700 bg-slate-950/95 text-xs text-slate-400 text-right font-mono whitespace-nowrap">
                  {String(slot.hour).padStart(2, "0")}:{String(slot.minute).padStart(2, "0")}
                </div>

                {/* Day Cells */}
                {weekDays.map((day, dayIndex) => (
                  <div
                    key={dayIndex}
                    className="p-3 border-r border-slate-800 last:border-r-0 min-h-[50px] cursor-pointer hover:bg-slate-800/50 transition-colors"
                    onClick={() => {
                      // TODO: Open capacity editor for this time slot
                      console.log(`Edit capacity for ${format(day, "EEE")} at ${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`);
                    }}
                  >
                    {/* Placeholder for capacity data */}
                    <div className="text-[10px] text-slate-500">
                      {/* Capacity will be displayed here */}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

