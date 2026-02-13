// Edge Function: Player heartbeat
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-expect-error: Remote Deno std import is resolved at runtime/deploy time
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error: Remote Supabase client import is resolved at runtime/deploy time
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type {
  HeartbeatRequest,
  HeartbeatResponse,
} from '../_shared/playerAgentTypes.ts';
import { validateDeviceAuth } from '../_shared/deviceAuth.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = (await req.json().catch(() => null)) as HeartbeatRequest | null;

  if (!body?.device_id || !body?.device_token) {
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
    body.device_id,
    body.device_token,
    supabaseAdmin
  );

  if (!authResult.ok) {
    return new Response(JSON.stringify(authResult.body), {
      status: authResult.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const device = authResult.device;

  const { data: fullDevice } = await supabaseAdmin
    .from('player_devices')
    .select('last_seen_at, online_since')
    .eq('id', device.id)
    .maybeSingle();

  const now = new Date();
  const lastSeenAt = fullDevice?.last_seen_at
    ? new Date(fullDevice.last_seen_at)
    : null;
  const wasOffline =
    !lastSeenAt || now.getTime() - lastSeenAt.getTime() > 2 * 60 * 1000;
  const onlineSince =
    fullDevice?.online_since && !wasOffline
      ? fullDevice.online_since
      : now.toISOString();

  const { error: updateError } = await supabaseAdmin
    .from('player_devices')
    .update({
      last_seen_at: now.toISOString(),
      online_since: onlineSince,
      meta_json: body.meta ?? {},
    })
    .eq('id', device.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to update device' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const response: HeartbeatResponse = {
    ok: true,
    player_id: device.player_id,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
