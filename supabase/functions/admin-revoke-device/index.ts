// Edge Function: Admin revoke device token
// Revokes device(s) for a player. Optionally generates new pairing code (rotate).
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

function generatePairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

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
    rotate?: boolean;
  } | null;

  if (!body?.player_id) {
    return new Response(JSON.stringify({ error: 'Missing player_id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing authorization' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

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

  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Missing service role configuration' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
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

  const { data: isOrgAdmin, error: adminError } = await supabaseClient.rpc(
    'is_org_admin',
    { p_org_id: player.organization_id }
  );

  if (adminError || isOrgAdmin !== true) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: revoked, error: revokeError } = await supabaseAdmin
    .from('player_devices')
    .update({
      revoked_at: new Date().toISOString(),
      failed_auth_count: 0,
      lockout_until: null,
    })
    .eq('player_id', body.player_id)
    .select('id');

  if (revokeError) {
    return new Response(
      JSON.stringify({
        error: 'Failed to revoke device',
        details: revokeError.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const revokedCount = revoked?.length ?? 0;

  if (body.rotate && revokedCount > 0) {
    const code = generatePairingCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const { error: codeError } = await supabaseAdmin
      .from('player_pairing_codes')
      .insert({
        code,
        player_id: body.player_id,
        expires_at: expiresAt,
      });

    if (codeError) {
      return new Response(
        JSON.stringify({
          ok: true,
          revoked_count: revokedCount,
          message: 'Device revoked. Failed to generate pairing code.',
          error: codeError.message,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        revoked_count: revokedCount,
        pairing_code: code,
        expires_at: expiresAt,
        message: 'Device revoked. Use the pairing code to re-pair.',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      revoked_count: revokedCount,
      message:
        revokedCount > 0 ? 'Device(s) revoked.' : 'No devices to revoke.',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
