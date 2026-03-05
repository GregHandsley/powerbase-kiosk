import type { BookingFormValues } from '../../../schemas/bookingForm';

/** Round time string to nearest 15-minute interval (same as useTimeDefaults) */
export function roundTo15Minutes(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const totalMinutes = (hours ?? 0) * 60 + (minutes ?? 0);
  const rounded = Math.round(totalMinutes / 15) * 15;
  const h = Math.floor(rounded / 60) % 24;
  const m = rounded % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** True if the union of all platform and area slot times does not fully cover the booking window */
export function someSlotsDontFillWindow(values: BookingFormValues): boolean {
  const windowStartStr = values.startTime ?? '07:00';
  const windowEndStr = values.endTime ?? '08:30';
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const windowStart = toMin(windowStartStr);
  const windowEnd = toMin(windowEndStr);

  const intervals: Array<{ start: number; end: number }> = [];
  for (const slot of values.platformSlots ?? []) {
    intervals.push({ start: toMin(slot.start), end: toMin(slot.end) });
  }
  for (const slot of values.areaSlots ?? []) {
    intervals.push({ start: toMin(slot.start), end: toMin(slot.end) });
  }
  if (intervals.length === 0) return false;

  intervals.sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [intervals[0]!];
  for (let i = 1; i < intervals.length; i++) {
    const cur = intervals[i]!;
    const last = merged[merged.length - 1]!;
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push(cur);
    }
  }

  const fullCoverage = merged.some(
    (iv) => iv.start <= windowStart && iv.end >= windowEnd
  );
  return !fullCoverage;
}

/** Format rack numbers into condensed ranges (e.g. [1, 6, 19,20,21,22,23,24] → "1, 6, 19–24") */
export function formatRackRanges(racks: number[]): string {
  if (racks.length === 0) return '';
  const sorted = [...racks].sort((a, b) => a - b);
  const parts: string[] = [];
  let runStart = sorted[0]!;
  let runEnd = sorted[0]!;
  for (let i = 1; i <= sorted.length; i++) {
    const n = i < sorted.length ? sorted[i]! : null;
    if (n !== null && n === runEnd + 1) {
      runEnd = n;
    } else {
      if (runStart === runEnd) parts.push(String(runStart));
      else parts.push(`${runStart}–${runEnd}`);
      if (n !== null) {
        runStart = n;
        runEnd = n;
      }
    }
  }
  return parts.join(', ');
}
