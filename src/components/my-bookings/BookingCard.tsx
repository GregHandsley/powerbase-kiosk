import { format, parseISO, isAfter } from 'date-fns';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { StatusBadge } from '../shared/StatusBadge';
import {
  isBookingInPast,
  isPastBookingUnprocessed,
} from '../admin/booking/utils';
import type { BookingStatus } from '../../types/db';
import type { BookingWithInstances } from '../../hooks/useMyBookings';

type Props = {
  booking: BookingWithInstances;
  onEdit?: (booking: BookingWithInstances) => void;
  onDelete?: (booking: BookingWithInstances) => void;
  onExtend?: (booking: BookingWithInstances) => void;
};

export function BookingCard({ booking, onEdit, onDelete, onExtend }: Props) {
  const firstInstance = booking.instances[0];
  const lastInstance = booking.instances[booking.instances.length - 1];
  const totalInstances = booking.instances.length;

  // Find the next upcoming instance (or first future instance)
  const now = new Date();
  const nextInstance =
    booking.instances.find((inst) => {
      const startTime = parseISO(inst.start);
      return isAfter(startTime, now);
    }) || firstInstance; // Fallback to first instance if all are in the past

  const firstDate = firstInstance ? parseISO(firstInstance.start) : null;
  const lastDate = lastInstance ? parseISO(lastInstance.end) : null;

  const totalCapacity = booking.instances.reduce(
    (sum, inst) => sum + (inst.capacity || 1),
    0
  );
  const avgCapacity =
    totalInstances > 0 ? Math.round(totalCapacity / totalInstances) : 0;

  // Get unique racks across all instances
  const allRacks = new Set<number>();
  booking.instances.forEach((inst) => {
    inst.racks.forEach((rack) => allRacks.add(rack));
  });
  const racksList = Array.from(allRacks).sort((a, b) => a - b);

  // Get Live View URL for the next upcoming instance (or first if all past)
  // Pre-fill date and start time
  const liveViewUrl = nextInstance
    ? `/live-view?date=${format(parseISO(nextInstance.start), 'yyyy-MM-dd')}&time=${format(parseISO(nextInstance.start), 'HH:mm')}&side=${booking.side.key.toLowerCase()}`
    : null;

  // Check if the next instance is actually in the future
  const isNextInstanceFuture = nextInstance
    ? isAfter(parseISO(nextInstance.start), now)
    : false;

  // Check if booking is in the past
  const bookingIsPast = isBookingInPast(booking.instances);
  const isUnprocessedPast = isPastBookingUnprocessed(
    booking.instances,
    booking.status as BookingStatus | undefined
  );

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
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold text-white truncate">
              {booking.title}
            </h3>
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
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>{booking.side.name}</span>
            {firstDate && lastDate && (
              <span>
                {format(firstDate, 'MMM d')} - {format(lastDate, 'MMM d, yyyy')}
              </span>
            )}
            <span>
              {totalInstances} session{totalInstances !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

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
          <div className="text-slate-500 mb-1">Time</div>
          <div className="text-slate-300">
            {firstInstance
              ? `${format(parseISO(firstInstance.start), 'HH:mm')} - ${format(parseISO(firstInstance.end), 'HH:mm')}`
              : 'N/A'}
          </div>
          {nextInstance && isNextInstanceFuture && (
            <div className="text-xs text-slate-500 mt-1">
              Next: {format(parseISO(nextInstance.start), 'MMM d, HH:mm')}
            </div>
          )}
          {bookingIsPast && (
            <div className="text-xs text-slate-500 mt-1">
              All sessions completed
            </div>
          )}
        </div>
        <div>
          <div className="text-slate-500 mb-1">Capacity</div>
          <div className="text-slate-300">
            {avgCapacity} athlete{avgCapacity !== 1 ? 's' : ''} avg
          </div>
        </div>
        <div>
          <div className="text-slate-500 mb-1">Racks</div>
          <div className="text-slate-300">
            {racksList.length > 0 ? racksList.join(', ') : 'None assigned'}
          </div>
        </div>
        <div>
          <div className="text-slate-500 mb-1">Created</div>
          <div className="text-slate-300">
            {format(parseISO(booking.created_at), 'MMM d, yyyy')}
          </div>
        </div>
        {/* Processing Status */}
        <div>
          <div className="text-slate-500 mb-1">Processing Status</div>
          <div className="text-slate-300">
            {booking.status === 'processed' && booking.processed_at
              ? `Processed on ${format(parseISO(booking.processed_at), 'MMM d, yyyy')}`
              : booking.status === 'pending'
                ? 'Pending processing'
                : booking.status === 'draft'
                  ? 'Draft'
                  : booking.status || 'Unknown'}
          </div>
        </div>
        {booking.processed_at && (
          <div>
            <div className="text-slate-500 mb-1">Processed At</div>
            <div className="text-slate-300">
              {format(parseISO(booking.processed_at), 'MMM d, yyyy HH:mm')}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {liveViewUrl && (
          <Link
            to={liveViewUrl}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors"
            title={
              isNextInstanceFuture
                ? `View next session on ${format(parseISO(nextInstance.start), 'MMM d, yyyy')}`
                : 'View session'
            }
          >
            {isNextInstanceFuture ? 'View Next Session' : 'View Session'}
          </Link>
        )}
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(booking)}
            className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
          >
            Edit
          </button>
        )}
        {onExtend && (
          <button
            type="button"
            onClick={() => onExtend(booking)}
            className="px-3 py-1.5 text-sm bg-green-700 hover:bg-green-600 text-white rounded-md transition-colors"
          >
            Extend
          </button>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(booking)}
            className="px-3 py-1.5 text-sm bg-red-700 hover:bg-red-600 text-white rounded-md transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
