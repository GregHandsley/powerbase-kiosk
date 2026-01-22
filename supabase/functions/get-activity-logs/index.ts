// Edge Function: Get Activity Logs (server-only)
// Provides read access to activity logs with authorization and filtering
//
// Usage: Called from UI to view activity logs
// Security: Requires authentication, enforces RLS policies (users can see their org's activity)

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-expect-error: Remote Deno std import is resolved at runtime/deploy time
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error: Remote Supabase client import is resolved at runtime/deploy time
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

interface ActivityLogRow {
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

interface GetActivityLogsResponse {
  rows: ActivityLogRow[];
  nextCursor: {
    created_at: string;
    id: string;
  } | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify user is authenticated
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse query parameters
    const url = new URL(req.url);
    const organizationId = url.searchParams.get('organizationId');
    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'organizationId is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const orgId = parseInt(organizationId, 10);
    if (isNaN(orgId)) {
      return new Response(JSON.stringify({ error: 'Invalid organizationId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // RLS policies will handle authorization automatically
    // Users can only see activity logs for organizations they belong to
    // or where they are the actor/subject

    // Parse optional filters
    const actorUserId = url.searchParams.get('actorUserId') || undefined;
    const eventType = url.searchParams.get('eventType') || undefined;
    const dateFrom = url.searchParams.get('dateFrom') || undefined;
    const dateTo = url.searchParams.get('dateTo') || undefined;
    const siteIdParam = url.searchParams.get('siteId');
    const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined;
    const search = url.searchParams.get('search') || undefined;
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const cursorCreatedAt =
      url.searchParams.get('cursorCreatedAt') || undefined;
    const cursorId = url.searchParams.get('cursorId') || undefined;

    // Validate limit
    if (limit < 1 || limit > 100) {
      return new Response(
        JSON.stringify({ error: 'Limit must be between 1 and 100' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Build query
    let query = supabaseClient
      .from('activity_log')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1); // Fetch one extra to determine if there's a next page

    // Apply filters
    if (actorUserId) {
      query = query.eq('actor_user_id', actorUserId);
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    if (siteId !== undefined) {
      query = query.eq('site_id', siteId);
    }

    // Cursor-based pagination
    // For stable ordering: created_at DESC, id DESC
    // Cursor: get rows where (created_at < cursorCreatedAt) OR (created_at = cursorCreatedAt AND id < cursorId)
    if (cursorCreatedAt && cursorId) {
      // PostgREST doesn't support complex OR with AND, so we'll filter client-side after fetching
      // Alternatively, we can use a raw SQL query, but for now, fetch slightly more and filter
      // This is acceptable since we're already limiting the result set
      query = query.lte('created_at', cursorCreatedAt);
    }

    // Execute query
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching activity logs:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch activity logs' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Apply cursor filtering and search
    let filteredData = data || [];

    // Apply cursor filter (if cursor provided)
    if (cursorCreatedAt && cursorId && filteredData.length > 0) {
      filteredData = filteredData.filter((row) => {
        const rowCreatedAt = new Date(row.created_at).toISOString();
        const cursorDate = new Date(cursorCreatedAt).toISOString();

        // (created_at < cursorCreatedAt) OR (created_at = cursorCreatedAt AND id < cursorId)
        if (rowCreatedAt < cursorDate) {
          return true;
        }
        if (rowCreatedAt === cursorDate && row.id < cursorId) {
          return true;
        }
        return false;
      });
    }

    // Apply search filter
    if (search && filteredData.length > 0) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter((row) => {
        // Search in metadata (as JSON string)
        const metadataStr = JSON.stringify(row.metadata || {}).toLowerCase();
        // Search in entity_id
        const entityIdStr = (row.entity_id || '').toLowerCase();
        // Search in event_type and entity_type
        const eventTypeStr = (row.event_type || '').toLowerCase();
        const entityTypeStr = (row.entity_type || '').toLowerCase();

        return (
          metadataStr.includes(searchLower) ||
          entityIdStr.includes(searchLower) ||
          eventTypeStr.includes(searchLower) ||
          entityTypeStr.includes(searchLower)
        );
      });
    }

    // Determine if there's a next page
    const hasNextPage = filteredData.length > limit;
    const rows = hasNextPage ? filteredData.slice(0, limit) : filteredData;

    // Build next cursor
    let nextCursor: GetActivityLogsResponse['nextCursor'] = null;
    if (hasNextPage && rows.length > 0) {
      const lastRow = rows[rows.length - 1];
      nextCursor = {
        created_at: lastRow.created_at,
        id: lastRow.id,
      };
    }

    const response: GetActivityLogsResponse = {
      rows: rows as ActivityLogRow[],
      nextCursor,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in get-activity-logs function:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
