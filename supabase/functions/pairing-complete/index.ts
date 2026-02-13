// Device polls for token after admin has paired (authenticated by device_secret)
declare const Deno: {
  env: { get(key: string): string | undefined };
};

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  const deviceId = url.searchParams.get('device_id')?.trim();
  const deviceSecret = url.searchParams.get('device_secret')?.trim();

  if (!deviceId || !deviceSecret) {
    return new Response(
      JSON.stringify({ error: 'Missing device_id or device_secret' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: reqRow } = await supabaseAdmin
    .from('device_pairing_requests')
    .select('device_secret')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (!reqRow || reqRow.device_secret !== deviceSecret) {
    return new Response(JSON.stringify({ paired: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: completion } = await supabaseAdmin
    .from('device_pairing_completions')
    .select('device_token, player_id')
    .eq('device_id', deviceId)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (!completion) {
    return new Response(JSON.stringify({ paired: false }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await supabaseAdmin
    .from('device_pairing_completions')
    .delete()
    .eq('device_id', deviceId);

  return new Response(
    JSON.stringify({
      paired: true,
      device_token: completion.device_token,
      player_id: completion.player_id,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
