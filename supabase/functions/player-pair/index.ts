// Edge Function: Player pair (stub)
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-expect-error: Remote Deno std import is resolved at runtime/deploy time
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import type { PairRequest, PairResponse } from '../_shared/playerAgentTypes.ts';
// @ts-expect-error: Remote Supabase client import is resolved at runtime/deploy time
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

  const body = (await req.json().catch(() => null)) as PairRequest | null;

  if (!body?.code || !body?.device_id) {
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

  const { data: pairing, error: pairingError } = await supabaseAdmin
    .from('player_pairing_codes')
    .select('code, player_id, expires_at, used_at')
    .eq('code', body.code)
    .maybeSingle();

  if (pairingError || !pairing) {
    return new Response(JSON.stringify({ error: 'Invalid pairing code' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const now = new Date();
  if (pairing.used_at) {
    return new Response(
      JSON.stringify({ error: 'Pairing code already used' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (new Date(pairing.expires_at) <= now) {
    return new Response(JSON.stringify({ error: 'Pairing code expired' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const deviceToken = crypto.randomUUID();
  const tokenHash = await sha256(deviceToken);

  const { error: deviceError } = await supabaseAdmin
    .from('player_devices')
    .upsert(
      {
        device_id: body.device_id,
        player_id: pairing.player_id,
        token_hash: tokenHash,
        last_seen_at: now.toISOString(),
        meta_json: body.meta ?? {},
      },
      { onConflict: 'device_id' }
    );

  if (deviceError) {
    return new Response(JSON.stringify({ error: 'Failed to store device' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { error: updateError } = await supabaseAdmin
    .from('player_pairing_codes')
    .update({ used_at: now.toISOString() })
    .eq('code', body.code);

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to consume code' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const response: PairResponse = {
    player_id: pairing.player_id,
    device_token: deviceToken,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
