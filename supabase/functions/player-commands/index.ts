// Edge Function: Player commands poll
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-expect-error: Remote Deno std import is resolved at runtime/deploy time
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error: Remote Supabase client import is resolved at runtime/deploy time
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { CommandsResponse } from '../_shared/playerAgentTypes.ts';
import { validateDeviceAuth } from '../_shared/deviceAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(req.url);
  const deviceId = url.searchParams.get('device_id');
  const deviceToken = url.searchParams.get('device_token');

  if (!deviceId || !deviceToken) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

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

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const authResult = await validateDeviceAuth(
    deviceId,
    deviceToken,
    supabaseAdmin
  );

  if (!authResult.ok) {
    return new Response(JSON.stringify(authResult.body), {
      status: authResult.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const device = authResult.device;

  const { data: commands, error: commandsError } = await supabaseAdmin
    .from('player_commands')
    .select(
      'id, player_id, type, payload_json, status, created_at, ack_at, error'
    )
    .eq('player_id', device.player_id)
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(20);

  if (commandsError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch commands' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const commandIds = (commands ?? []).map((command) => command.id);
  if (commandIds.length > 0) {
    await supabaseAdmin
      .from('player_commands')
      .update({ status: 'running' })
      .in('id', commandIds);
  }

  const response: CommandsResponse = {
    commands:
      commands?.map((command) => ({
        id: command.id,
        player_id: command.player_id,
        type: command.type,
        payload: command.payload_json,
        status: command.status,
        created_at: command.created_at,
        ack_at: command.ack_at ?? null,
        error: command.error ?? null,
      })) ?? [],
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
