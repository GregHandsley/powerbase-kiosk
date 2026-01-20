// Hook for fetching audit logs
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

export interface AuditLogRow {
  id: string;
  created_at: string;
  organization_id: number;
  site_id: number | null;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  actor_user_id: string | null;
  subject_user_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

export interface AuditLogFilters {
  organizationId: number;
  actorUserId?: string;
  eventType?: string;
  dateFrom?: string; // ISO 8601 date string
  dateTo?: string; // ISO 8601 date string
  siteId?: number;
  search?: string;
  limit?: number; // Default 50
}

export interface AuditLogResponse {
  rows: AuditLogRow[];
  nextCursor: {
    created_at: string;
    id: string;
  } | null;
}

/**
 * Hook to check if the current user can read audit logs for an organization
 */
export function useCanReadAudit(organizationId: number | null) {
  const {
    data: canRead = false,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['can-read-audit', organizationId],
    queryFn: async () => {
      if (!organizationId) return false;

      const { data, error: rpcError } = await supabase.rpc('can_read_audit', {
        p_org_id: organizationId,
      });

      if (rpcError) {
        console.error('Error checking can_read_audit:', rpcError);
        return false;
      }

      return data === true;
    },
    enabled: organizationId !== null,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return { canRead, isLoading, error };
}

/**
 * Hook to fetch audit logs with infinite query for pagination
 */
export function useAuditLogs(filters: AuditLogFilters) {
  return useInfiniteQuery({
    queryKey: ['audit-logs', filters],
    queryFn: async ({ pageParam }) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Not authenticated');
      }

      // Build query parameters
      const params = new URLSearchParams({
        organizationId: filters.organizationId.toString(),
      });

      if (filters.actorUserId) {
        params.append('actorUserId', filters.actorUserId);
      }
      if (filters.eventType) {
        params.append('eventType', filters.eventType);
      }
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo);
      }
      if (filters.siteId !== undefined) {
        params.append('siteId', filters.siteId.toString());
      }
      if (filters.search) {
        params.append('search', filters.search);
      }
      if (filters.limit) {
        params.append('limit', filters.limit.toString());
      }

      // Add cursor for pagination
      if (pageParam) {
        params.append('cursorCreatedAt', pageParam.created_at);
        params.append('cursorId', pageParam.id);
      }

      // Call Edge Function
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/get-audit-logs?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({
          error: 'Failed to fetch audit logs',
        }));
        throw new Error(error.error || 'Failed to fetch audit logs');
      }

      const data: AuditLogResponse = await response.json();
      return data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: null as { created_at: string; id: string } | null,
    enabled: !!filters.organizationId,
  });
}
