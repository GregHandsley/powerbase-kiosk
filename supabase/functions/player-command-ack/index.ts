// Edge Function: Player command ACK (stub)
// declare const Deno: {
//   env: {
//     get(key: string): string | undefined;
//   };
// };

// @ts-expect-error: Remote Deno std import is resolved at runtime/deploy time
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import type {
  CommandAckRequest,
  CommandAckResponse,
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

  const body = (await req.json().catch(() => null)) as CommandAckRequest | null;

  if (!body?.command_id || !body?.device_id || !body?.device_token) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const response: CommandAckResponse = { ok: true };

  return new Response(JSON.stringify(response), {
    status: 501,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
