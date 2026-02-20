import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Modal } from '../shared/Modal';
import { supabase } from '../../lib/supabaseClient';
import { getUserNamesByIds } from '../../utils/emailRecipients';
import type { BookingWithInstances } from '../../hooks/useMyBookings';

type Props = {
  booking: BookingWithInstances | null;
  isOpen: boolean;
  onClose: () => void;
};

type ActivityLogEvent = {
  id: string;
  created_at: string;
  event_type: string;
  actor_user_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

type TimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  actorUserId: string | null;
  source: 'activity' | 'fallback';
};

function formatEventTitle(eventType: string): string {
  const map: Record<string, string> = {
    'booking.created': 'Booking Created',
    'booking.updated': 'Booking Edited',
    'booking.approved': 'Booking Processed',
    'booking.rejected': 'Booking Rejected',
    'booking.cancellation_requested': 'Cancellation Requested',
    'booking.cancellation_confirmed': 'Cancellation Processed',
    'booking.cancelled': 'Booking Cancelled',
    'booking.deleted': 'Booking Deleted',
  };
  return (
    map[eventType] ||
    eventType
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function formatFieldLabel(field: string): string {
  const map: Record<string, string> = {
    start: 'Start time',
    end: 'End time',
    capacity: 'Athletes',
    racks: 'Racks',
    status: 'Status',
    booking_type: 'Booking Type',
    squad_id: 'Squad',
    display_name: 'Display Name',
    title: 'Title',
    color: 'Color',
  };
  return (
    map[field] ||
    field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'None';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (value === 'catalogue') return 'Catalogue';
    if (value === 'one_off') return 'One-off';
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed) && value.includes('T')) {
      return format(new Date(parsed), 'EEE d MMM yyyy, HH:mm');
    }
    return value;
  }
  return JSON.stringify(value);
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function buildChangeSummary(
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null
): string | undefined {
  if (!oldValue && !newValue) return undefined;

  const oldObj = oldValue ?? {};
  const newObj = newValue ?? {};
  const ignored = new Set([
    'updated_at',
    'last_edited_at',
    'last_edited_by',
    'processed_snapshot',
  ]);
  const keys = Array.from(
    new Set([...Object.keys(oldObj), ...Object.keys(newObj)])
  );
  const changes = keys
    .filter((key) => !ignored.has(key))
    .filter((key) => !valuesEqual(oldObj[key], newObj[key]))
    .map((key) => {
      const before =
        key === 'capacity' && typeof oldObj[key] === 'number'
          ? `${oldObj[key]} athlete${oldObj[key] === 1 ? '' : 's'}`
          : formatValue(oldObj[key]);
      const after =
        key === 'capacity' && typeof newObj[key] === 'number'
          ? `${newObj[key]} athlete${newObj[key] === 1 ? '' : 's'}`
          : formatValue(newObj[key]);
      return `${formatFieldLabel(key)}: ${before} -> ${after}`;
    });

  if (changes.length === 0) return undefined;
  return changes.slice(0, 4).join(' | ');
}

function formatEventDetail(event: ActivityLogEvent): string | undefined {
  const metadata = event.metadata ?? {};
  if (event.event_type === 'booking.updated') {
    if (metadata.action === 'extended') {
      const weeks = metadata.weeks_added;
      return typeof weeks === 'number'
        ? `Extended by ${weeks} week${weeks === 1 ? '' : 's'}`
        : 'Booking details were updated';
    }
    if (metadata.action === 'instances_deleted') {
      return 'Some sessions in this series were removed';
    }
    return (
      buildChangeSummary(event.old_value, event.new_value) ||
      'Booking details were updated'
    );
  }
  if (event.event_type === 'booking.approved') {
    return 'Booking was processed by Sports Bookings';
  }
  if (event.event_type === 'booking.cancellation_confirmed') {
    return 'Cancellation processed by Sports Bookings';
  }
  if (event.event_type === 'booking.cancelled') {
    return undefined;
  }
  if (event.event_type === 'booking.cancellation_requested') {
    const mode = metadata.cancel_mode;
    if (typeof mode === 'string') {
      const modeLabel =
        mode === 'single'
          ? 'this session only'
          : mode === 'future'
            ? 'this and future sessions'
            : mode === 'all'
              ? 'all sessions'
              : mode;
      const cancelledCount = metadata.instances_cancelled;
      const totalCount = metadata.total_instances;
      if (
        typeof cancelledCount === 'number' &&
        typeof totalCount === 'number'
      ) {
        return `Requested cancellation for ${modeLabel} (${cancelledCount}/${totalCount} sessions)`;
      }
      return `Requested cancellation for ${modeLabel}`;
    }
  }
  return undefined;
}

export function BookingLifecycleModal({ booking, isOpen, onClose }: Props) {
  const bookingId = booking?.id ?? null;

  const { data: activityEvents = [], isLoading: loadingEvents } = useQuery({
    queryKey: ['booking-lifecycle', bookingId],
    queryFn: async () => {
      if (!bookingId) return [] as ActivityLogEvent[];

      // bookings.id is bigint while activity_log.entity_id is uuid.
      // Booking activity is keyed via metadata.booking_id.
      const { data, error } = await supabase
        .from('activity_log')
        .select(
          'id, created_at, event_type, actor_user_id, old_value, new_value, metadata'
        )
        .eq('entity_type', 'booking')
        .filter('metadata->>booking_id', 'eq', String(bookingId))
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to fetch booking lifecycle events:', error);
        return [] as ActivityLogEvent[];
      }

      return (data ?? []) as ActivityLogEvent[];
    },
    enabled: isOpen && !!bookingId,
  });

  const timelineEvents = useMemo(() => {
    if (!booking) return [] as TimelineEvent[];

    const events: TimelineEvent[] = [];
    let hasBeenProcessed = false;
    let hasEditSinceLastProcess = false;
    let hasPendingCancellation = false;

    for (const event of activityEvents) {
      let title = formatEventTitle(event.event_type);
      let detail = formatEventDetail(event);

      if (event.event_type === 'booking.updated') {
        if (hasBeenProcessed) {
          title = 'Edit Requested';
        }
        hasEditSinceLastProcess = true;
      }

      if (event.event_type === 'booking.approved') {
        if (hasBeenProcessed || hasEditSinceLastProcess) {
          title = 'Edit Processed';
          detail = 'Booking edit was processed by Sports Bookings';
        }
        hasBeenProcessed = true;
        hasEditSinceLastProcess = false;
      }

      if (event.event_type === 'booking.cancellation_requested') {
        hasPendingCancellation = true;
      }

      if (event.event_type === 'booking.cancellation_confirmed') {
        title = 'Cancellation Processed';
        detail = 'Cancellation processed by Sports Bookings';
        hasPendingCancellation = false;
      }

      if (event.event_type === 'booking.cancelled') {
        if (hasPendingCancellation) {
          title = 'Cancellation Processed';
          detail = 'Booking is now cancelled';
          hasPendingCancellation = false;
        } else {
          title = 'Booking Cancelled';
          detail = 'Cancelled immediately';
        }
      }

      events.push({
        id: `activity-${event.id}`,
        at: event.created_at,
        title,
        detail,
        actorUserId: event.actor_user_id,
        source: 'activity',
      });
    }

    // Fallback milestones: keep these minimal once real activity exists,
    // so timeline entries don't reshuffle when mutable booking columns change.
    const hasAnyActivity = activityEvents.length > 0;
    const hasCreated = activityEvents.some(
      (e) => e.event_type === 'booking.created'
    );
    if (!hasCreated) {
      events.push({
        id: 'fallback-created',
        at: booking.created_at,
        title: 'Booking Created',
        actorUserId: booking.created_by,
        source: 'fallback',
      });
    }

    if (!hasAnyActivity) {
      if (booking.processed_at) {
        events.push({
          id: 'fallback-processed',
          at: booking.processed_at,
          title: 'Booking Processed',
          actorUserId: booking.processed_by,
          source: 'fallback',
        });
      }

      if (booking.last_edited_at) {
        events.push({
          id: 'fallback-edited',
          at: booking.last_edited_at,
          title: 'Booking Edited',
          actorUserId: booking.last_edited_by,
          source: 'fallback',
        });
      }

      if (booking.status === 'pending_cancellation') {
        events.push({
          id: 'fallback-cancel-requested',
          at:
            booking.last_edited_at || booking.updated_at || booking.created_at,
          title: 'Cancellation Requested',
          detail: 'Booking is currently pending formal cancellation.',
          actorUserId: booking.last_edited_by || booking.processed_by,
          source: 'fallback',
        });
      }
      if (booking.status === 'cancelled') {
        events.push({
          id: 'fallback-cancelled',
          at:
            booking.last_edited_at || booking.updated_at || booking.created_at,
          title: 'Booking Cancelled',
          actorUserId: booking.last_edited_by || booking.processed_by,
          source: 'fallback',
        });
      }
    }

    return events.sort(
      (a, b) => parseISO(a.at).getTime() - parseISO(b.at).getTime()
    );
  }, [activityEvents, booking]);

  const { data: actorNames = new Map<string, string>() } = useQuery({
    queryKey: [
      'booking-lifecycle-actors',
      timelineEvents
        .map((e) => e.actorUserId)
        .filter(Boolean)
        .join(','),
    ],
    queryFn: async () => {
      const ids = Array.from(
        new Set(
          timelineEvents
            .map((event) => event.actorUserId)
            .filter((id): id is string => Boolean(id))
        )
      );
      return getUserNamesByIds(ids);
    },
    enabled: isOpen && timelineEvents.length > 0,
  });

  if (!booking) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="2xl" lockScroll>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Booking Lifecycle
            </h2>
            <p className="text-sm text-slate-400 mt-1">{booking.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md bg-slate-800 hover:bg-slate-700 text-slate-100"
          >
            Close
          </button>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-4 max-h-[60vh] overflow-y-auto">
          {loadingEvents ? (
            <p className="text-sm text-slate-400">Loading lifecycle...</p>
          ) : timelineEvents.length === 0 ? (
            <p className="text-sm text-slate-400">
              No lifecycle events found for this booking.
            </p>
          ) : (
            <ol className="space-y-3">
              {timelineEvents.map((event) => {
                const actorName =
                  (event.actorUserId && actorNames.get(event.actorUserId)) ||
                  (event.actorUserId
                    ? `${event.actorUserId.slice(0, 8)}...`
                    : 'System');

                return (
                  <li
                    key={event.id}
                    className="rounded-md border border-slate-700/70 bg-slate-900/60 p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-100">
                        {event.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {format(parseISO(event.at), 'EEE d MMM yyyy, HH:mm')}
                      </p>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      by <span className="text-slate-300">{actorName}</span> (
                      {formatDistanceToNow(parseISO(event.at), {
                        addSuffix: true,
                      })}
                      )
                    </p>
                    {event.detail && (
                      <p className="text-sm text-slate-300 mt-2">
                        {event.detail}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </Modal>
  );
}
