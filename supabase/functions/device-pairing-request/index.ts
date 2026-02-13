// Device registers its pairing code (no auth - device is unpaired)
declare const Deno: {
  env: { get(key: string): string | undefined };
};

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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

  const body = (await req.json().catch(() => null)) as {
    device_id?: string;
    device_secret?: string;
    code?: string;
  } | null;

  if (!body?.device_id || !body?.device_secret || !body?.code) {
    return new Response(
      JSON.stringify({ error: 'Missing device_id, device_secret, or code' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const code = String(body.code).trim().toUpperCase().replace(/-/g, '');
  if (code.length !== 8) {
    return new Response(
      JSON.stringify({ error: 'Code must be 8 characters' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  const formattedCode = `${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6)}`;

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

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // Ensure one active request per device to avoid ambiguous maybeSingle lookups.
  await supabaseAdmin
    .from('device_pairing_requests')
    .delete()
    .eq('device_id', body.device_id);

  const { error } = await supabaseAdmin.from('device_pairing_requests').upsert(
    {
      code: formattedCode,
      device_id: body.device_id,
      device_secret: body.device_secret,
      expires_at: expiresAt,
    },
    { onConflict: 'code' }
  );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({ ok: true, code: formattedCode, expires_at: expiresAt }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
