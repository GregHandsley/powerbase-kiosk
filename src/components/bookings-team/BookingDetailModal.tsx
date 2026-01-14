import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { formatDateBritish, formatDateBritishShort } from '../shared/dateUtils';
import { Modal } from '../shared/Modal';
import { StatusBadge } from '../shared/StatusBadge';
import { BookingChanges } from './BookingChanges';
import {
  isBookingInPast,
  isPastBookingUnprocessed,
} from '../admin/booking/utils';
import type { BookingForTeam } from '../../hooks/useBookingsTeam';
import type { BookingStatus } from '../../types/db';

type Props = {
  booking: BookingForTeam | null;
  isOpen: boolean;
  onClose: () => void;
  onProcess: (booking: BookingForTeam) => void;
  onConfirmCancellation?: (booking: BookingForTeam) => void;
  processing?: boolean;
};

export function BookingDetailModal({
  booking,
  isOpen,
  onClose,
  onProcess,
  onConfirmCancellation,
  processing = false,
}: Props) {
  // Track which changes have been acknowledged
  const [acknowledgedChanges, setAcknowledgedChanges] = useState<Set<number>>(
    new Set()
  );
  const [totalChanges, setTotalChanges] = useState(0);
  const [showAllDates, setShowAllDates] = useState(false);

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

  // Reset acknowledged changes when modal closes or booking changes
  useEffect(() => {
    if (!isOpen || !booking) {
      setAcknowledgedChanges(new Set());
      setTotalChanges(0);
      setShowAllDates(false);
    }
  }, [isOpen, booking]);

  const bookingInstances = booking?.instances;

  // Calculate frequency for block bookings
  const frequency = useMemo(() => {
    if (!booking || !bookingInstances) return null;
    const isSingleBooking = bookingInstances.length === 1;
    if (isSingleBooking || bookingInstances.length < 2) return null;

    const intervals: number[] = [];
    for (let i = 1; i < bookingInstances.length; i++) {
      const prevDate = parseISO(bookingInstances[i - 1].start);
      const currDate = parseISO(bookingInstances[i].start);
      const diffDays = Math.round(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      intervals.push(diffDays);
    }

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

    return null;
  }, [booking, bookingInstances]);

  // Get all session dates for block bookings
  const allSessionDates = useMemo(() => {
    if (!booking || !bookingInstances) return [];
    const isSingleBooking = bookingInstances.length === 1;
    if (isSingleBooking) return [];
    return bookingInstances.map((inst) => formatDateBritish(inst.start));
  }, [booking, bookingInstances]);

  // Check if different weeks have different racks or capacities
  const weekVariations = useMemo(() => {
    if (!booking || !bookingInstances) return null;
    const isSingleBooking = bookingInstances.length === 1;
    if (isSingleBooking || bookingInstances.length < 2) return null;

    const variations: {
      racks: Map<string, string[]>; // rack list -> dates
      capacity: Map<number, string[]>; // capacity -> dates
    } = {
      racks: new Map(),
      capacity: new Map(),
    };

    bookingInstances.forEach((inst) => {
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
  }, [booking, bookingInstances]);

  if (!isOpen || !booking) return null;

  const firstInstance = booking.instances[0];
  const lastInstance = booking.instances[booking.instances.length - 1];
  const isSingleBooking = booking.instances.length === 1;

  // Get unique racks across all instances
  const allRacks = new Set<number>();
  booking.instances.forEach((inst) => {
    inst.racks.forEach((rack) => allRacks.add(rack));
  });
  const racksList = Array.from(allRacks).sort((a, b) => a - b);

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
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-white">
              {booking.title}
            </h2>
            <StatusBadge
              status={booking.status as BookingStatus}
              size="md"
              isPast={bookingIsPast}
              isUnprocessedPast={isUnprocessedPast}
            />
            {bookingIsPast && (
              <span className="px-2 py-1 text-sm font-medium rounded border bg-green-900/30 text-green-300 border-green-600/50">
                Completed
              </span>
            )}
            {wasEditedAfterProcessing && (
              <span className="px-2 py-1 text-xs bg-amber-900/30 text-amber-300 rounded border border-amber-700/50">
                Edited After Processing
              </span>
            )}
          </div>
        </div>

        {/* Processing Status Alert for Unprocessed Past Bookings */}
        {isUnprocessedPast && (
          <div className="p-4 bg-red-900/20 border border-red-600/50 rounded-md">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-red-300 font-semibold text-lg">⚠️</span>
              <div>
                <div className="text-red-200 font-semibold mb-1">
                  Past Booking - Never Processed
                </div>
                <div className="text-red-300/90 text-xs">
                  This booking is in the past but was never processed by the
                  bookings team. This may indicate a missed booking or
                  processing oversight.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Prominent Side and Booking Type */}
        <div className="mb-4 pb-4 border-b border-slate-700">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-3 py-2 text-base font-semibold bg-indigo-900/40 text-indigo-200 rounded-md border border-indigo-700/50">
              {booking.side.name}
            </span>
            <span className="px-3 py-2 text-base font-semibold bg-slate-700/60 text-slate-200 rounded-md border border-slate-600/50">
              {isSingleBooking
                ? 'Single Session'
                : `Block Booking (${booking.instances.length} sessions)`}
            </span>
          </div>

          {/* Date Information */}
          {isSingleBooking ? (
            <div className="text-sm">
              <span className="text-slate-400">Date:</span>{' '}
              <span className="text-slate-200 font-medium">
                {formatDateBritish(firstInstance.start)}
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-slate-400">Start Date:</span>{' '}
                <span className="text-slate-200 font-medium">
                  {formatDateBritish(firstInstance.start)}
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
                className="text-sm text-indigo-400 hover:text-indigo-300 underline"
              >
                {showAllDates ? 'Hide' : 'Show'} all session dates (
                {allSessionDates.length})
              </button>
              {showAllDates && (
                <div className="mt-2 p-3 bg-slate-900/50 rounded border border-slate-700">
                  <div className="text-sm text-slate-400 mb-2">
                    All Session Dates:
                  </div>
                  <div className="text-sm text-slate-300 font-mono space-y-1">
                    {allSessionDates.map((date, idx) => (
                      <div key={idx}>• {date}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Booking Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-slate-400 mb-1">Processing Status</div>
            <div className="text-slate-200">
              {booking.status === 'processed'
                ? 'Processed'
                : booking.status === 'pending'
                  ? 'Pending Processing'
                  : booking.status === 'draft'
                    ? 'Draft'
                    : booking.status || 'Unknown'}
            </div>
            {bookingIsPast && (
              <div className="text-xs text-slate-500 mt-1">
                {isUnprocessedPast
                  ? '⚠️ Past booking - never processed'
                  : 'All sessions completed'}
              </div>
            )}
          </div>
          <div>
            <div className="text-sm text-slate-400 mb-1">Created By</div>
            <div className="text-slate-200">
              {booking.creator?.full_name || 'Unknown'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {formatDateBritishShort(booking.created_at)} at{' '}
              {format(parseISO(booking.created_at), 'HH:mm')}
            </div>
          </div>
          {booking.processed_at ? (
            <div>
              <div className="text-sm text-slate-400 mb-1">Processed By</div>
              <div className="text-slate-200">
                {booking.processor?.full_name || 'Unknown'}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {formatDateBritishShort(booking.processed_at)} at{' '}
                {format(parseISO(booking.processed_at), 'HH:mm')}
              </div>
            </div>
          ) : (
            <div>
              <div className="text-sm text-slate-400 mb-1">Processed By</div>
              <div className="text-slate-500 italic">Not yet processed</div>
            </div>
          )}
          {booking.last_edited_at && (
            <div>
              <div className="text-sm text-slate-400 mb-1">Last Edited</div>
              <div className="text-slate-200">
                {formatDateBritishShort(booking.last_edited_at)} at{' '}
                {format(parseISO(booking.last_edited_at), 'HH:mm')}
              </div>
              {booking.processed_at &&
                new Date(booking.last_edited_at) >
                  new Date(booking.processed_at) && (
                  <div className="text-xs text-amber-400 mt-1">
                    Edited after processing
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Week Variations - Show if different weeks have different racks/capacity */}
        {weekVariations && (
          <div className="p-4 bg-blue-900/20 border border-blue-700/50 rounded-md">
            <div className="text-sm font-semibold text-blue-300 mb-3">
              Booking Structure (varies by week)
            </div>
            <div className="space-y-3 text-sm">
              {weekVariations.racks && (
                <div>
                  <div className="text-blue-300 font-medium mb-2">
                    Racks vary by week:
                  </div>
                  <div className="text-blue-200/90 space-y-1.5 ml-3">
                    {Array.from(weekVariations.racks.entries()).map(
                      ([racks, dates], idx) => (
                        <div key={idx} className="text-sm font-mono">
                          <span className="text-blue-400">Racks {racks}:</span>{' '}
                          <span className="text-blue-300">
                            {dates.join(', ')}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
              {weekVariations.capacity && (
                <div>
                  <div className="text-blue-300 font-medium mb-2">
                    Athletes vary by week:
                  </div>
                  <div className="text-blue-200/90 space-y-1.5 ml-3">
                    {Array.from(weekVariations.capacity.entries()).map(
                      ([capacity, dates], idx) => (
                        <div key={idx} className="text-sm font-mono">
                          <span className="text-blue-400">
                            {capacity} athletes:
                          </span>{' '}
                          <span className="text-blue-300">
                            {dates.join(', ')}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Show changes if edited after processing */}
        {wasEditedAfterProcessing && booking.processed_snapshot && (
          <BookingChanges
            booking={booking}
            acknowledgedChanges={acknowledgedChanges}
            onAcknowledgeChange={handleAcknowledgeChange}
            onChangesCountChange={setTotalChanges}
          />
        )}

        {/* Instances */}
        <div>
          <div className="text-sm font-medium text-slate-300 mb-2">
            Sessions ({booking.instances.length})
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {booking.instances.map((instance, idx) => {
              const start = parseISO(instance.start);
              const end = parseISO(instance.end);
              return (
                <div
                  key={instance.id}
                  className="bg-slate-900/50 border border-slate-700 rounded p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-slate-200">
                      Session {idx + 1}
                    </div>
                    <div className="text-xs text-slate-400">
                      {formatDateBritish(start)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-400">Time: </span>
                      <span className="text-slate-200">
                        {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Racks: </span>
                      <span className="text-slate-200">
                        {instance.racks.length > 0
                          ? instance.racks.sort((a, b) => a - b).join(', ')
                          : 'None'}
                      </span>
                    </div>
                    {instance.capacity && (
                      <div>
                        <span className="text-slate-400">Capacity: </span>
                        <span className="text-slate-200">
                          {instance.capacity} athletes
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* All Racks Summary */}
        {racksList.length > 0 && (
          <div>
            <div className="text-sm font-medium text-slate-300 mb-2">
              All Racks
            </div>
            <div className="text-slate-200">{racksList.join(', ')}</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 transition-colors"
          >
            Close
          </button>
          {booking.status === 'pending_cancellation' &&
            onConfirmCancellation && (
              <button
                type="button"
                onClick={() => onConfirmCancellation(booking)}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 hover:bg-red-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {processing ? 'Confirming...' : 'Confirm Cancellation'}
              </button>
            )}
          {isPending && (
            <button
              type="button"
              onClick={() => onProcess(booking)}
              disabled={
                processing ||
                (wasEditedAfterProcessing &&
                  requiresAcknowledgment &&
                  !allChangesAcknowledged)
              }
              className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={
                wasEditedAfterProcessing &&
                requiresAcknowledgment &&
                !allChangesAcknowledged
                  ? 'Please acknowledge all changes before processing'
                  : ''
              }
            >
              {processing ? 'Processing...' : 'Mark as Processed'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
