// Admin pairs device to player by entering code from kiosk
declare const Deno: {
  env: { get(key: string): string | undefined };
};

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sha256 } from '../_shared/deviceAuth.ts';

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

  const body = (await req.json().catch(() => null)) as {
    player_id?: number;
    code?: string;
  } | null;

  if (!body?.player_id || !body?.code) {
    return new Response(
      JSON.stringify({ error: 'Missing player_id or code' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const raw = String(body.code).trim().toUpperCase().replace(/-/g, '');
  const formattedCode =
    raw.length >= 6 && raw.length <= 12
      ? `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`
      : String(body.code).trim().toUpperCase();

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: player, error: playerError } = await supabaseClient
    .from('players')
    .select('id, organization_id')
    .eq('id', body.player_id)
    .maybeSingle();

  if (playerError || !player) {
    return new Response(JSON.stringify({ error: 'Player not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: isOrgAdmin } = await supabaseClient.rpc('is_org_admin', {
    p_org_id: player.organization_id,
  });
  if (isOrgAdmin !== true) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: request, error: reqError } = await supabaseAdmin
    .from('device_pairing_requests')
    .select('device_id, device_secret')
    .eq('code', formattedCode)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (reqError || !request) {
    return new Response(JSON.stringify({ error: 'Invalid or expired code' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const deviceToken = crypto.randomUUID();
  const tokenHash = await sha256(deviceToken);
  const now = new Date();
  const completionExpires = new Date(
    now.getTime() + 5 * 60 * 1000
  ).toISOString();

  const { error: deviceError } = await supabaseAdmin
    .from('player_devices')
    .upsert(
      {
        device_id: request.device_id,
        player_id: body.player_id,
        token_hash: tokenHash,
        last_seen_at: now.toISOString(),
        meta_json: {},
        revoked_at: null,
        failed_auth_count: 0,
        lockout_until: null,
      },
      { onConflict: 'device_id' }
    );

  if (deviceError) {
    return new Response(JSON.stringify({ error: 'Failed to pair device' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await supabaseAdmin.from('device_pairing_completions').upsert(
    {
      device_id: request.device_id,
      device_token: deviceToken,
      player_id: body.player_id,
      expires_at: completionExpires,
    },
    { onConflict: 'device_id' }
  );

  return new Response(
    JSON.stringify({
      ok: true,
      message: 'Device paired. The kiosk will connect shortly.',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
