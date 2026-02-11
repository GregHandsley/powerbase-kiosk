// Edge Function: Player config (desired URL)
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
  PlayerConfigRequest,
  PlayerConfigResponse,
} from '../_shared/playerAgentTypes.ts';

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

  const body = (await req
    .json()
    .catch(() => null)) as PlayerConfigRequest | null;

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

  const tokenHash = await sha256(body.device_token);

  const { data: device, error: deviceError } = await supabaseAdmin
    .from('player_devices')
    .select('player_id, token_hash')
    .eq('device_id', body.device_id)
    .maybeSingle();

  if (deviceError || !device || device.token_hash !== tokenHash) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: player, error: playerError } = await supabaseAdmin
    .from('players')
    .select('id, desired_url, site_id, side_key')
    .eq('id', device.player_id)
    .maybeSingle();

  if (playerError || !player) {
    return new Response(JSON.stringify({ error: 'Player not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let capacitySchedules: Record<string, unknown>[] = [];
  if (player.site_id && player.side_key) {
    const { data: side } = await supabaseAdmin
      .from('sides')
      .select('id')
      .eq('key', player.side_key)
      .maybeSingle();

    if (side?.id) {
      const now = new Date();
      const dayOfWeek = now.getUTCDay();
      const weekStart = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate() - dayOfWeek
        )
      );
      const weekEnd = new Date(
        Date.UTC(
          weekStart.getUTCFullYear(),
          weekStart.getUTCMonth(),
          weekStart.getUTCDate() + 6
        )
      );
      const weekStartStr = weekStart.toISOString().slice(0, 10);
      const weekEndStr = weekEnd.toISOString().slice(0, 10);

      const { data: schedules } = await supabaseAdmin
        .from('capacity_schedules')
        .select(
          'id, side_id, day_of_week, start_time, end_time, capacity, period_type, recurrence_type, start_date, end_date, excluded_dates, platforms'
        )
        .eq('side_id', side.id)
        .eq('site_id', player.site_id)
        .lte('start_date', weekEndStr)
        .or(`end_date.is.null,end_date.gte.${weekStartStr}`);

      capacitySchedules = (schedules ?? []) as Record<string, unknown>[];
    }
  }

  const response: PlayerConfigResponse = {
    ok: true,
    player_id: player.id,
    desired_url: player.desired_url ?? null,
    capacity_schedules: capacitySchedules,
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
