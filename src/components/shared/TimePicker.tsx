import clsx from "clsx";
import { useEffect } from "react";

import type { ClosedPeriod } from "../admin/capacity/useClosedTimes";

type TimePickerProps = {
  value: string; // HH:MM format
  onChange: (time: string) => void;
  disabled?: boolean;
  className?: string;
  error?: boolean;
  closedTimes?: Set<string>; // Set of closed times in "HH:00" format
  closedPeriods?: ClosedPeriod[]; // Array of closed periods for minute-level checking
  disableAutoAdjust?: boolean; // If true, don't auto-adjust the time (useful when editing existing bookings)
  isEndTime?: boolean; // If true, allow times that are the start of a closed period (for end times)
};

/**
 * Simple, clean time picker with hour and minute dropdowns
 */
export function TimePicker({
  value,
  onChange,
  disabled = false,
  className,
  error = false,
  closedTimes = new Set(),
  closedPeriods = [],
  disableAutoAdjust = false,
  isEndTime = false,
}: TimePickerProps) {
  const [hour, minute] = value.split(":").map(Number);

  const formatTime = (h: number, m: number) => {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // Helper to check if a specific time is closed
  // For end times, allow times that are exactly the start of a closed period
  // (because a booking can end exactly when the gym closes)
  const isTimeClosed = (timeStr: string): boolean => {
    if (closedPeriods.length > 0) {
      const [timeHour, timeMinute] = timeStr.split(":").map(Number);
      const timeMinutes = timeHour * 60 + timeMinute;

      for (const period of closedPeriods) {
        const [startHour, startMinute] = period.startTime.split(":").map(Number);
        const [endHour, endMinute] = period.endTime.split(":").map(Number);
        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        // For end times, allow times that are exactly the start of a closed period
        if (isEndTime && timeMinutes === startMinutes) {
          return false; // Allow this time as an end time
        }

        // Check if time falls within the closed period [startMinutes, endMinutes)
        if (timeMinutes >= startMinutes && timeMinutes < endMinutes) {
          return true;
        }
      }
      return false;
    }

    // Fallback to hour-level checking
    const hourTimeStr = `${String(parseInt(timeStr.split(":")[0], 10)).padStart(2, "0")}:00`;
    return closedTimes.has(hourTimeStr);
  };

  // Filter hours - show hours that have at least one available minute
  // When disableAutoAdjust is true, also include the current hour (for editing existing bookings)
  const availableHours = Array.from({ length: 24 }, (_, i) => i).filter((h) => {
    // Always include the current hour when editing (disableAutoAdjust)
    if (disableAutoAdjust && h === hour) return true;
    // Check if any 15-minute interval (:00, :15, :30, :45) is available for this hour
    const time00 = formatTime(h, 0);
    const time15 = formatTime(h, 15);
    const time30 = formatTime(h, 30);
    const time45 = formatTime(h, 45);
    return !isTimeClosed(time00) || !isTimeClosed(time15) || !isTimeClosed(time30) || !isTimeClosed(time45);
  });

  // Filter minutes for the current hour - check each minute individually
  // When disableAutoAdjust is true, also include the current minute (for editing existing bookings)
  // Allow 15-minute intervals: 0, 15, 30, 45
  const availableMinutes = [0, 15, 30, 45].filter((m) => {
    // Always include the current minute when editing (disableAutoAdjust)
    if (disableAutoAdjust && m === minute) return true;
    const timeStr = formatTime(hour, m);
    return !isTimeClosed(timeStr);
  });

  // Ensure the current minute is valid for the current hour
  const validMinute = availableMinutes.includes(minute) 
    ? minute 
    : (availableMinutes.length > 0 ? availableMinutes[0] : minute);

  // Auto-adjust if current time is invalid (only if auto-adjust is enabled)
  useEffect(() => {
    if (disableAutoAdjust) return; // Don't auto-adjust when editing existing bookings
    
    const currentTime = formatTime(hour, minute);
    if (isTimeClosed(currentTime) || !availableMinutes.includes(minute)) {
      // Current time is closed or minute is not available, find first available time
      if (availableHours.length > 0) {
        // First try to find an available minute in the current hour
        if (availableMinutes.length > 0) {
          onChange(formatTime(hour, availableMinutes[0]));
          return;
        }
        // If no minutes available in current hour, move to next available hour
        const currentHourIndex = availableHours.indexOf(hour);
        if (currentHourIndex >= 0 && currentHourIndex < availableHours.length - 1) {
          const nextHour = availableHours[currentHourIndex + 1];
          const minutesForNextHour = [0, 15, 30, 45].filter((m) => {
            const timeStr = formatTime(nextHour, m);
            return !isTimeClosed(timeStr);
          });
          if (minutesForNextHour.length > 0) {
            onChange(formatTime(nextHour, minutesForNextHour[0]));
            return;
          }
        }
        // Fallback to first available hour
        const firstHour = availableHours[0];
        const minutesForFirstHour = [0, 15, 30, 45].filter((m) => {
          const timeStr = formatTime(firstHour, m);
          return !isTimeClosed(timeStr);
        });
        if (minutesForFirstHour.length > 0) {
          onChange(formatTime(firstHour, minutesForFirstHour[0]));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hour, minute, availableHours, availableMinutes, closedPeriods, disableAutoAdjust]);

  return (
    <div className={clsx("inline-flex items-center gap-1", className)} style={{ minWidth: 0 }}>
      <select
        value={hour}
        onChange={(e) => {
          const newHour = parseInt(e.target.value, 10);
          // When hour changes, find first available minute for that hour
          const minutesForNewHour = [0, 15, 30, 45].filter((m) => {
            const timeStr = formatTime(newHour, m);
            return !isTimeClosed(timeStr);
          });
          const firstAvailableMinute = minutesForNewHour.length > 0 ? minutesForNewHour[0] : 0;
          onChange(formatTime(newHour, firstAvailableMinute));
        }}
        disabled={disabled || availableHours.length === 0}
        style={{ width: '45px', minWidth: '45px', maxWidth: '45px' }}
        className={clsx(
          "px-1 py-1 rounded border text-xs font-medium outline-none transition-colors",
          "flex-shrink-0",
          error
            ? "border-red-500 bg-red-950/20 text-red-300"
            : "border-slate-600 bg-slate-950 text-slate-100 hover:border-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {availableHours.length > 0 ? (
          availableHours.map((h) => (
            <option key={h} value={h} className="bg-slate-950">
              {String(h).padStart(2, "0")}
            </option>
          ))
        ) : (
          <option value={0} className="bg-slate-950">00</option>
        )}
      </select>
      <span className={clsx("text-xs flex-shrink-0", error ? "text-red-300" : "text-slate-400")}>:</span>
      <select
        value={validMinute}
        onChange={(e) => {
          const newMinute = parseInt(e.target.value, 10);
          onChange(formatTime(hour, newMinute));
        }}
        disabled={disabled || availableMinutes.length === 0}
        style={{ width: '45px', minWidth: '45px', maxWidth: '45px' }}
        className={clsx(
          "px-1 py-1 rounded border text-xs font-medium outline-none transition-colors",
          "flex-shrink-0",
          error
            ? "border-red-500 bg-red-950/20 text-red-300"
            : "border-slate-600 bg-slate-950 text-slate-100 hover:border-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {availableMinutes.length > 0 ? (
          availableMinutes.map((m) => (
            <option key={m} value={m} className="bg-slate-950">
              {String(m).padStart(2, "0")}
            </option>
          ))
        ) : (
          <option value={0} className="bg-slate-950">00</option>
        )}
      </select>
    </div>
  );
}

