// Edge Function: Export Activity Logs as CSV
// Provides CSV export of activity logs with authorization and filtering
//
// Usage: Called from admin UI to export activity logs
// Security: Requires authentication, enforces RLS policies (users can see their org's activity)
// Limits: Hard cap of 10,000 rows to prevent abuse

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

const MAX_EXPORT_ROWS = 10000; // Hard cap to prevent abuse

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

interface EnrichedActivityLogRow extends ActivityLogRow {
  organization_name?: string | null;
  site_name?: string | null;
  actor_user_name?: string | null;
  subject_user_name?: string | null;
}

// Escape CSV field (handles quotes, commas, newlines)
function escapeCsvField(field: unknown): string {
  if (field === null || field === undefined) {
    return '';
  }

  const str = typeof field === 'string' ? field : JSON.stringify(field);

  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

// Convert activity log rows to CSV with enriched data
function generateCsv(rows: EnrichedActivityLogRow[]): string {
  // CSV header with human-readable columns
  const headers = [
    'created_at',
    'event_type',
    'organization_id',
    'organization_name',
    'site_id',
    'site_name',
    'actor_user_id',
    'actor_user_name',
    'subject_user_id',
    'subject_user_name',
    'entity_type',
    'entity_id',
    'old_value',
    'new_value',
    'metadata',
  ];

  // Build CSV rows
  const csvRows = rows.map((row) => {
    return [
      escapeCsvField(row.created_at),
      escapeCsvField(row.event_type),
      escapeCsvField(row.organization_id),
      escapeCsvField(row.organization_name || ''),
      escapeCsvField(row.site_id),
      escapeCsvField(row.site_name || ''),
      escapeCsvField(row.actor_user_id),
      escapeCsvField(row.actor_user_name || ''),
      escapeCsvField(row.subject_user_id),
      escapeCsvField(row.subject_user_name || ''),
      escapeCsvField(row.entity_type),
      escapeCsvField(row.entity_id),
      escapeCsvField(row.old_value ? JSON.stringify(row.old_value) : null),
      escapeCsvField(row.new_value ? JSON.stringify(row.new_value) : null),
      escapeCsvField(row.metadata ? JSON.stringify(row.metadata) : null),
    ].join(',');
  });

  // Combine header and rows
  return [headers.join(','), ...csvRows].join('\n');
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

    // Parse optional filters (same as get-activity-logs)
    const actorUserId = url.searchParams.get('actorUserId') || undefined;
    const eventType = url.searchParams.get('eventType') || undefined;
    const dateFrom = url.searchParams.get('dateFrom') || undefined;
    const dateTo = url.searchParams.get('dateTo') || undefined;
    const siteIdParam = url.searchParams.get('siteId');
    const siteId = siteIdParam ? parseInt(siteIdParam, 10) : undefined;
    const search = url.searchParams.get('search') || undefined;

    // Build query (same logic as get-activity-logs but with higher limit)
    let query = supabaseClient
      .from('activity_log')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(MAX_EXPORT_ROWS + 1); // Fetch one extra to check if we hit the limit

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

    // Check if we hit the limit
    if (data && data.length > MAX_EXPORT_ROWS) {
      return new Response(
        JSON.stringify({
          error: `Export limit exceeded. Maximum ${MAX_EXPORT_ROWS} rows allowed. Please apply additional filters to reduce the result set.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Apply search filter if provided
    let filteredData = data || [];
    if (search && filteredData.length > 0) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter((row) => {
        const metadataStr = JSON.stringify(row.metadata || {}).toLowerCase();
        const entityIdStr = (row.entity_id || '').toLowerCase();
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

    // Enrich data with organization names, site names, and user names
    // Batch fetch to optimize performance
    const rows = filteredData as ActivityLogRow[];

    // Collect unique IDs
    const orgIds = new Set<number>();
    const siteIds = new Set<number>();
    const userIds = new Set<string>();

    rows.forEach((row) => {
      if (row.organization_id) orgIds.add(row.organization_id);
      if (row.site_id) siteIds.add(row.site_id);
      if (row.actor_user_id) userIds.add(row.actor_user_id);
      if (row.subject_user_id) userIds.add(row.subject_user_id);
    });

    // Batch fetch organizations
    const orgMap = new Map<number, string>();
    if (orgIds.size > 0) {
      const { data: orgs } = await supabaseClient
        .from('organizations')
        .select('id, name')
        .in('id', Array.from(orgIds));
      orgs?.forEach((org) => {
        orgMap.set(org.id, org.name);
      });
    }

    // Batch fetch sites
    const siteMap = new Map<number, string>();
    if (siteIds.size > 0) {
      const { data: sites } = await supabaseClient
        .from('sites')
        .select('id, name')
        .in('id', Array.from(siteIds));
      sites?.forEach((site) => {
        siteMap.set(site.id, site.name);
      });
    }

    // Batch fetch user profiles
    const userMap = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(userIds));
      profiles?.forEach((profile) => {
        userMap.set(profile.id, profile.full_name || '');
      });
    }

    // Enrich rows with fetched data
    const enrichedData: EnrichedActivityLogRow[] = rows.map((row) => ({
      ...row,
      organization_name: row.organization_id
        ? orgMap.get(row.organization_id) || null
        : null,
      site_name: row.site_id ? siteMap.get(row.site_id) || null : null,
      actor_user_name: row.actor_user_id
        ? userMap.get(row.actor_user_id) || null
        : null,
      subject_user_name: row.subject_user_id
        ? userMap.get(row.subject_user_id) || null
        : null,
    }));

    // Generate CSV
    const csv = generateCsv(enrichedData);

    // Generate filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5);
    const filename = `activity-logs-${timestamp}.csv`;

    // Return CSV file
    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error in export-activity-logs-csv function:', error);
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
