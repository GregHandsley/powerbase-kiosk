import { useMemo } from 'react';
import clsx from 'clsx';

type Props = {
  value: string; // HH:mm format
  onChange: (time: string) => void;
  closedTimes: Set<string>; // Set of closed time strings (HH:00 format)
  label?: string;
  disabled?: boolean;
  className?: string;
  minTime?: string; // Optional minimum time (HH:mm)
  maxTime?: string; // Optional maximum time (HH:mm)
};

/**
 * Custom time selector that filters out closed times
 * Shows available times in 15-minute intervals
 */
export function TimeSelector({
  value,
  onChange,
  closedTimes,
  label,
  disabled = false,
  className,
  minTime,
  maxTime,
}: Props) {
  // Generate time options in 15-minute intervals
  const timeOptions = useMemo(() => {
    const options: Array<{ time: string; label: string; isClosed: boolean }> =
      [];

    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const hourStr = `${String(hour).padStart(2, '0')}:00`;

        // Check if this time is closed (check by hour)
        const isClosed = closedTimes.has(hourStr);

        // Check if time is within min/max range
        if (minTime && timeStr < minTime) continue;
        if (maxTime && timeStr > maxTime) continue;

        // Format label
        const period = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const label = `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;

        options.push({
          time: timeStr,
          label,
          isClosed,
        });
      }
    }

    return options;
  }, [closedTimes, minTime, maxTime]);

  const hasClosedTimes = closedTimes.size > 0;
  const selectedOption = timeOptions.find((opt) => opt.time === value);
  const isSelectedClosed = selectedOption?.isClosed ?? false;

  return (
    <div className={clsx('space-y-1', className)}>
      {label && (
        <label className="block text-sm font-medium text-slate-300 mb-1">
          {label}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => {
          const selected = timeOptions.find(
            (opt) => opt.time === e.target.value
          );
          if (selected && !selected.isClosed) {
            onChange(e.target.value);
          }
        }}
        disabled={disabled}
        className={clsx(
          'w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-1',
          disabled
            ? 'border-slate-700 bg-slate-950/50 text-slate-500 cursor-not-allowed'
            : isSelectedClosed
              ? 'border-amber-600 bg-amber-950/20 text-amber-300 focus:ring-amber-500'
              : 'border-slate-600 bg-slate-950 text-slate-100 focus:ring-indigo-500'
        )}
      >
        {timeOptions.map((option) => (
          <option
            key={option.time}
            value={option.time}
            disabled={option.isClosed}
            className={
              option.isClosed
                ? 'text-slate-500 bg-slate-800 italic'
                : 'text-slate-100'
            }
          >
            {option.isClosed ? `${option.label} (Closed)` : option.label}
          </option>
        ))}
      </select>
      {isSelectedClosed && (
        <p className="text-xs text-amber-400">
          This time is closed according to the capacity schedule. Please select
          a different time.
        </p>
      )}
      {hasClosedTimes && !isSelectedClosed && (
        <p className="text-xs text-slate-400">
          Closed times are grayed out and cannot be selected
        </p>
      )}
    </div>
  );
}
