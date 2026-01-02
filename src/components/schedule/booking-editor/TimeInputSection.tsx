import { TimePicker } from "../../shared/TimePicker";
import type { ClosedPeriod } from "../../admin/capacity/useClosedTimes";

type TimeInputSectionProps = {
  startTime: string;
  endTime: string;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  disabled?: boolean;
  closedTimes?: Set<string>; // Set of closed times in "HH:00" format
  closedPeriods?: ClosedPeriod[]; // Array of closed periods for minute-level checking
  disableAutoAdjust?: boolean; // If true, don't auto-adjust times (useful when editing existing bookings)
};

/**
 * Time input section for booking editor
 */
export function TimeInputSection({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  disabled = false,
  closedTimes = new Set(),
  closedPeriods = [],
  disableAutoAdjust = true, // Default to true for editing existing bookings
}: TimeInputSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Start Time
        </label>
        <TimePicker
          value={startTime}
          onChange={onStartTimeChange}
          disabled={disabled}
          closedTimes={closedTimes}
          closedPeriods={closedPeriods}
          disableAutoAdjust={disableAutoAdjust}
          isEndTime={false}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          End Time
        </label>
        <TimePicker
          value={endTime}
          onChange={onEndTimeChange}
          disabled={disabled}
          closedTimes={closedTimes}
          closedPeriods={closedPeriods}
          disableAutoAdjust={disableAutoAdjust}
          isEndTime={true}
        />
      </div>
    </div>
  );
}

