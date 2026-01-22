// Shared activity logging utility for Edge Functions
// Provides a fail-open wrapper around log_activity_event DB function
// Normalizes event naming and ensures metadata is JSON-safe

// @ts-expect-error: Remote Supabase client import is resolved at runtime/deploy time
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

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
 * Logs an activity event to the activity_log table
 *
 * This is a fail-open function: it will never throw errors that could break
 * the calling operation. If activity logging fails, it silently fails.
 *
 * @param params - Activity event parameters
 * @returns The activity log ID if successful, null if failed (fail-open)
 */
export async function logActivityEvent(
  params: ActivityEventParams
): Promise<string | null> {
  try {
    // Get Supabase service role client (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn(
        '[activity] Missing Supabase configuration, skipping activity log'
      );
      return null;
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Normalize event type (ensure consistent naming)
    // Format: entity.action (e.g., "booking.created", "booking.updated")
    const normalizedEventType = params.eventType
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // Normalize entity type (ensure consistent naming)
    const normalizedEntityType = params.entityType
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    // Ensure metadata is JSON-safe (remove circular refs, functions, etc.)
    const safeMetadata = sanitizeJson(params.metadata || {});

    // Ensure old_value and new_value are JSON-safe
    const safeOldValue = params.oldValue ? sanitizeJson(params.oldValue) : null;
    const safeNewValue = params.newValue ? sanitizeJson(params.newValue) : null;

    // Call the DB function
    const { data, error } = await supabaseAdmin.rpc('log_activity_event', {
      p_organization_id: params.organizationId,
      p_event_type: normalizedEventType,
      p_entity_type: normalizedEntityType,
      p_site_id: params.siteId ?? null,
      p_entity_id: params.entityId ?? null,
      p_actor_user_id: params.actorUserId ?? null,
      p_subject_user_id: params.subjectUserId ?? null,
      p_old_value: safeOldValue,
      p_new_value: safeNewValue,
      p_metadata: safeMetadata,
    });

    if (error) {
      console.error('[activity] Failed to log activity event:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    // Fail-open: never throw, just log and return null
    console.error('[activity] Unexpected error logging activity event:', error);
    return null;
  }
}

/**
 * Sanitizes an object to ensure it's JSON-safe
 * Removes circular references, functions, undefined values, etc.
 */
function sanitizeJson(obj: unknown): Record<string, unknown> | null {
  if (obj === null || obj === undefined) {
    return null;
  }

  try {
    // Use JSON.parse/stringify to remove circular refs and non-serializable values
    const jsonString = JSON.stringify(obj, (key, value) => {
      // Remove functions
      if (typeof value === 'function') {
        return undefined;
      }
      // Remove undefined (JSON.stringify already does this, but be explicit)
      if (value === undefined) {
        return undefined;
      }
      return value;
    });

    const parsed = JSON.parse(jsonString);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch (error) {
    console.warn(
      '[activity] Failed to sanitize JSON, using empty object:',
      error
    );
    return {};
  }
}

/**
 * Helper to create common activity event patterns
 */
export const ActivityEvents = {
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
      logActivityEvent({
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
      logActivityEvent({
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
      subjectUserId: string,
      metadata?: Record<string, unknown>
    ) =>
      logActivityEvent({
        organizationId,
        siteId,
        eventType: 'booking.approved',
        entityType: 'booking',
        entityId: null, // bookings.id is bigint, not uuid - store in metadata instead
        actorUserId,
        subjectUserId,
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
      logActivityEvent({
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
      logActivityEvent({
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
      logActivityEvent({
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
      logActivityEvent({
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
      logActivityEvent({
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
