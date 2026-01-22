// Client-side utility for logging activity events
// Calls the log-activity Edge Function

import { supabase } from './supabaseClient';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

export interface ActivityEventParams {
  organizationId: number;
  eventType: string;
  entityType: string;
  siteId?: number | null;
  entityId?: string | null;
  actorUserId?: string | null;
  subjectUserId?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Logs an activity event from client-side code
 * This is a fail-open function: it will never throw errors that could break
 * the calling operation. If activity logging fails, it silently fails.
 *
 * @param params - Activity event parameters
 * @returns The activity log ID if successful, null if failed (fail-open)
 */
export async function logActivity(
  params: ActivityEventParams
): Promise<string | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      console.warn('[activity] No session, skipping activity log');
      return null;
    }

    // Call Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/log-activity`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: 'Failed to log activity',
      }));
      console.error('[activity] Failed to log activity event:', error);
      return null;
    }

    const data = await response.json();
    return data.activityId || null;
  } catch (error) {
    // Fail-open: never throw, just log and return null
    console.error('[activity] Unexpected error logging activity event:', error);
    return null;
  }
}

/**
 * Helper functions for common activity event patterns
 */
export const ActivityLogger = {
  /**
   * Log booking-related events
   */
  booking: {
    created: (
      organizationId: number,
      siteId: number,
      actorUserId: string,
      bookingId: number,
      metadata?: Record<string, unknown>
    ) =>
      logActivity({
        organizationId,
        siteId,
        eventType: 'booking.created',
        entityType: 'booking',
        entityId: null, // bookings.id is bigint, not uuid - store in metadata instead
        actorUserId,
        metadata: {
          booking_id: bookingId,
          ...metadata,
        },
      }),

    updated: (
      organizationId: number,
      siteId: number,
      actorUserId: string,
      bookingId: number,
      oldValue: Record<string, unknown>,
      newValue: Record<string, unknown>,
      metadata?: Record<string, unknown>
    ) =>
      logActivity({
        organizationId,
        siteId,
        eventType: 'booking.updated',
        entityType: 'booking',
        entityId: null, // bookings.id is bigint, not uuid - store in metadata instead
        actorUserId,
        oldValue,
        newValue,
        metadata: {
          booking_id: bookingId,
          ...metadata,
        },
      }),

    approved: (
      organizationId: number,
      siteId: number,
      actorUserId: string,
      bookingId: number,
      subjectUserId?: string | null,
      metadata?: Record<string, unknown>
    ) =>
      logActivity({
        organizationId,
        siteId,
        eventType: 'booking.approved',
        entityType: 'booking',
        entityId: null, // bookings.id is bigint, not uuid - store in metadata instead
        actorUserId,
        subjectUserId: subjectUserId || undefined,
        metadata: {
          booking_id: bookingId,
          ...metadata,
        },
      }),

    rejected: (
      organizationId: number,
      siteId: number,
      actorUserId: string,
      bookingId: number,
      subjectUserId: string,
      metadata?: Record<string, unknown>
    ) =>
      logActivity({
        organizationId,
        siteId,
        eventType: 'booking.rejected',
        entityType: 'booking',
        entityId: null, // bookings.id is bigint, not uuid - store in metadata instead
        actorUserId,
        subjectUserId,
        metadata: {
          booking_id: bookingId,
          ...metadata,
        },
      }),

    cancellationRequested: (
      organizationId: number,
      siteId: number,
      actorUserId: string,
      bookingId: number,
      metadata?: Record<string, unknown>
    ) =>
      logActivity({
        organizationId,
        siteId,
        eventType: 'booking.cancellation_requested',
        entityType: 'booking',
        entityId: null, // bookings.id is bigint, not uuid - store in metadata instead
        actorUserId,
        metadata: {
          booking_id: bookingId,
          ...metadata,
        },
      }),

    cancellationConfirmed: (
      organizationId: number,
      siteId: number,
      actorUserId: string,
      bookingId: number,
      metadata?: Record<string, unknown>
    ) =>
      logActivity({
        organizationId,
        siteId,
        eventType: 'booking.cancellation_confirmed',
        entityType: 'booking',
        entityId: null, // bookings.id is bigint, not uuid - store in metadata instead
        actorUserId,
        metadata: {
          booking_id: bookingId,
          ...metadata,
        },
      }),

    cancelled: (
      organizationId: number,
      siteId: number,
      actorUserId: string,
      bookingId: number,
      metadata?: Record<string, unknown>
    ) =>
      logActivity({
        organizationId,
        siteId,
        eventType: 'booking.cancelled',
        entityType: 'booking',
        entityId: null, // bookings.id is bigint, not uuid - store in metadata instead
        actorUserId,
        metadata: {
          booking_id: bookingId,
          ...metadata,
        },
      }),

    deleted: (
      organizationId: number,
      siteId: number,
      actorUserId: string,
      bookingId: number,
      metadata?: Record<string, unknown>
    ) =>
      logActivity({
        organizationId,
        siteId,
        eventType: 'booking.deleted',
        entityType: 'booking',
        entityId: null, // bookings.id is bigint, not uuid - store in metadata instead
        actorUserId,
        metadata: {
          booking_id: bookingId,
          ...metadata,
        },
      }),
  },
};
