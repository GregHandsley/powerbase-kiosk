import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { formatDateBritish, formatDateBritishShort } from '../shared/dateUtils';
import { StatusBadge } from '../shared/StatusBadge';
import { BookingChanges } from './BookingChanges';
import {
  isBookingInPast,
  isPastBookingUnprocessed,
} from '../admin/booking/utils';
import { usePermission } from '../../hooks/usePermissions';
import type { BookingForTeam } from '../../hooks/useBookingsTeam';
import type { BookingStatus } from '../../types/db';
import type { ActiveInstance } from '../../types/snapshot';
import { SessionBookingInfoModal } from '../schedule/SessionBookingInfoModal';
import { areaKeyToLabel } from '../schedule/utils/areaKeyUtils';
import { getRackOrPlatformLabel } from '../schedule/utils/platformUtils';

/** Format sorted rack numbers as compact ranges, e.g. "Racks 1 – 6" or "Rack 1, Racks 9 – 10". Same as BookingBuilderPanel. */
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

type Props = {
  booking: BookingForTeam;
  onView: (booking: BookingForTeam) => void;
  onProcess: (booking: BookingForTeam) => void;
  onConfirmCancellation?: (booking: BookingForTeam) => void;
  isSelected?: boolean;
  onSelect?: (bookingId: number, selected: boolean) => void;
};

/**
 * Component to render the process button with permission check
 */
function ProcessButton({
  booking,
  onProcess,
  wasEditedAfterProcessing,
  requiresAcknowledgment,
  allChangesAcknowledged,
}: {
  booking: BookingForTeam;
  onProcess: (booking: BookingForTeam) => void;
  wasEditedAfterProcessing: boolean;
  requiresAcknowledgment: boolean;
  allChangesAcknowledged: boolean;
}) {
  const { hasPermission: canProcess } = usePermission(
    booking.organization_id,
    'bookings.process'
  );

  if (!canProcess) {
    return (
      <span className="px-3 py-1.5 text-sm text-slate-500 italic">
        No permission to process
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onProcess(booking)}
      disabled={
        Boolean(
          wasEditedAfterProcessing &&
          requiresAcknowledgment &&
          !allChangesAcknowledged
        ) || undefined
      }
      className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      title={
        wasEditedAfterProcessing &&
        requiresAcknowledgment &&
        !allChangesAcknowledged
          ? 'Please acknowledge all changes before processing'
          : ''
      }
    >
      Mark as Processed
    </button>
  );
}

export function BookingTeamCard({
  booking,
  // onView,
  onProcess,
  onConfirmCancellation,
  isSelected = false,
  // onSelect,
}: Props) {
  // Track which changes have been acknowledged
  const [acknowledgedChanges, setAcknowledgedChanges] = useState<Set<number>>(
    new Set()
  );
  const [totalChanges, setTotalChanges] = useState(0);

  const handleAcknowledgeChange = (
    changeIndex: number,
    acknowledged: boolean
  ) => {
    const newAcknowledged = new Set(acknowledgedChanges);
    if (acknowledged) {
      newAcknowledged.add(changeIndex);
    } else {
      newAcknowledged.delete(changeIndex);
    }
    setAcknowledgedChanges(newAcknowledged);
  };

  // Only require acknowledgment if there are multiple changes
  const requiresAcknowledgment = totalChanges > 1;
  const allChangesAcknowledged =
    !requiresAcknowledgment ||
    (totalChanges > 0 && acknowledgedChanges.size === totalChanges);
  const firstInstance = booking.instances[0];
  const lastInstance = booking.instances[booking.instances.length - 1];
  const totalInstances = booking.instances.length;

  const firstDate = firstInstance ? parseISO(firstInstance.start) : null;
  // const lastDate = lastInstance ? parseISO(lastInstance.end) : null;

  // Determine if single or block booking
  const isSingleBooking = totalInstances === 1;

  // Calculate frequency for block bookings
  const frequency = useMemo(() => {
    if (isSingleBooking || booking.instances.length < 2) return null;

    // Calculate intervals between sessions
    const intervals: number[] = [];
    for (let i = 1; i < booking.instances.length; i++) {
      const prevDate = parseISO(booking.instances[i - 1].start);
      const currDate = parseISO(booking.instances[i].start);
      const diffDays = Math.round(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      intervals.push(diffDays);
    }

    // Check if all intervals are the same (consistent frequency)
    if (
      intervals.length > 0 &&
      intervals.every((interval) => interval === intervals[0])
    ) {
      const days = intervals[0];
      if (days === 7) return 'Weekly';
      if (days === 14) return 'Bi-weekly';
      if (days === 1) return 'Daily';
      return `Every ${days} days`;
    }

    // If intervals vary, return null (irregular pattern)
    return null;
  }, [isSingleBooking, booking.instances]);

  // Format date display - for single bookings, just show the date, not a range
  // const dateDisplay = useMemo(() => {
  //   if (!firstDate) return null;
  //   if (isSingleBooking) {
  //     return formatDateBritish(firstDate);
  //   } else if (lastDate) {
  //     return `${formatDateBritishShort(firstDate)} - ${formatDateBritish(lastDate)}`;
  //   }
  //   return formatDateBritish(firstDate);
  // }, [firstDate, lastDate, isSingleBooking]);

  // Sort instances for stable week-by-week summary
  const sortedInstances = useMemo(
    () =>
      [...booking.instances].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      ),
    [booking.instances]
  );
  const [showAllWeeks, setShowAllWeeks] = useState(false);

  // Get unique racks across all instances
  const allRacks = new Set<number>();
  booking.instances.forEach((inst) => {
    inst.racks.forEach((rack) => allRacks.add(rack));
  });
  const racksList = Array.from(allRacks).sort((a, b) => a - b);

  const formatTimeRange = (startIso: string, endIso: string) =>
    `${format(parseISO(startIso), 'HH:mm')} - ${format(parseISO(endIso), 'HH:mm')}`;

  const masterSessionTime = firstInstance
    ? formatTimeRange(firstInstance.start, firstInstance.end)
    : 'N/A';

  const rackPatterns = useMemo(
    () =>
      new Set(
        sortedInstances.map((inst) =>
          [...inst.racks].sort((a, b) => a - b).join(',')
        )
      ),
    [sortedInstances]
  );
  const capacityPatterns = useMemo(
    () => new Set(sortedInstances.map((inst) => inst.capacity ?? 1)),
    [sortedInstances]
  );
  const timePatterns = useMemo(
    () =>
      new Set(
        sortedInstances.map((inst) => formatTimeRange(inst.start, inst.end))
      ),
    [sortedInstances]
  );

  const hasRackVariations = rackPatterns.size > 1;
  const hasCapacityVariations = capacityPatterns.size > 1;
  const hasTimeVariations = timePatterns.size > 1;
  const hasWeeklyDifferences =
    hasRackVariations || hasCapacityVariations || hasTimeVariations;

  const uniqueCapacities = Array.from(capacityPatterns).sort((a, b) => a - b);
  const athletesSummary =
    uniqueCapacities.length <= 1
      ? `${uniqueCapacities[0] ?? 1}`
      : `${uniqueCapacities[0]}-${uniqueCapacities[uniqueCapacities.length - 1]} (varies by week)`;

  const weeklyRows = useMemo(() => {
    if (sortedInstances.length === 0) return [];

    const baseline = sortedInstances[0];
    const baselineRacks = [...baseline.racks].sort((a, b) => a - b).join(',');
    const baselineCapacity = baseline.capacity ?? 1;
    const baselineTime = formatTimeRange(baseline.start, baseline.end);
    const baselineAreas = [...baseline.areas].sort().join(',');

    return sortedInstances.map((inst, index) => {
      const racks = [...inst.racks].sort((a, b) => a - b);
      const rackKey = racks.join(',');
      const capacity = inst.capacity ?? 1;
      const time = formatTimeRange(inst.start, inst.end);
      const areaKey = [...inst.areas].sort().join(',');

      return {
        key: inst.id,
        inst,
        week: index + 1,
        date: formatDateBritish(inst.start),
        time,
        capacity,
        rackCount: racks.length,
        hasDifference:
          index > 0 &&
          (rackKey !== baselineRacks ||
            capacity !== baselineCapacity ||
            time !== baselineTime ||
            areaKey !== baselineAreas),
      };
    });
  }, [sortedInstances]);

  // Unique areas across all instances for card display
  const allAreaKeys = useMemo(() => {
    const set = new Set<string>();
    booking.instances.forEach((inst) => inst.areas.forEach((a) => set.add(a)));
    return Array.from(set).sort();
  }, [booking.instances]);
  const areaPatterns = useMemo(
    () =>
      new Set(sortedInstances.map((inst) => [...inst.areas].sort().join(','))),
    [sortedInstances]
  );
  const hasAreaVariations = areaPatterns.size > 1;
  const areasSummary =
    allAreaKeys.length === 0
      ? 'None'
      : allAreaKeys.map(areaKeyToLabel).join(', ') +
        (hasAreaVariations ? ' (varies by week)' : '');

  const hasAnyWeeklyDifference = hasWeeklyDifferences || hasAreaVariations;
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

  const sideKey = (booking.side.key?.toLowerCase() ?? 'power') as
    | 'power'
    | 'base';

  // Per-slot times for racks and areas when area_slots are available (user-specified times, not master window)
  // Group rack slots by time and format as combined ranges (e.g. "Racks 1 – 6 (09:00–10:00), Rack 9 & 10 (10:00–10:30)")
  const rackSlotsWithTime = useMemo(() => {
    if (!firstInstance || racksList.length === 0) return null;
    const slots = firstInstance.area_slots;
    if (slots?.length) {
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
    }
    return null;
  }, [firstInstance, racksList, sideKey]);

  const areaSlotsWithTime = useMemo(() => {
    if (
      !firstInstance ||
      !firstInstance.area_slots?.length ||
      allAreaKeys.length === 0
    )
      return null;
    const slots = firstInstance.area_slots.filter(
      (s) => !s.area_key.startsWith('rack_')
    );
    if (slots.length === 0) return null;
    return allAreaKeys.map((area_key) => {
      const areaSlots = slots.filter((s) => s.area_key === area_key);
      const times =
        areaSlots.length > 0
          ? areaSlots.map(
              (s) =>
                `${format(parseISO(s.start), 'HH:mm')}–${format(parseISO(s.end), 'HH:mm')}`
            )
          : [
              `${format(parseISO(firstInstance.start), 'HH:mm')}–${format(parseISO(firstInstance.end), 'HH:mm')}`,
            ];
      return {
        label: areaKeyToLabel(area_key),
        times,
      };
    });
  }, [firstInstance, allAreaKeys]);

  // Session detail modal (same as Session View: double-click a week to see specifics)
  const [viewingSession, setViewingSession] = useState<{
    active: ActiveInstance;
    side: 'power' | 'base';
  } | null>(null);

  const openSessionDetail = (inst: (typeof booking.instances)[0]) => {
    const sideKey = (booking.side.key?.toLowerCase() ?? 'power') as
      | 'power'
      | 'base';
    const area_slots: Array<{ area_key: string; start: string; end: string }> =
      inst.area_slots?.length
        ? inst.area_slots
        : [
            ...inst.racks.map((r) => ({
              area_key: `rack_${r}`,
              start: inst.start,
              end: inst.end,
            })),
            ...inst.areas.map((area_key) => ({
              area_key,
              start: inst.start,
              end: inst.end,
            })),
          ];
    const active: ActiveInstance = {
      instanceId: inst.id,
      bookingId: booking.id,
      start: inst.start,
      end: inst.end,
      racks: inst.racks,
      areas: inst.areas,
      title: booking.title,
      color: booking.color,
      isLocked: false,
      createdBy: booking.creator?.full_name ?? null,
      capacity: inst.capacity,
      status: booking.status,
      area_slots: area_slots.length > 0 ? area_slots : undefined,
    };
    setViewingSession({ active, side: sideKey });
  };

  const isPending = booking.status === 'pending';
  const wasEditedAfterProcessing = Boolean(
    booking.processed_at &&
    booking.last_edited_at &&
    new Date(booking.last_edited_at) > new Date(booking.processed_at)
  );

  // Check if booking is in the past
  const bookingIsPast = isBookingInPast(booking.instances);
  const isUnprocessedPast = isPastBookingUnprocessed(
    booking.instances,
    booking.status
  );

  return (
    <div
      className={clsx(
        'bg-slate-800/50 border rounded-lg p-4 hover:border-slate-600 transition-colors',
        isSelected && 'border-indigo-500 bg-indigo-900/20',
        !isSelected &&
          (isUnprocessedPast
            ? 'border-red-600/50 bg-red-900/10'
            : bookingIsPast
              ? 'border-slate-600/50 bg-slate-900/30'
              : 'border-slate-700'),
        isPending && 'ring-2 ring-yellow-500/30'
      )}
    >
      {/* Prominent Header Section */}
      <div className="mb-4 pb-3 border-b border-slate-700">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
              <h3 className="text-lg font-semibold text-white truncate">
                {booking.title}
              </h3>
              <span className="text-slate-400 font-normal text-base shrink-0">
                {masterSessionTime}
              </span>
              {!hasCapacityVariations && (
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
              {bookingIsPast && (
                <span className="px-2 py-0.5 text-xs font-medium rounded border bg-green-900/30 text-green-300 border-green-600/50">
                  Completed
                </span>
              )}
              {wasEditedAfterProcessing && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-amber-900/30 text-amber-300 rounded border border-amber-700/50">
                  Edited
                </span>
              )}
            </div>

            {/* Prominent Side and Booking Type */}
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1.5 text-sm font-semibold bg-indigo-900/40 text-indigo-200 rounded-md border border-indigo-700/50">
                {booking.side.name}
              </span>
              <span className="px-3 py-1.5 text-sm font-semibold bg-slate-700/60 text-slate-200 rounded-md border border-slate-600/50">
                {isSingleBooking
                  ? 'Single Session'
                  : `Block Booking (${totalInstances} sessions)`}
              </span>
            </div>

            {/* 2x3 grid: Start/End/Frequency | Racks/Areas/Created By */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mt-3">
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
                    : racksList.length > 0
                      ? formatRackRange(racksList, sideKey)
                      : 'None assigned'}
                  {hasRackVariations && (
                    <span className="text-amber-300 ml-1">
                      (Varies by week)
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">
                  {isSingleBooking ? '—' : 'End Date'}
                </div>
                <div className="text-slate-200 font-medium">
                  {isSingleBooking
                    ? '—'
                    : lastInstance
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
                      : areasSummary
                    : 'None'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">
                  {isSingleBooking ? '—' : 'Frequency'}
                </div>
                <div className="text-slate-200 font-medium">
                  {isSingleBooking ? '—' : frequency || '—'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 mb-0.5">Created By</div>
                <div className="text-slate-200 font-medium">
                  {booking.creator?.full_name || 'Unknown'}
                  <span className="text-slate-500 font-normal ml-1">
                    {formatDateBritishShort(booking.created_at)} at{' '}
                    {format(parseISO(booking.created_at), 'HH:mm')}
                  </span>
                </div>
              </div>
            </div>
            {!hasAnyWeeklyDifference && bookingIsPast && (
              <div className="text-xs text-slate-500 mt-2">
                All sessions completed
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weekly setup - only when weeks differ */}
      {!isSingleBooking && hasAnyWeeklyDifference && (
        <div className="mb-4 p-3 bg-blue-900/15 border border-blue-700/40 rounded-md">
          {variesByWeekLabel && (
            <div className="text-xs text-blue-200 mb-3">
              Varies: {variesByWeekLabel}
            </div>
          )}
          <div className="space-y-1.5">
            {(showAllWeeks ? weeklyRows : weeklyRows.slice(0, 4)).map((row) => (
              <div
                key={row.key}
                role="button"
                tabIndex={0}
                onDoubleClick={() => openSessionDetail(row.inst)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openSessionDetail(row.inst);
                  }
                }}
                className={clsx(
                  'text-xs rounded border px-2 py-1.5 cursor-pointer hover:bg-slate-800/60 transition-colors',
                  row.hasDifference
                    ? 'bg-amber-900/20 border-amber-700/50 text-amber-200'
                    : 'bg-slate-900/40 border-slate-700 text-slate-300'
                )}
                title="Double-click to view session details"
              >
                <span className="font-medium">
                  Week {row.week} ({row.date})
                </span>
                <span className="text-slate-400"> - </span>
                <span>{row.time}</span>
                <span className="text-slate-400"> - </span>
                <span>
                  {row.capacity} athlete{row.capacity === 1 ? '' : 's'}
                </span>
                <span className="text-slate-400"> - </span>
                <span>
                  {row.rackCount} rack{row.rackCount === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
          {weeklyRows.length > 4 && (
            <button
              type="button"
              onClick={() => setShowAllWeeks((prev) => !prev)}
              className="mt-2 text-xs text-indigo-300 hover:text-indigo-200 underline"
            >
              {showAllWeeks
                ? 'Show fewer weeks'
                : `Show all ${weeklyRows.length} weeks`}
            </button>
          )}
        </div>
      )}

      {/* Processing Status Alert for Unprocessed Past Bookings */}
      {isUnprocessedPast && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-600/50 rounded-md">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-red-200">
              This booking is in the past but was never processed
            </span>
          </div>
        </div>
      )}

      {/* Processed By (when processed) */}
      {booking.processed_at && (
        <div className="space-y-2 mb-4 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-slate-500 shrink-0">Processed By:</span>
            <span className="text-slate-300">
              {booking.processor?.full_name || 'Unknown'}
              <span className="text-slate-500 ml-1">
                {formatDateBritishShort(booking.processed_at)} at{' '}
                {format(parseISO(booking.processed_at), 'HH:mm')}
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Show changes if edited after processing */}
      {wasEditedAfterProcessing && booking.processed_snapshot && (
        <div className="mb-4">
          <BookingChanges
            booking={booking}
            acknowledgedChanges={acknowledgedChanges}
            onAcknowledgeChange={handleAcknowledgeChange}
            onChangesCountChange={setTotalChanges}
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {booking.status === 'pending_cancellation' && onConfirmCancellation && (
          <button
            type="button"
            onClick={() => onConfirmCancellation(booking)}
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors"
          >
            Confirm Cancellation
          </button>
        )}
        {isPending && (
          <ProcessButton
            booking={booking}
            onProcess={onProcess}
            wasEditedAfterProcessing={wasEditedAfterProcessing}
            requiresAcknowledgment={requiresAcknowledgment}
            allChangesAcknowledged={allChangesAcknowledged}
          />
        )}
      </div>

      {/* Session details modal (same component as Session View) */}
      {viewingSession && (
        <SessionBookingInfoModal
          booking={viewingSession.active}
          side={viewingSession.side}
          isOpen
          onClose={() => setViewingSession(null)}
        />
      )}
    </div>
  );
}
