// Edge Function: Player command ACK
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
  CommandAckRequest,
  CommandAckResponse,
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

  const body = (await req.json().catch(() => null)) as CommandAckRequest | null;

  if (!body?.command_id || !body?.device_id || !body?.device_token) {
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

  const { data: command, error: commandError } = await supabaseAdmin
    .from('player_commands')
    .select('id, player_id, type')
    .eq('id', body.command_id)
    .maybeSingle();

  if (commandError || !command || command.player_id !== device.player_id) {
    return new Response(JSON.stringify({ error: 'Command not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { error: updateError } = await supabaseAdmin
    .from('player_commands')
    .update({
      status: body.status,
      ack_at: new Date().toISOString(),
      error: body.error ?? null,
    })
    .eq('id', command.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: 'Failed to update command' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await supabaseAdmin.from('player_logs').insert({
    player_id: device.player_id,
    level: body.status === 'success' ? 'info' : 'error',
    message:
      body.status === 'success'
        ? `Command ${command.type} executed`
        : `Command ${command.type} failed`,
    meta_json: {
      command_id: command.id,
      error: body.error ?? null,
    },
  });

  const response: CommandAckResponse = { ok: true };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
