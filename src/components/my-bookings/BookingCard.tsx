import { useEffect, useRef, useState, useMemo } from 'react';
import { format, parseISO, isAfter } from 'date-fns';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { StatusBadge } from '../shared/StatusBadge';
import { formatDateBritish, formatDateBritishShort } from '../shared/dateUtils';
import {
  isBookingInPast,
  isPastBookingUnprocessed,
} from '../admin/booking/utils';
import { getRackOrPlatformLabel } from '../schedule/utils/platformUtils';
import { areaKeyToLabel } from '../schedule/utils/areaKeyUtils';
import { Modal } from '../shared/Modal';
import type { BookingStatus } from '../../types/db';
import type { BookingWithInstances } from '../../hooks/useMyBookings';

type Props = {
  booking: BookingWithInstances;
  onEdit?: (booking: BookingWithInstances) => void;
  onDelete?: (booking: BookingWithInstances) => void;
  onExtend?: (booking: BookingWithInstances) => void;
  onViewLifecycle?: (booking: BookingWithInstances) => void;
};

// function formatStatusLabel(status: string): string {
//   return status
//     .split('_')
//     .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
//     .join(' ');
// }

/** Format sorted rack numbers as compact ranges, e.g. "Racks 1 – 6". Same as BookingTeamCard. */
function formatRackRange(numbers: number[], side: 'power' | 'base'): string {
  if (numbers.length === 0) return '';
  const sorted = [...numbers].sort((a, b) => a - b);
  if (sorted.length === 1) return getRackOrPlatformLabel(side, sorted[0]!);
  const runs: { start: number; end: number }[] = [];
  let start = sorted[0]!;
  let end = sorted[0]!;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i]!;
    } else {
      runs.push({ start, end });
      start = sorted[i]!;
      end = sorted[i]!;
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

export function BookingCard({
  booking,
  onEdit,
  onDelete,
  onExtend,
  onViewLifecycle,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showWeeklyDetailModal, setShowWeeklyDetailModal] = useState(false);
  const [weeklyDetailWeekIndex, setWeeklyDetailWeekIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const firstInstance = booking.instances[0];
  const lastInstance = booking.instances[booking.instances.length - 1];
  const totalInstances = booking.instances.length;
  const isSingleBooking = totalInstances === 1;

  const firstDate = firstInstance ? parseISO(firstInstance.start) : null;
  // const lastDate = lastInstance ? parseISO(lastInstance.end) : null;

  const formatTimeRange = (startIso: string, endIso: string) =>
    `${format(parseISO(startIso), 'HH:mm')} – ${format(parseISO(endIso), 'HH:mm')}`;
  const masterSessionTime = firstInstance
    ? formatTimeRange(firstInstance.start, firstInstance.end)
    : 'N/A';

  // Next upcoming instance (or first if all past)
  const now = new Date();
  const nextInstance =
    booking.instances.find((inst) => isAfter(parseISO(inst.start), now)) ||
    firstInstance;
  const isNextInstanceFuture = nextInstance
    ? isAfter(parseISO(nextInstance.start), now)
    : false;

  // Unique racks and areas across instances
  const allRacks = useMemo(() => {
    const set = new Set<number>();
    booking.instances.forEach((inst) => inst.racks.forEach((r) => set.add(r)));
    return Array.from(set).sort((a, b) => a - b);
  }, [booking.instances]);
  const allAreaKeys = useMemo(() => {
    const set = new Set<string>();
    booking.instances.forEach((inst) => inst.areas.forEach((a) => set.add(a)));
    return Array.from(set).sort();
  }, [booking.instances]);

  const sideKey = (booking.side.key?.toLowerCase() ?? 'power') as
    | 'power'
    | 'base';

  // Per-slot times when area_slots available (first instance for summary)
  const rackSlotsWithTime = useMemo(() => {
    if (!firstInstance || allRacks.length === 0) return null;
    const slots = firstInstance.area_slots;
    if (!slots?.length) return null;
    const rackSlots = slots.filter((s) => s.area_key.startsWith('rack_'));
    if (rackSlots.length === 0) return null;
    const byTime = new Map<string, number[]>();
    for (const s of rackSlots) {
      const timeKey = `${format(parseISO(s.start), 'HH:mm')}–${format(parseISO(s.end), 'HH:mm')}`;
      const num = parseInt(s.area_key.replace('rack_', ''), 10);
      if (!Number.isNaN(num)) {
        const list = byTime.get(timeKey) ?? [];
        list.push(num);
        byTime.set(timeKey, list);
      }
    }
    return Array.from(byTime.entries()).map(([time, nums]) => {
      const sorted = [...new Set(nums)].sort((a, b) => a - b);
      return { rangeLabel: formatRackRange(sorted, sideKey), time };
    });
  }, [firstInstance, allRacks.length, sideKey]);

  const areaSlotsWithTime = useMemo(() => {
    if (!firstInstance || allAreaKeys.length === 0) return null;
    const slots = firstInstance.area_slots;
    if (!slots?.length) return null;
    const areaSlots = slots.filter((s) => !s.area_key.startsWith('rack_'));
    if (areaSlots.length === 0) return null;
    const byArea = new Map<string, string[]>();
    for (const s of areaSlots) {
      const t = `${format(parseISO(s.start), 'HH:mm')}–${format(parseISO(s.end), 'HH:mm')}`;
      const list = byArea.get(s.area_key) ?? [];
      if (!list.includes(t)) list.push(t);
      byArea.set(s.area_key, list);
    }
    return Array.from(byArea.entries()).map(([key, times]) => ({
      label: areaKeyToLabel(key),
      times,
    }));
  }, [firstInstance, allAreaKeys.length]);

  // Frequency for block (e.g. "Weekly")
  const frequency = useMemo(() => {
    if (totalInstances <= 1) return null;
    const starts = booking.instances.map((inst) =>
      parseISO(inst.start).getTime()
    );
    const gaps = starts.slice(1).map((t, i) => t - starts[i]!);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const days = Math.round(avgGap / (24 * 60 * 60 * 1000));
    if (days === 7) return 'Weekly';
    if (days === 14) return 'Fortnightly';
    if (days >= 1) return `Every ${days} days`;
    return null;
  }, [booking.instances, totalInstances]);

  // Athletes summary (same as team card: show when all same, else "varies")
  const capacityPatterns = useMemo(
    () => new Set(booking.instances.map((inst) => inst.capacity ?? 1)),
    [booking.instances]
  );
  const uniqueCapacities = Array.from(capacityPatterns).sort((a, b) => a - b);
  const hasCapacityVariations = capacityPatterns.size > 1;
  const athletesSummary =
    uniqueCapacities.length <= 1
      ? `${uniqueCapacities[0] ?? 1}`
      : `${uniqueCapacities[0]}-${uniqueCapacities[uniqueCapacities.length - 1]} (varies by week)`;

  // Variation across weeks (for block bookings) – show tag and "View weekly details"
  const sortedInstances = useMemo(
    () =>
      [...booking.instances].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      ),
    [booking.instances]
  );
  const hasRackVariations = useMemo(() => {
    if (sortedInstances.length <= 1) return false;
    const patterns = new Set(
      sortedInstances.map((inst) =>
        [...inst.racks].sort((a, b) => a - b).join(',')
      )
    );
    return patterns.size > 1;
  }, [sortedInstances]);
  const hasAreaVariations = useMemo(() => {
    if (sortedInstances.length <= 1) return false;
    const patterns = new Set(
      sortedInstances.map((inst) => [...inst.areas].sort().join(','))
    );
    return patterns.size > 1;
  }, [sortedInstances]);
  const hasTimeVariations = useMemo(() => {
    if (sortedInstances.length <= 1) return false;
    const patterns = new Set(
      sortedInstances.map(
        (inst) =>
          `${format(parseISO(inst.start), 'HH:mm')}-${format(parseISO(inst.end), 'HH:mm')}`
      )
    );
    return patterns.size > 1;
  }, [sortedInstances]);
  const hasAnyWeeklyDifference =
    !isSingleBooking &&
    (hasRackVariations ||
      hasAreaVariations ||
      hasCapacityVariations ||
      hasTimeVariations);
  const variesByWeekLabel = useMemo(() => {
    if (!hasAnyWeeklyDifference) return null;
    const parts: string[] = [];
    if (hasRackVariations) parts.push('Platforms');
    if (hasAreaVariations) parts.push('Areas');
    if (hasCapacityVariations) parts.push('Athletes');
    if (hasTimeVariations) parts.push('Times');
    return parts.length > 0 ? parts.join(', ') : null;
  }, [
    hasAnyWeeklyDifference,
    hasRackVariations,
    hasAreaVariations,
    hasCapacityVariations,
    hasTimeVariations,
  ]);

  const bookingIsPast = isBookingInPast(booking.instances);
  const isUnprocessedPast = isPastBookingUnprocessed(
    booking.instances,
    booking.status as BookingStatus | undefined
  );
  const isCancelled =
    booking.status === 'cancelled' || booking.status === 'pending_cancellation';

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div
      className={clsx(
        'bg-slate-800/50 border rounded-lg p-4 hover:border-slate-600 transition-colors',
        isUnprocessedPast
          ? 'border-red-600/50 bg-red-900/10'
          : bookingIsPast
            ? 'border-slate-600/50 bg-slate-900/30'
            : 'border-slate-700'
      )}
    >
      {/* Header: title, time, badges, menu */}
      <div className="mb-4 pb-3 border-b border-slate-700">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
              <h3 className="text-lg font-semibold text-white truncate">
                {booking.title}
              </h3>
              <span className="text-slate-400 font-normal text-base shrink-0">
                {masterSessionTime}
              </span>
              {!hasCapacityVariations &&
                !(isSingleBooking && uniqueCapacities[0] === 1) && (
                  <span className="px-2.5 py-1 text-sm font-semibold bg-emerald-900/50 text-emerald-200 rounded-md border border-emerald-700/50 shrink-0">
                    {athletesSummary}{' '}
                    {uniqueCapacities.length === 1 && uniqueCapacities[0] === 1
                      ? 'athlete'
                      : 'athletes'}
                  </span>
                )}
              {booking.status && (
                <StatusBadge
                  status={booking.status as BookingStatus}
                  size="sm"
                  isPast={bookingIsPast}
                  isUnprocessedPast={isUnprocessedPast}
                />
              )}
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-3 py-1.5 text-sm font-semibold bg-indigo-900/40 text-indigo-200 rounded-md border border-indigo-700/50">
                {booking.side.name}
              </span>
              <span className="px-3 py-1.5 text-sm font-semibold bg-slate-700/60 text-slate-200 rounded-md border border-slate-600/50">
                {isSingleBooking
                  ? 'Single Session'
                  : `Block (${totalInstances} sessions)`}
              </span>
              {hasAnyWeeklyDifference && variesByWeekLabel && (
                <button
                  type="button"
                  onClick={() => {
                    setWeeklyDetailWeekIndex(0);
                    setShowWeeklyDetailModal(true);
                  }}
                  className="px-3 py-1.5 text-sm font-medium bg-amber-900/40 text-amber-200 rounded-md border border-amber-700/50 hover:bg-amber-800/50 transition-colors"
                  title="View details for each week"
                >
                  Varies: {variesByWeekLabel}
                </button>
              )}
            </div>

            {/* Coach-focused grid: 2x2 for single session (Date|Racks, Time|Areas), 2x3 for block */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <div className="text-slate-500 mb-0.5">
                  {isSingleBooking ? 'Date' : 'Start Date'}
                </div>
                <div className="text-slate-200 font-medium">
                  {firstDate ? formatDateBritish(firstDate) : '—'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">Racks</div>
                <div className="text-slate-200 font-medium">
                  {rackSlotsWithTime
                    ? rackSlotsWithTime
                        .map((g) => `${g.rangeLabel} (${g.time})`)
                        .join('; ')
                    : allRacks.length > 0
                      ? formatRackRange(allRacks, sideKey)
                      : 'None assigned'}
                </div>
              </div>
              {!isSingleBooking && (
                <>
                  <div>
                    <div className="text-slate-500 mb-0.5">End Date</div>
                    <div className="text-slate-200 font-medium">
                      {lastInstance
                        ? formatDateBritish(lastInstance.start)
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-0.5">Areas</div>
                    <div className="text-slate-200 font-medium">
                      {allAreaKeys.length > 0
                        ? areaSlotsWithTime
                          ? areaSlotsWithTime
                              .map((a) => `${a.label} (${a.times.join(', ')})`)
                              .join('; ')
                          : allAreaKeys.map(areaKeyToLabel).join(', ')
                        : 'None'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-0.5">Frequency</div>
                    <div className="text-slate-200 font-medium">
                      {frequency || '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-0.5">Next session</div>
                    <div className="text-slate-200 font-medium">
                      {nextInstance ? (
                        <>
                          {formatDateBritishShort(nextInstance.start)} at{' '}
                          {format(parseISO(nextInstance.start), 'HH:mm')}
                          {isNextInstanceFuture ? '' : ' (last)'}
                        </>
                      ) : (
                        '—'
                      )}
                    </div>
                  </div>
                </>
              )}
              {isSingleBooking && (
                <>
                  <div>
                    <div className="text-slate-500 mb-0.5">Time</div>
                    <div className="text-slate-200 font-medium">
                      {masterSessionTime}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-0.5">Areas</div>
                    <div className="text-slate-200 font-medium">
                      {allAreaKeys.length > 0
                        ? areaSlotsWithTime
                          ? areaSlotsWithTime
                              .map((a) => `${a.label} (${a.times.join(', ')})`)
                              .join('; ')
                          : allAreaKeys.map(areaKeyToLabel).join(', ')
                        : 'None'}
                    </div>
                  </div>
                </>
              )}
            </div>
            {bookingIsPast && (
              <div className="text-xs text-slate-500 mt-2">
                All sessions completed
              </div>
            )}
          </div>
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="h-8 w-8 rounded-md border border-slate-700 bg-slate-900/70 text-slate-300 hover:text-white hover:border-slate-500"
              aria-label="More booking options"
              aria-expanded={menuOpen}
            >
              <span className="text-lg leading-none">⋯</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-slate-700 bg-slate-900 shadow-xl">
                {onViewLifecycle ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onViewLifecycle(booking);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800 rounded-md"
                  >
                    View booking log
                  </button>
                ) : (
                  <div className="px-3 py-2 text-sm text-slate-400">
                    No actions available
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isUnprocessedPast && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-600/50 rounded-md">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-red-200">
              This booking is in the past but was never processed
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {nextInstance && !isCancelled && (
          <Link
            to={`/live-view?date=${format(parseISO(nextInstance.start), 'yyyy-MM-dd')}&time=${format(parseISO(nextInstance.start), 'HH:mm')}&side=${booking.side.key.toLowerCase()}`}
            onClick={(e) => e.stopPropagation()}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
            title={
              isNextInstanceFuture
                ? `View next session on ${format(parseISO(nextInstance.start), 'MMM d, yyyy')}`
                : 'View session'
            }
          >
            {isNextInstanceFuture ? 'View next session' : 'View session'}
          </Link>
        )}
        {onEdit && !isCancelled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(booking);
            }}
            className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
          >
            Edit
          </button>
        )}
        {onExtend && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onExtend(booking);
            }}
            className="px-3 py-1.5 text-sm bg-green-700 hover:bg-green-600 text-white rounded-md transition-colors"
          >
            Extend
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(booking);
            }}
            className="px-3 py-1.5 text-sm bg-red-700 hover:bg-red-600 text-white rounded-md transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {/* Weekly details modal (varying block): week selector + session detail with athletes */}
      {showWeeklyDetailModal &&
        hasAnyWeeklyDifference &&
        (() => {
          const selectedInst = sortedInstances[weeklyDetailWeekIndex];
          if (!selectedInst) return null;
          const slots = selectedInst.area_slots ?? [];
          const rackSlots = slots.filter((s) => s.area_key.startsWith('rack_'));
          const areaSlots = slots.filter(
            (s) => !s.area_key.startsWith('rack_')
          );
          const rackNumbers = [...new Set(selectedInst.racks)].sort(
            (a, b) => a - b
          );
          const t = (s: string) => (s.includes('T') ? s.slice(11, 16) : s);
          const rackRows = rackNumbers.map((rackNum) => {
            const rackKey = `rack_${rackNum}`;
            const slot = rackSlots.find((s) => s.area_key === rackKey);
            return {
              label: getRackOrPlatformLabel(sideKey, rackNum),
              start: slot?.start ?? selectedInst.start,
              end: slot?.end ?? selectedInst.end,
            };
          });
          const areaRows = areaSlots.map((slot) => ({
            label: areaKeyToLabel(slot.area_key),
            start: slot.start,
            end: slot.end,
          }));
          const capacity = selectedInst.capacity ?? 1;
          return (
            <Modal
              isOpen
              onClose={() => setShowWeeklyDetailModal(false)}
              maxWidth="md"
              lockScroll
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <h2 className="text-lg font-semibold text-white">
                    {booking.title} — weekly details
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowWeeklyDetailModal(false)}
                    className="text-slate-400 hover:text-white"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {sortedInstances.map((inst, idx) => (
                    <button
                      key={inst.id}
                      type="button"
                      onClick={() => setWeeklyDetailWeekIndex(idx)}
                      className={clsx(
                        'px-2.5 py-1.5 text-xs font-medium rounded border transition-colors',
                        weeklyDetailWeekIndex === idx
                          ? 'bg-indigo-600 border-indigo-500 text-white'
                          : 'bg-slate-800/60 border-slate-600 text-slate-300 hover:bg-slate-700/60'
                      )}
                    >
                      Week {idx + 1} ({formatDateBritishShort(inst.start)})
                    </button>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-700 space-y-4">
                  <p className="text-sm text-slate-400">
                    {formatDateBritish(selectedInst.start)} —{' '}
                    {t(selectedInst.start)} – {t(selectedInst.end)}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1.5 text-sm font-semibold bg-emerald-900/50 text-emerald-200 rounded-md border border-emerald-700/50">
                      {capacity} athlete{capacity !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {rackRows.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Platforms / Racks
                      </h3>
                      <ul className="space-y-2">
                        {rackRows.map((row, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between gap-4 py-2 px-3 rounded-md bg-slate-800/60 border border-slate-700/80 text-sm"
                          >
                            <span className="text-slate-200 font-medium">
                              {row.label}
                            </span>
                            <span className="text-slate-400 tabular-nums">
                              {t(row.start)} – {t(row.end)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {areaRows.length > 0 && (
                    <div>
                      <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Areas
                      </h3>
                      <ul className="space-y-2">
                        {areaRows.map((row, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between gap-4 py-2 px-3 rounded-md bg-slate-800/60 border border-slate-700/80 text-sm"
                          >
                            <span className="text-slate-200 font-medium">
                              {row.label}
                            </span>
                            <span className="text-slate-400 tabular-nums">
                              {t(row.start)} – {t(row.end)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {rackRows.length === 0 &&
                    areaRows.length === 0 &&
                    selectedInst.racks.length > 0 && (
                      <div>
                        <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                          Platforms / Racks
                        </h3>
                        <p className="text-sm text-slate-400">
                          {rackNumbers
                            .map((n) => getRackOrPlatformLabel(sideKey, n))
                            .join(', ')}{' '}
                          — {t(selectedInst.start)} – {t(selectedInst.end)}
                        </p>
                      </div>
                    )}
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowWeeklyDetailModal(false)}
                    className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </Modal>
          );
        })()}
    </div>
  );
}
