import { useState, useMemo, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import clsx from 'clsx';
import { formatDateBritish, formatDateBritishShort } from '../shared/dateUtils';
import { StatusBadge } from '../shared/StatusBadge';
import { BookingChanges } from './BookingChanges';
import {
  isBookingInPast,
  isPastBookingUnprocessed,
} from '../admin/booking/utils';
import type { BookingForTeam } from '../../hooks/useBookingsTeam';
import type { BookingStatus } from '../../types/db';

type Props = {
  booking: BookingForTeam;
  onView: (booking: BookingForTeam) => void;
  onProcess: (booking: BookingForTeam) => void;
  isSelected?: boolean;
  onSelect?: (bookingId: number, selected: boolean) => void;
};

export function BookingTeamCard({
  booking,
  onView,
  onProcess,
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
  const lastDate = lastInstance ? parseISO(lastInstance.end) : null;

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

  // Get all session dates for block bookings
  const allSessionDates = useMemo(() => {
    if (isSingleBooking) return [];
    return booking.instances.map((inst) => formatDateBritish(inst.start));
  }, [isSingleBooking, booking.instances]);

  const [showAllDates, setShowAllDates] = useState(false);

  // Format date display - for single bookings, just show the date, not a range
  const dateDisplay = useMemo(() => {
    if (!firstDate) return null;
    if (isSingleBooking) {
      return formatDateBritish(firstDate);
    } else if (lastDate) {
      return `${formatDateBritishShort(firstDate)} - ${formatDateBritish(lastDate)}`;
    }
    return formatDateBritish(firstDate);
  }, [firstDate, lastDate, isSingleBooking]);

  // Get unique racks across all instances
  const allRacks = new Set<number>();
  booking.instances.forEach((inst) => {
    inst.racks.forEach((rack) => allRacks.add(rack));
  });
  const racksList = Array.from(allRacks).sort((a, b) => a - b);

  // Check if different weeks have different racks or capacities
  const weekVariations = useMemo(() => {
    if (isSingleBooking || booking.instances.length < 2) return null;

    const variations: {
      racks: Map<string, string[]>; // rack list -> dates
      capacity: Map<number, string[]>; // capacity -> dates
    } = {
      racks: new Map(),
      capacity: new Map(),
    };

    booking.instances.forEach((inst) => {
      const date = formatDateBritish(inst.start);
      const racksKey = inst.racks.sort((a, b) => a - b).join(', ');
      const capacity = inst.capacity ?? 1;

      // Group by racks
      if (!variations.racks.has(racksKey)) {
        variations.racks.set(racksKey, []);
      }
      variations.racks.get(racksKey)!.push(date);

      // Group by capacity
      if (!variations.capacity.has(capacity)) {
        variations.capacity.set(capacity, []);
      }
      variations.capacity.get(capacity)!.push(date);
    });

    // Only return if there are actual variations
    const hasRackVariations = variations.racks.size > 1;
    const hasCapacityVariations = variations.capacity.size > 1;

    if (hasRackVariations || hasCapacityVariations) {
      return {
        racks: hasRackVariations ? variations.racks : null,
        capacity: hasCapacityVariations ? variations.capacity : null,
      };
    }

    return null;
  }, [isSingleBooking, booking.instances]);

  // Sort instances for stable week-by-week preview
  const sortedInstances = useMemo(
    () =>
      [...booking.instances].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      ),
    [booking.instances]
  );
  const weekCount = sortedInstances.length;
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);

  // Reset week index when booking changes
  useEffect(() => {
    setSelectedWeekIndex(0);
  }, [booking.id]);

  const selectedInstance =
    sortedInstances[selectedWeekIndex] ?? sortedInstances[0];
  const [showVariationDetails, setShowVariationDetails] = useState(false);

  const isPending = booking.status === 'pending';
  const wasEditedAfterProcessing =
    booking.processed_at &&
    booking.last_edited_at &&
    new Date(booking.last_edited_at) > new Date(booking.processed_at);

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
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-lg font-semibold text-white truncate">
                {booking.title}
              </h3>
              <StatusBadge
                status={booking.status as BookingStatus}
                size="sm"
                isPast={bookingIsPast}
                isUnprocessedPast={isUnprocessedPast}
              />
              {bookingIsPast && (
                <span className="px-2 py-0.5 text-xs font-medium rounded border bg-green-900/30 text-green-300 border-green-600/50">
                  Completed
                </span>
              )}
              {wasEditedAfterProcessing && (
                <span className="px-2 py-0.5 text-xs bg-amber-900/30 text-amber-300 rounded border border-amber-700/50">
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

            {/* Date Information */}
            {dateDisplay && (
              <div className="space-y-1">
                {isSingleBooking ? (
                  <div className="text-sm">
                    <span className="text-slate-400">Date:</span>{' '}
                    <span className="text-slate-200 font-medium">
                      {dateDisplay}
                    </span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-sm">
                      <span className="text-slate-400">Start Date:</span>{' '}
                      <span className="text-slate-200 font-medium">
                        {formatDateBritish(firstDate!)}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-slate-400">End Date:</span>{' '}
                      <span className="text-slate-200 font-medium">
                        {formatDateBritish(lastInstance.start)}
                      </span>
                    </div>
                    {frequency && (
                      <div className="text-sm">
                        <span className="text-slate-400">Frequency:</span>{' '}
                        <span className="text-slate-200 font-medium">
                          {frequency}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowAllDates(!showAllDates)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                    >
                      {showAllDates ? 'Hide' : 'Show'} all session dates (
                      {allSessionDates.length})
                    </button>
                    {showAllDates && (
                      <div className="mt-2 p-2 bg-slate-900/50 rounded border border-slate-700">
                        <div className="text-xs text-slate-400 mb-1">
                          All Session Dates:
                        </div>
                        <div className="text-xs text-slate-300 font-mono space-y-0.5">
                          {allSessionDates.map((date, idx) => (
                            <div key={idx}>• {date}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Week variations summary (compact) */}
      {!isSingleBooking && (
        <div className="mb-4 p-3 bg-blue-900/15 border border-blue-700/40 rounded-md">
          {weekVariations ? (
            <>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-blue-300">
                  Differences across weeks
                </div>
                <button
                  type="button"
                  onClick={() => setShowVariationDetails((v) => !v)}
                  className="text-xs text-indigo-300 hover:text-indigo-200 underline"
                >
                  {showVariationDetails ? 'Hide details' : 'Show details'}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                {weekVariations.racks && (
                  <span className="px-2 py-1 rounded bg-blue-900/30 border border-blue-700/50 text-blue-200">
                    Racks vary ({weekVariations.racks.size} pattern
                    {weekVariations.racks.size > 1 ? 's' : ''})
                  </span>
                )}
                {weekVariations.capacity && (
                  <span className="px-2 py-1 rounded bg-blue-900/30 border border-blue-700/50 text-blue-200">
                    Athletes vary ({weekVariations.capacity.size} pattern
                    {weekVariations.capacity.size > 1 ? 's' : ''})
                  </span>
                )}
              </div>
              {showVariationDetails && (
                <div className="mt-3 space-y-2 text-xs text-blue-100">
                  {weekVariations.racks && (
                    <div>
                      <div className="text-blue-300 font-medium mb-1">
                        Racks by week
                      </div>
                      <div className="space-y-1 ml-2">
                        {Array.from(weekVariations.racks.entries()).map(
                          ([racks, dates], idx) => (
                            <div key={idx} className="font-mono">
                              <span className="text-blue-400">
                                Racks {racks}:
                              </span>{' '}
                              <span className="text-blue-200">
                                {dates.join(' • ')}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                  {weekVariations.capacity && (
                    <div>
                      <div className="text-blue-300 font-medium mb-1">
                        Athletes by week
                      </div>
                      <div className="space-y-1 ml-2">
                        {Array.from(weekVariations.capacity.entries()).map(
                          ([capacity, dates], idx) => (
                            <div key={idx} className="font-mono">
                              <span className="text-blue-400">
                                {capacity} athletes:
                              </span>{' '}
                              <span className="text-blue-200">
                                {dates.join(' • ')}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-xs font-semibold text-blue-300">
              All weeks are identical (same racks and athletes)
            </div>
          )}
        </div>
      )}

      {/* Week-by-week preview for varying weeks */}
      {!isSingleBooking &&
        (weekVariations?.racks || weekVariations?.capacity) &&
        selectedInstance && (
          <div className="mb-4 p-3 bg-slate-900/40 border border-slate-700 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-slate-200">
                Week-by-week preview
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedWeekIndex(Math.max(0, selectedWeekIndex - 1))
                  }
                  disabled={selectedWeekIndex === 0}
                  className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-slate-200"
                >
                  ←
                </button>
                <div className="text-xs text-slate-400">
                  Week {selectedWeekIndex + 1} of {weekCount}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedWeekIndex(
                      Math.min(weekCount - 1, selectedWeekIndex + 1)
                    )
                  }
                  disabled={selectedWeekIndex === weekCount - 1}
                  className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-slate-200"
                >
                  →
                </button>
              </div>
            </div>
            <div className="text-xs text-slate-300 mb-2">
              {formatDateBritish(selectedInstance.start)}
            </div>
            <div className="space-y-1 text-sm text-slate-200">
              <div>
                <span className="text-slate-400">Racks:</span>{' '}
                <span className="font-mono">
                  {selectedInstance.racks.length > 0
                    ? [...selectedInstance.racks]
                        .sort((a, b) => a - b)
                        .join(', ')
                    : 'None assigned'}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Athletes:</span>{' '}
                <span>{selectedInstance.capacity ?? 'Not specified'}</span>
              </div>
              <div>
                <span className="text-slate-400">Time:</span>{' '}
                <span>
                  {format(parseISO(selectedInstance.start), 'HH:mm')} -{' '}
                  {format(parseISO(selectedInstance.end), 'HH:mm')}
                </span>
              </div>
            </div>
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

      {/* Booking Details */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <div className="text-slate-500 mb-1">Session Time</div>
          <div className="text-slate-300">
            {firstInstance
              ? `${format(parseISO(firstInstance.start), 'HH:mm')} - ${format(parseISO(firstInstance.end), 'HH:mm')}`
              : 'N/A'}
          </div>
          {bookingIsPast && (
            <div className="text-xs text-slate-500 mt-1">
              All sessions completed
            </div>
          )}
        </div>
        <div>
          <div className="text-slate-500 mb-1">Assigned Racks</div>
          <div className="text-slate-300">
            {weekVariations?.racks
              ? 'Racks vary by week — see preview above'
              : racksList.length > 0
                ? racksList.join(', ')
                : 'None assigned'}
          </div>
        </div>
        {!weekVariations?.capacity && (
          <div>
            <div className="text-slate-500 mb-1">Athletes</div>
            <div className="text-slate-300">
              {firstInstance?.capacity ?? 'Not specified'}
            </div>
          </div>
        )}
        <div>
          <div className="text-slate-500 mb-1">Created By</div>
          <div className="text-slate-300">
            {booking.creator?.full_name || 'Unknown'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {formatDateBritishShort(booking.created_at)} at{' '}
            {format(parseISO(booking.created_at), 'HH:mm')}
          </div>
        </div>
        {booking.processed_at && (
          <div>
            <div className="text-slate-500 mb-1">Processed By</div>
            <div className="text-slate-300">
              {booking.processor?.full_name || 'Unknown'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {formatDateBritishShort(booking.processed_at)} at{' '}
              {format(parseISO(booking.processed_at), 'HH:mm')}
            </div>
          </div>
        )}
      </div>

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
        <button
          type="button"
          onClick={() => onView(booking)}
          className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
        >
          View Details
        </button>
        {isPending && (
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
        )}
      </div>
    </div>
  );
}
