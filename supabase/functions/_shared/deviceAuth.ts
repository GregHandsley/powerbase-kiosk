// Shared device auth for Player Agent Edge Functions
// Validates token. Revoked/lockout logic disabled until migration is verified.

// @ts-expect-error: Remote Supabase client import is resolved at runtime/deploy time
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type DeviceAuthResult =
  | {
      ok: true;
      device: { id: number; player_id: number; [k: string]: unknown };
    }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function validateDeviceAuth(
  deviceId: string,
  deviceToken: string,
  supabaseAdmin: SupabaseClient
): Promise<DeviceAuthResult> {
  const tokenHash = await sha256(deviceToken);

  // Only select base columns - works with or without add_player_device_security migration
  const { data: device, error: deviceError } = await supabaseAdmin
    .from('player_devices')
    .select('id, player_id, token_hash')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (deviceError || !device) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Unauthorized' },
    };
  }

  if (device.token_hash !== tokenHash) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Unauthorized' },
    };
  }

  return {
    ok: true,
    device: device as { id: number; player_id: number; [k: string]: unknown },
  };
}
