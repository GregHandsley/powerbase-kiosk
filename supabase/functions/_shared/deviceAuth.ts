// Shared device auth for Player Agent Edge Functions
// Validates token, rejects revoked/locked devices, handles lockout on failed auth

// @ts-expect-error: Remote Supabase client import is resolved at runtime/deploy time
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MINUTES = 15;

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

  const { data: device, error: deviceError } = await supabaseAdmin
    .from('player_devices')
    .select(
      'id, player_id, token_hash, revoked_at, lockout_until, failed_auth_count'
    )
    .eq('device_id', deviceId)
    .maybeSingle();

  if (deviceError || !device) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Unauthorized' },
    };
  }

  const now = new Date();

  // Reject revoked devices immediately
  if (device.revoked_at) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Token revoked' },
    };
  }

  // Reject locked-out devices
  if (device.lockout_until) {
    const lockoutUntil = new Date(device.lockout_until);
    if (now < lockoutUntil) {
      return {
        ok: false,
        status: 403,
        body: {
          error: 'Device locked out',
          retry_after: Math.ceil(
            (lockoutUntil.getTime() - now.getTime()) / 1000
          ),
        },
      };
    }
    // Lockout expired - clear it and failed_auth_count
    await supabaseAdmin
      .from('player_devices')
      .update({ lockout_until: null, failed_auth_count: 0 })
      .eq('id', device.id);
  }

  // Token mismatch - record failed auth and possibly lockout
  if (device.token_hash !== tokenHash) {
    const newCount = (device.failed_auth_count ?? 0) + 1;
    const updates: Record<string, unknown> = { failed_auth_count: newCount };

    if (newCount >= LOCKOUT_THRESHOLD) {
      const lockoutUntil = new Date(
        now.getTime() + LOCKOUT_MINUTES * 60 * 1000
      );
      updates.lockout_until = lockoutUntil.toISOString();
    }

    await supabaseAdmin
      .from('player_devices')
      .update(updates)
      .eq('id', device.id);

    return {
      ok: false,
      status: 401,
      body: {
        error:
          newCount >= LOCKOUT_THRESHOLD
            ? 'Device locked out due to suspicious activity'
            : 'Unauthorized',
      },
    };
  }

  // Success - reset failed_auth_count
  if ((device.failed_auth_count ?? 0) > 0) {
    await supabaseAdmin
      .from('player_devices')
      .update({ failed_auth_count: 0 })
      .eq('id', device.id);
  }

  return {
    ok: true,
    device: device as { id: number; player_id: number; [k: string]: unknown },
  };
}
