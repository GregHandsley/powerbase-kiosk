// Edge Function: Cleanup Log Retention
// Scheduled job to delete old audit_log and activity_log entries based on retention policy
//
// Usage: Can be called manually or scheduled via Supabase cron
// Security: Requires service role key (should not be called from client)
// Policy: Default 90 days retention, per-org override in organizations.settings.auditRetentionDays

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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface CleanupResult {
  organization_id: number;
  audit_logs_deleted: number;
  activity_logs_deleted: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  // Only allow POST requests (for scheduled jobs)
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Initialize Supabase client with service role key
    // This function should only be called with service role credentials
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Missing Supabase configuration' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Use service role client to bypass RLS
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Call the cleanup function
    const { data, error } = await supabaseClient.rpc('cleanup_all_logs');

    if (error) {
      console.error('Error cleaning up logs:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to cleanup logs',
          details: error.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const results = (data as CleanupResult[]) || [];

    // Calculate totals
    const totalAuditDeleted = results.reduce(
      (sum, r) => sum + Number(r.audit_logs_deleted || 0),
      0
    );
    const totalActivityDeleted = results.reduce(
      (sum, r) => sum + Number(r.activity_logs_deleted || 0),
      0
    );

    console.log(
      `[cleanup-log-retention] Cleaned up ${totalAuditDeleted} audit logs and ${totalActivityDeleted} activity logs across ${results.length} organizations`
    );

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          organizations_processed: results.length,
          audit_logs_deleted: totalAuditDeleted,
          activity_logs_deleted: totalActivityDeleted,
        },
        details: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in cleanup-log-retention function:', error);
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
