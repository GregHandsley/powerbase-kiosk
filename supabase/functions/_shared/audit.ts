// Shared audit logging utility for Edge Functions
// Provides a fail-open wrapper around log_audit_event DB function
// Normalizes event naming and ensures metadata is JSON-safe

// @ts-expect-error: Remote Supabase client import is resolved at runtime/deploy time
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export interface AuditEventParams {
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
 * Logs an audit event to the audit_log table
 *
 * This is a fail-open function: it will never throw errors that could break
 * the calling operation. If audit logging fails, it silently fails.
 *
 * @param params - Audit event parameters
 * @returns The audit log ID if successful, null if failed (fail-open)
 */
export async function logAuditEvent(
  params: AuditEventParams
): Promise<string | null> {
  try {
    // Get Supabase service role client (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn(
        '[audit] Missing Supabase configuration, skipping audit log'
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
    // Format: entity.action (e.g., "invitation.created", "role.updated")
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
    const { data, error } = await supabaseAdmin.rpc('log_audit_event', {
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
      console.error('[audit] Failed to log audit event:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    // Fail-open: never throw, just log and return null
    console.error('[audit] Unexpected error logging audit event:', error);
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
    console.warn('[audit] Failed to sanitize JSON, using empty object:', error);
    return {};
  }
}

/**
 * Helper to create common audit event patterns
 */
export const AuditEvents = {
  /**
   * Log invitation-related events
   */
  invitation: {
    created: (
      organizationId: number,
      actorUserId: string,
      invitationId: number,
      metadata?: Record<string, unknown>
    ) =>
      logAuditEvent({
        organizationId,
        eventType: 'invitation.created',
        entityType: 'invitation',
        entityId: null, // invitations.id is bigint, not uuid - store in metadata instead
        actorUserId,
        metadata: {
          invitation_id: invitationId,
          ...metadata,
        },
      }),

    accepted: (
      organizationId: number,
      subjectUserId: string,
      invitationId: number,
      metadata?: Record<string, unknown>,
      actorUserId?: string | null
    ) =>
      logAuditEvent({
        organizationId,
        eventType: 'invitation.accepted',
        entityType: 'invitation',
        entityId: null, // invitations.id is bigint, not uuid - store in metadata instead
        actorUserId: actorUserId || null, // The person who created the invitation
        subjectUserId, // The person accepting the invitation
        metadata: {
          invitation_id: invitationId,
          ...metadata,
        },
      }),

    revoked: (
      organizationId: number,
      actorUserId: string,
      invitationId: number,
      metadata?: Record<string, unknown>
    ) =>
      logAuditEvent({
        organizationId,
        eventType: 'invitation.revoked',
        entityType: 'invitation',
        entityId: null, // invitations.id is bigint, not uuid - store in metadata instead
        actorUserId,
        metadata: {
          invitation_id: invitationId,
          ...metadata,
        },
      }),

    deleted: (
      organizationId: number,
      actorUserId: string,
      invitationId: number,
      metadata?: Record<string, unknown>
    ) =>
      logAuditEvent({
        organizationId,
        eventType: 'invitation.deleted',
        entityType: 'invitation',
        entityId: null, // invitations.id is bigint, not uuid - store in metadata instead
        actorUserId,
        metadata: {
          invitation_id: invitationId,
          ...metadata,
        },
      }),
  },

  /**
   * Log role/permission-related events
   */
  role: {
    updated: (
      organizationId: number,
      actorUserId: string,
      subjectUserId: string,
      oldRole: string,
      newRole: string,
      metadata?: Record<string, unknown>
    ) =>
      logAuditEvent({
        organizationId,
        eventType: 'role.updated',
        entityType: 'organization_membership',
        subjectUserId,
        actorUserId,
        oldValue: { role: oldRole },
        newValue: { role: newRole },
        metadata,
      }),
  },

  /**
   * Log permission-related events
   */
  permission: {
    granted: (
      organizationId: number,
      actorUserId: string,
      role: string,
      permissionKey: string,
      metadata?: Record<string, unknown>
    ) =>
      logAuditEvent({
        organizationId,
        eventType: 'permission.granted',
        entityType: 'role_permission',
        actorUserId,
        metadata: {
          role,
          permission_key: permissionKey,
          ...metadata,
        },
      }),

    revoked: (
      organizationId: number,
      actorUserId: string,
      role: string,
      permissionKey: string,
      metadata?: Record<string, unknown>
    ) =>
      logAuditEvent({
        organizationId,
        eventType: 'permission.revoked',
        entityType: 'role_permission',
        actorUserId,
        metadata: {
          role,
          permission_key: permissionKey,
          ...metadata,
        },
      }),
  },

  /**
   * Log site membership events
   */
  siteMembership: {
    created: (
      organizationId: number,
      siteId: number,
      actorUserId: string,
      subjectUserId: string,
      metadata?: Record<string, unknown>
    ) =>
      logAuditEvent({
        organizationId,
        siteId,
        eventType: 'site_membership.created',
        entityType: 'site_membership',
        actorUserId,
        subjectUserId,
        metadata,
      }),

    deleted: (
      organizationId: number,
      siteId: number,
      actorUserId: string,
      subjectUserId: string,
      metadata?: Record<string, unknown>
    ) =>
      logAuditEvent({
        organizationId,
        siteId,
        eventType: 'site_membership.deleted',
        entityType: 'site_membership',
        actorUserId,
        subjectUserId,
        metadata,
      }),
  },

  /**
   * Log organization/site settings changes
   */
  settings: {
    updated: (
      organizationId: number,
      actorUserId: string,
      entityType: 'organization' | 'site',
      entityId: number,
      oldSettings: Record<string, unknown>,
      newSettings: Record<string, unknown>,
      metadata?: Record<string, unknown>
    ) =>
      logAuditEvent({
        organizationId,
        siteId: entityType === 'site' ? entityId : undefined,
        eventType: 'settings.updated',
        entityType,
        entityId: entityId.toString(),
        actorUserId,
        oldValue: oldSettings,
        newValue: newSettings,
        metadata,
      }),
  },
};
