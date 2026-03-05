/**
 * Right-column "This booking includes" panel for the create booking flow.
 * Shows platforms (from week selection) and area slots; user can edit slot times and remove items.
 */

import type { AreaSlotInput } from '../../../nodes/data/areaSlotsNodes';
import {
  getRackOrPlatformLabel,
  isOpenPlatform,
} from '../../schedule/utils/platformUtils';

type AreaOption = { id: number; side_id: number; key: string; name: string };

type WeekManagement = {
  racksByWeek: Map<number, number[]>;
  weeksCount: number;
  applyToAllWeeks: boolean;
  currentWeekIndex: number;
  handlePlatformSelectionChange: (selected: number[]) => void;
};

type PlatformSlot = { rackNumber: number; start: string; end: string };

type Props = {
  sideKey: 'Power' | 'Base';
  windowStartTime: string;
  windowEndTime: string;
  areaSlots: AreaSlotInput[];
  onChangeAreaSlots: (slots: AreaSlotInput[]) => void;
  platformSlots: PlatformSlot[];
  onChangePlatformSlots: (slots: PlatformSlot[]) => void;
  weekManagement: WeekManagement;
  areas: AreaOption[];
  /** Rack numbers that are partially available (some free time in the window). Used to segregate builder UI. */
  partiallyAvailableRackNumbers?: Set<number>;
  /** Free time intervals per rack (HH:mm). Used to restrict Start/End options for partially available slots. */
  freeIntervalsByRack?: Map<number, Array<{ start: string; end: string }>>;
  /** Free time intervals per area key (HH:mm). Used to restrict Start/End options for partially available area slots. */
  freeIntervalsByArea?: Map<string, Array<{ start: string; end: string }>>;
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesToTime(totalMin: number): string {
  const h = Math.floor(Math.max(0, Math.min(24 * 60 - 1, totalMin)) / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Snap time to nearest 15-minute segment (:00, :15, :30, :45). */
function snapTo15Min(time: string): string {
  const totalMin = timeToMinutes(time);
  const snapped = Math.round(totalMin / 15) * 15;
  return minutesToTime(snapped);
}

/** Clamp time to window and snap to 15 min. */
function clampToWindow(
  time: string,
  windowStartMin: number,
  windowEndMin: number
): string {
  const totalMin = timeToMinutes(time);
  const snapped = Math.round(totalMin / 15) * 15;
  const clamped = Math.max(windowStartMin, Math.min(windowEndMin, snapped));
  return minutesToTime(clamped);
}

/** Clamp end time to (startMin, windowEndMin] and snap to 15 min. */
function clampEndToWindow(
  time: string,
  startMin: number,
  windowEndMin: number
): string {
  const totalMin = timeToMinutes(time);
  const snapped = Math.round(totalMin / 15) * 15;
  const minEnd = startMin + 15;
  const clamped = Math.max(minEnd, Math.min(windowEndMin, snapped));
  return minutesToTime(clamped);
}

function isValidTime(t: string): boolean {
  return /^\d{2}:\d{2}$/.test(t);
}

/** Generate time options at 15-min intervals from startMin (inclusive) to endMin (inclusive). */
function timeOptions15Min(startMin: number, endMin: number): string[] {
  const options: string[] = [];
  const snappedStart = Math.ceil(startMin / 15) * 15;
  for (let m = snappedStart; m <= endMin; m += 15) {
    options.push(minutesToTime(m));
  }
  return options.length > 0 ? options : [minutesToTime(startMin)];
}

/** Merge overlapping intervals (each [startMin, endMin]). Returns sorted, merged list. */
function mergeIntervals(
  intervals: Array<{ start: number; end: number }>
): Array<{ start: number; end: number }> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = merged[merged.length - 1]!;
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push(cur);
    }
  }
  return merged;
}

/** Time options that fall inside the given merged intervals (15-min ticks). */
function timeOptionsInIntervals(
  merged: Array<{ start: number; end: number }>
): string[] {
  const set = new Set<number>();
  for (const { start, end } of merged) {
    const snappedStart = Math.ceil(start / 15) * 15;
    for (let m = snappedStart; m < end; m += 15) {
      set.add(m);
    }
  }
  return Array.from(set)
    .sort((a, b) => a - b)
    .map(minutesToTime);
}

/** Time options for End that are > afterMin and inside the given intervals. */
function timeOptionsInIntervalsForEnd(
  merged: Array<{ start: number; end: number }>,
  afterMin: number
): string[] {
  const minStart = afterMin + 15;
  const set = new Set<number>();
  for (const { start, end } of merged) {
    const snappedStart = Math.max(minStart, Math.ceil(start / 15) * 15);
    for (let m = snappedStart; m <= end; m += 15) {
      set.add(m);
    }
  }
  return Array.from(set)
    .sort((a, b) => a - b)
    .map(minutesToTime);
}

/** Format sorted rack numbers as compact ranges, e.g. "Racks 7 – 18" or "Rack 1, Racks 5 – 7". */
function formatRackRange(numbers: number[], side: 'power' | 'base'): string {
  if (numbers.length === 0) return '';
  if (numbers.length === 1) return getRackOrPlatformLabel(side, numbers[0]!);
  const runs: { start: number; end: number }[] = [];
  let start = numbers[0]!;
  let end = numbers[0]!;
  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] === end + 1) {
      end = numbers[i]!;
    } else {
      runs.push({ start, end });
      start = numbers[i]!;
      end = numbers[i]!;
    }
  }
  runs.push({ start, end });
  const parts = runs.map((r) =>
    r.start === r.end
      ? getRackOrPlatformLabel(side, r.start)
      : `Racks ${r.start} – ${r.end}`
  );
  return parts.length === 1 ? parts[0]! : parts.join(', ');
}

export function BookingBuilderPanel({
  sideKey,
  windowStartTime,
  windowEndTime,
  areaSlots,
  onChangeAreaSlots,
  platformSlots,
  onChangePlatformSlots,
  weekManagement,
  areas,
  partiallyAvailableRackNumbers = new Set(),
  freeIntervalsByRack,
  freeIntervalsByArea,
}: Props) {
  const {
    racksByWeek,
    weeksCount,
    // applyToAllWeeks,
    // currentWeekIndex,
    handlePlatformSelectionChange,
  } = weekManagement;

  const windowStartMin = timeToMinutes(windowStartTime);
  const windowEndMin = timeToMinutes(windowEndTime);
  const side = sideKey.toLowerCase() as 'power' | 'base';

  // All selected rack numbers across weeks (unique, sorted) for display
  const allSelectedRacks = (() => {
    const set = new Set<number>();
    for (let i = 0; i < weeksCount; i++) {
      (racksByWeek.get(i) ?? []).forEach((r) => set.add(r));
    }
    return Array.from(set).sort((a, b) => a - b);
  })();

  // // Power: split into open platforms (19, 20) vs racks. Base: all are racks.
  // const selectedPlatforms = allSelectedRacks.filter((n) =>
  //   isOpenPlatform(side, n)
  // );
  // const selectedRacks = allSelectedRacks.filter(
  //   (n) => !isOpenPlatform(side, n)
  // );

  // Segregate platform slots by partial availability for separate time control
  const fullyAvailableSlots = platformSlots.filter(
    (p) => !partiallyAvailableRackNumbers.has(p.rackNumber)
  );
  const partiallyAvailableSlots = platformSlots.filter((p) =>
    partiallyAvailableRackNumbers.has(p.rackNumber)
  );
  const fullyAvailablePlatforms = fullyAvailableSlots.filter((p) =>
    isOpenPlatform(side, p.rackNumber)
  );
  const fullyAvailableRacks = fullyAvailableSlots.filter(
    (p) => !isOpenPlatform(side, p.rackNumber)
  );
  const partiallyAvailablePlatforms = partiallyAvailableSlots.filter((p) =>
    isOpenPlatform(side, p.rackNumber)
  );
  const partiallyAvailableRacksList = partiallyAvailableSlots.filter(
    (p) => !isOpenPlatform(side, p.rackNumber)
  );

  /** Update time only for fully available open platform slots */
  const updateFullyAvailablePlatformsTime = (patch: {
    start?: string;
    end?: string;
  }) => {
    if (patch.start === undefined && patch.end === undefined) return;
    const rackSet = new Set(fullyAvailablePlatforms.map((p) => p.rackNumber));
    const next = platformSlots.map((p) => {
      if (!isOpenPlatform(side, p.rackNumber) || !rackSet.has(p.rackNumber))
        return p;
      let start = patch.start !== undefined ? patch.start : p.start;
      let end = patch.end !== undefined ? patch.end : p.end;
      start = clampToWindow(snapTo15Min(start), windowStartMin, windowEndMin);
      const startMin = timeToMinutes(start);
      end = clampEndToWindow(snapTo15Min(end), startMin, windowEndMin);
      return { ...p, start, end };
    });
    onChangePlatformSlots(next);
  };

  /** Update time only for fully available rack slots */
  const updateFullyAvailableRacksTime = (patch: {
    start?: string;
    end?: string;
  }) => {
    if (patch.start === undefined && patch.end === undefined) return;
    const rackSet = new Set(fullyAvailableRacks.map((p) => p.rackNumber));
    const next = platformSlots.map((p) => {
      if (isOpenPlatform(side, p.rackNumber) || !rackSet.has(p.rackNumber))
        return p;
      let start = patch.start !== undefined ? patch.start : p.start;
      let end = patch.end !== undefined ? patch.end : p.end;
      start = clampToWindow(snapTo15Min(start), windowStartMin, windowEndMin);
      const startMin = timeToMinutes(start);
      end = clampEndToWindow(snapTo15Min(end), startMin, windowEndMin);
      return { ...p, start, end };
    });
    onChangePlatformSlots(next);
  };

  /** Update time only for partially available open platform slots */
  const updatePartiallyAvailablePlatformsTime = (patch: {
    start?: string;
    end?: string;
  }) => {
    if (patch.start === undefined && patch.end === undefined) return;
    const rackSet = new Set(
      partiallyAvailablePlatforms.map((p) => p.rackNumber)
    );
    const next = platformSlots.map((p) => {
      if (!isOpenPlatform(side, p.rackNumber) || !rackSet.has(p.rackNumber))
        return p;
      let start = patch.start !== undefined ? patch.start : p.start;
      let end = patch.end !== undefined ? patch.end : p.end;
      start = clampToWindow(snapTo15Min(start), windowStartMin, windowEndMin);
      const startMin = timeToMinutes(start);
      end = clampEndToWindow(snapTo15Min(end), startMin, windowEndMin);
      return { ...p, start, end };
    });
    onChangePlatformSlots(next);
  };

  /** Update time only for partially available rack slots */
  const updatePartiallyAvailableRacksTime = (patch: {
    start?: string;
    end?: string;
  }) => {
    if (patch.start === undefined && patch.end === undefined) return;
    const rackSet = new Set(
      partiallyAvailableRacksList.map((p) => p.rackNumber)
    );
    const next = platformSlots.map((p) => {
      if (isOpenPlatform(side, p.rackNumber) || !rackSet.has(p.rackNumber))
        return p;
      let start = patch.start !== undefined ? patch.start : p.start;
      let end = patch.end !== undefined ? patch.end : p.end;
      start = clampToWindow(snapTo15Min(start), windowStartMin, windowEndMin);
      const startMin = timeToMinutes(start);
      end = clampEndToWindow(snapTo15Min(end), startMin, windowEndMin);
      return { ...p, start, end };
    });
    onChangePlatformSlots(next);
  };

  const removeFullyAvailablePlatforms = () => {
    const toRemove = new Set(fullyAvailablePlatforms.map((p) => p.rackNumber));
    handlePlatformSelectionChange(
      allSelectedRacks.filter((r) => !toRemove.has(r))
    );
    onChangePlatformSlots(
      platformSlots.filter((p) => !toRemove.has(p.rackNumber))
    );
  };

  const removeFullyAvailableRacks = () => {
    const toRemove = new Set(fullyAvailableRacks.map((p) => p.rackNumber));
    handlePlatformSelectionChange(
      allSelectedRacks.filter((r) => !toRemove.has(r))
    );
    onChangePlatformSlots(
      platformSlots.filter((p) => !toRemove.has(p.rackNumber))
    );
  };

  const removePartiallyAvailablePlatforms = () => {
    const toRemove = new Set(
      partiallyAvailablePlatforms.map((p) => p.rackNumber)
    );
    handlePlatformSelectionChange(
      allSelectedRacks.filter((r) => !toRemove.has(r))
    );
    onChangePlatformSlots(
      platformSlots.filter((p) => !toRemove.has(p.rackNumber))
    );
  };

  const removePartiallyAvailableRacks = () => {
    const toRemove = new Set(
      partiallyAvailableRacksList.map((p) => p.rackNumber)
    );
    handlePlatformSelectionChange(
      allSelectedRacks.filter((r) => !toRemove.has(r))
    );
    onChangePlatformSlots(
      platformSlots.filter((p) => !toRemove.has(p.rackNumber))
    );
  };

  const updateSlot = (index: number, patch: Partial<AreaSlotInput>) => {
    const next = [...areaSlots];
    next[index] = { ...next[index]!, ...patch };
    onChangeAreaSlots(next);
  };

  const removeSlot = (index: number) => {
    onChangeAreaSlots(areaSlots.filter((_, i) => i !== index));
  };

  const getAreaName = (areaKey: string) =>
    areas.find((a) => a.key === areaKey)?.name ?? areaKey;

  const hasAnyAllocation = allSelectedRacks.length > 0 || areaSlots.length > 0;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 flex flex-col min-h-0 flex-1">
      <h3 className="text-sm font-semibold text-slate-200 mb-1">
        This booking includes
      </h3>
      <p className="text-xs text-slate-400 mb-3">
        Add areas or platforms on the left. Edit times or remove items below.
      </p>

      <div className="space-y-3 flex-1 min-h-0 overflow-y-auto">
        {/* Fully available platforms & racks */}
        {fullyAvailableSlots.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 mb-2">
              Fully available
            </h4>
            <div className="space-y-2">
              {fullyAvailablePlatforms.length > 0 &&
                (() => {
                  const first = fullyAvailablePlatforms[0]!;
                  const rawStart = first.start ?? windowStartTime;
                  const rawEnd = first.end ?? windowEndTime;
                  const start = clampToWindow(
                    snapTo15Min(rawStart),
                    windowStartMin,
                    windowEndMin
                  );
                  const end = clampEndToWindow(
                    snapTo15Min(rawEnd),
                    timeToMinutes(start),
                    windowEndMin
                  );
                  const startMin = timeToMinutes(start);
                  const endMin = timeToMinutes(end);
                  const startValid =
                    isValidTime(start) &&
                    startMin >= windowStartMin &&
                    startMin <= windowEndMin;
                  const endValid =
                    isValidTime(end) &&
                    endMin > startMin &&
                    endMin <= windowEndMin;
                  const labels = fullyAvailablePlatforms.map((p) =>
                    getRackOrPlatformLabel(side, p.rackNumber)
                  );
                  return (
                    <div className="rounded-md border border-slate-600 bg-slate-900/80 p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm text-slate-200">
                          {labels.length === 1 ? labels[0] : labels.join(' & ')}
                        </span>
                        <button
                          type="button"
                          onClick={removeFullyAvailablePlatforms}
                          className="text-slate-400 hover:text-red-400 text-xs shrink-0"
                        >
                          Remove all
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-slate-500">
                            Start
                          </label>
                          <select
                            value={start}
                            onChange={(e) =>
                              updateFullyAvailablePlatformsTime({
                                start: e.target.value,
                              })
                            }
                            className={[
                              'rounded border bg-slate-950 px-2 py-1 text-xs text-slate-100',
                              !startValid
                                ? 'border-amber-500'
                                : 'border-slate-600',
                            ].join(' ')}
                          >
                            {timeOptions15Min(windowStartMin, windowEndMin).map(
                              (opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-slate-500">
                            End
                          </label>
                          <select
                            value={end}
                            onChange={(e) =>
                              updateFullyAvailablePlatformsTime({
                                end: e.target.value,
                              })
                            }
                            className={[
                              'rounded border bg-slate-950 px-2 py-1 text-xs text-slate-100',
                              !endValid
                                ? 'border-amber-500'
                                : 'border-slate-600',
                            ].join(' ')}
                          >
                            {timeOptions15Min(
                              timeToMinutes(start) + 15,
                              windowEndMin
                            ).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {(!startValid || !endValid) && (
                        <p className="text-[10px] text-amber-400">
                          Times must be within {windowStartTime}–{windowEndTime}{' '}
                          in 15‑minute segments
                        </p>
                      )}
                    </div>
                  );
                })()}
              {fullyAvailableRacks.length > 0 &&
                (() => {
                  const first = fullyAvailableRacks[0]!;
                  const rawStart = first.start ?? windowStartTime;
                  const rawEnd = first.end ?? windowEndTime;
                  const start = clampToWindow(
                    snapTo15Min(rawStart),
                    windowStartMin,
                    windowEndMin
                  );
                  const end = clampEndToWindow(
                    snapTo15Min(rawEnd),
                    timeToMinutes(start),
                    windowEndMin
                  );
                  const startMin = timeToMinutes(start);
                  const endMin = timeToMinutes(end);
                  const startValid =
                    isValidTime(start) &&
                    startMin >= windowStartMin &&
                    startMin <= windowEndMin;
                  const endValid =
                    isValidTime(end) &&
                    endMin > startMin &&
                    endMin <= windowEndMin;
                  const rackNumbers = fullyAvailableRacks
                    .map((p) => p.rackNumber)
                    .sort((a, b) => a - b);
                  return (
                    <div className="rounded-md border border-slate-600 bg-slate-900/80 p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm text-slate-200">
                          {formatRackRange(rackNumbers, side)}
                        </span>
                        <button
                          type="button"
                          onClick={removeFullyAvailableRacks}
                          className="text-slate-400 hover:text-red-400 text-xs shrink-0"
                        >
                          Remove all
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-slate-500">
                            Start
                          </label>
                          <select
                            value={start}
                            onChange={(e) =>
                              updateFullyAvailableRacksTime({
                                start: e.target.value,
                              })
                            }
                            className={[
                              'rounded border bg-slate-950 px-2 py-1 text-xs text-slate-100',
                              !startValid
                                ? 'border-amber-500'
                                : 'border-slate-600',
                            ].join(' ')}
                          >
                            {timeOptions15Min(windowStartMin, windowEndMin).map(
                              (opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              )
                            )}
                          </select>
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-slate-500">
                            End
                          </label>
                          <select
                            value={end}
                            onChange={(e) =>
                              updateFullyAvailableRacksTime({
                                end: e.target.value,
                              })
                            }
                            className={[
                              'rounded border bg-slate-950 px-2 py-1 text-xs text-slate-100',
                              !endValid
                                ? 'border-amber-500'
                                : 'border-slate-600',
                            ].join(' ')}
                          >
                            {timeOptions15Min(
                              timeToMinutes(start) + 15,
                              windowEndMin
                            ).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {(!startValid || !endValid) && (
                        <p className="text-[10px] text-amber-400">
                          Times must be within {windowStartTime}–{windowEndTime}{' '}
                          in 15‑minute segments
                        </p>
                      )}
                    </div>
                  );
                })()}
            </div>
          </div>
        )}

        {/* Partially available platforms & racks */}
        {partiallyAvailableSlots.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 mb-2">
              Partially available
            </h4>
            <div className="space-y-2">
              {partiallyAvailablePlatforms.length > 0 &&
                (() => {
                  const first = partiallyAvailablePlatforms[0]!;
                  const rackNumbers = partiallyAvailablePlatforms.map(
                    (p) => p.rackNumber
                  );
                  const intervals =
                    freeIntervalsByRack &&
                    Array.from(rackNumbers).flatMap((r) =>
                      (freeIntervalsByRack.get(r) ?? []).map((i) => ({
                        start: timeToMinutes(i.start),
                        end: timeToMinutes(i.end),
                      }))
                    );
                  const merged = intervals?.length
                    ? mergeIntervals(intervals)
                    : [];
                  const startOptions =
                    merged.length > 0
                      ? timeOptionsInIntervals(merged)
                      : timeOptions15Min(windowStartMin, windowEndMin);
                  const rawStart = first.start ?? windowStartTime;
                  const rawEnd = first.end ?? windowEndTime;
                  const start = clampToWindow(
                    snapTo15Min(rawStart),
                    windowStartMin,
                    windowEndMin
                  );
                  const end = clampEndToWindow(
                    snapTo15Min(rawEnd),
                    timeToMinutes(start),
                    windowEndMin
                  );
                  const startMin = timeToMinutes(start);
                  const endMin = timeToMinutes(end);
                  const endOptions =
                    merged.length > 0
                      ? timeOptionsInIntervalsForEnd(merged, startMin)
                      : timeOptions15Min(startMin + 15, windowEndMin);
                  const inInterval = (m: number) =>
                    merged.some((iv) => m >= iv.start && m < iv.end);
                  const endInOrAtInterval = (m: number) =>
                    merged.some((iv) => m > iv.start && m <= iv.end);
                  const startValid =
                    isValidTime(start) &&
                    (merged.length === 0 || inInterval(startMin));
                  const endValid =
                    isValidTime(end) &&
                    endMin > startMin &&
                    (merged.length === 0 || endInOrAtInterval(endMin));
                  const labels = partiallyAvailablePlatforms.map((p) =>
                    getRackOrPlatformLabel(side, p.rackNumber)
                  );
                  return (
                    <div className="rounded-md border border-amber-700/60 bg-slate-900/80 p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm text-slate-200">
                          {labels.length === 1 ? labels[0] : labels.join(' & ')}
                        </span>
                        <button
                          type="button"
                          onClick={removePartiallyAvailablePlatforms}
                          className="text-slate-400 hover:text-red-400 text-xs shrink-0"
                        >
                          Remove all
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-slate-500">
                            Start
                          </label>
                          <select
                            value={start}
                            onChange={(e) =>
                              updatePartiallyAvailablePlatformsTime({
                                start: e.target.value,
                              })
                            }
                            className={[
                              'rounded border bg-slate-950 px-2 py-1 text-xs text-slate-100',
                              !startValid
                                ? 'border-amber-500'
                                : 'border-slate-600',
                            ].join(' ')}
                          >
                            {startOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-slate-500">
                            End
                          </label>
                          <select
                            value={end}
                            onChange={(e) =>
                              updatePartiallyAvailablePlatformsTime({
                                end: e.target.value,
                              })
                            }
                            className={[
                              'rounded border bg-slate-950 px-2 py-1 text-xs text-slate-100',
                              !endValid
                                ? 'border-amber-500'
                                : 'border-slate-600',
                            ].join(' ')}
                          >
                            {endOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              {partiallyAvailableRacksList.length > 0 &&
                (() => {
                  const first = partiallyAvailableRacksList[0]!;
                  const rackNumbers = partiallyAvailableRacksList
                    .map((p) => p.rackNumber)
                    .sort((a, b) => a - b);
                  const intervals =
                    freeIntervalsByRack &&
                    Array.from(rackNumbers).flatMap((r) =>
                      (freeIntervalsByRack.get(r) ?? []).map((i) => ({
                        start: timeToMinutes(i.start),
                        end: timeToMinutes(i.end),
                      }))
                    );
                  const merged = intervals?.length
                    ? mergeIntervals(intervals)
                    : [];
                  const startOptions =
                    merged.length > 0
                      ? timeOptionsInIntervals(merged)
                      : timeOptions15Min(windowStartMin, windowEndMin);
                  const rawStart = first.start ?? windowStartTime;
                  const rawEnd = first.end ?? windowEndTime;
                  const start = clampToWindow(
                    snapTo15Min(rawStart),
                    windowStartMin,
                    windowEndMin
                  );
                  const end = clampEndToWindow(
                    snapTo15Min(rawEnd),
                    timeToMinutes(start),
                    windowEndMin
                  );
                  const startMin = timeToMinutes(start);
                  const endMin = timeToMinutes(end);
                  const endOptions =
                    merged.length > 0
                      ? timeOptionsInIntervalsForEnd(merged, startMin)
                      : timeOptions15Min(startMin + 15, windowEndMin);
                  const inInterval = (m: number) =>
                    merged.some((iv) => m >= iv.start && m < iv.end);
                  const endInOrAtInterval = (m: number) =>
                    merged.some((iv) => m > iv.start && m <= iv.end);
                  const startValid =
                    isValidTime(start) &&
                    (merged.length === 0 || inInterval(startMin));
                  const endValid =
                    isValidTime(end) &&
                    endMin > startMin &&
                    (merged.length === 0 || endInOrAtInterval(endMin));
                  return (
                    <div className="rounded-md border border-amber-700/60 bg-slate-900/80 p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm text-slate-200">
                          {formatRackRange(rackNumbers, side)}
                        </span>
                        <button
                          type="button"
                          onClick={removePartiallyAvailableRacks}
                          className="text-slate-400 hover:text-red-400 text-xs shrink-0"
                        >
                          Remove all
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-slate-500">
                            Start
                          </label>
                          <select
                            value={start}
                            onChange={(e) =>
                              updatePartiallyAvailableRacksTime({
                                start: e.target.value,
                              })
                            }
                            className={[
                              'rounded border bg-slate-950 px-2 py-1 text-xs text-slate-100',
                              !startValid
                                ? 'border-amber-500'
                                : 'border-slate-600',
                            ].join(' ')}
                          >
                            {startOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-slate-500">
                            End
                          </label>
                          <select
                            value={end}
                            onChange={(e) =>
                              updatePartiallyAvailableRacksTime({
                                end: e.target.value,
                              })
                            }
                            className={[
                              'rounded border bg-slate-950 px-2 py-1 text-xs text-slate-100',
                              !endValid
                                ? 'border-amber-500'
                                : 'border-slate-600',
                            ].join(' ')}
                          >
                            {endOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
        )}

        {/* Area slots */}
        {areaSlots.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-slate-400 mb-2">Areas</h4>
            <ul className="space-y-2">
              {areaSlots.map((slot, index) => {
                const intervals = freeIntervalsByArea?.get(slot.area_key);
                const merged = intervals?.length
                  ? mergeIntervals(
                      intervals.map((i) => ({
                        start: timeToMinutes(i.start),
                        end: timeToMinutes(i.end),
                      }))
                    )
                  : [];
                const startOptions =
                  merged.length > 0
                    ? timeOptionsInIntervals(merged)
                    : timeOptions15Min(windowStartMin, windowEndMin);
                const rawStart = slot.start;
                const rawEnd = slot.end;
                const start = clampToWindow(
                  snapTo15Min(rawStart),
                  windowStartMin,
                  windowEndMin
                );
                const end = clampEndToWindow(
                  snapTo15Min(rawEnd),
                  timeToMinutes(start),
                  windowEndMin
                );
                const startMin = timeToMinutes(start);
                const endMin = timeToMinutes(end);
                const endOptions =
                  merged.length > 0
                    ? timeOptionsInIntervalsForEnd(merged, startMin)
                    : timeOptions15Min(startMin + 15, windowEndMin);
                const inInterval = (m: number) =>
                  merged.some((iv) => m >= iv.start && m < iv.end);
                const endInOrAtInterval = (m: number) =>
                  merged.some((iv) => m > iv.start && m <= iv.end);
                const startValid =
                  isValidTime(start) &&
                  (merged.length === 0 || inInterval(startMin));
                const endValid =
                  isValidTime(end) &&
                  endMin > startMin &&
                  (merged.length === 0 || endInOrAtInterval(endMin));
                return (
                  <li
                    key={index}
                    className={[
                      'rounded-md border bg-slate-900/80 p-2 space-y-2',
                      merged.length > 0
                        ? 'border-amber-700/60'
                        : 'border-slate-600',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-200">
                          {getAreaName(slot.area_key)}
                        </span>
                        {merged.length > 0 && (
                          <span className="text-[10px] text-slate-500">
                            Partially available
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSlot(index)}
                        className="text-slate-400 hover:text-red-400 text-xs"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-slate-500">
                          Start
                        </label>
                        <select
                          value={start}
                          onChange={(e) => {
                            const next = e.target.value;
                            const nextStartMin = timeToMinutes(next);
                            const validEnd = clampEndToWindow(
                              slot.end,
                              nextStartMin,
                              windowEndMin
                            );
                            updateSlot(index, {
                              start: next,
                              end: validEnd,
                            });
                          }}
                          className={[
                            'rounded border bg-slate-950 px-2 py-1 text-xs text-slate-100',
                            !startValid
                              ? 'border-amber-500'
                              : 'border-slate-600',
                          ].join(' ')}
                        >
                          {startOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-[10px] text-slate-500">
                          End
                        </label>
                        <select
                          value={end}
                          onChange={(e) => {
                            const next = clampEndToWindow(
                              e.target.value,
                              startMin,
                              windowEndMin
                            );
                            updateSlot(index, { end: next });
                          }}
                          className={[
                            'rounded border bg-slate-950 px-2 py-1 text-xs text-slate-100',
                            !endValid ? 'border-amber-500' : 'border-slate-600',
                          ].join(' ')}
                        >
                          {endOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {!hasAnyAllocation && (
          <p className="text-xs text-slate-500 italic py-2">
            No areas or platforms added yet. Click items on the left to build
            your booking.
          </p>
        )}
      </div>
    </div>
  );
}
