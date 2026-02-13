// Shared device auth for Player Agent Edge Functions
// Validates token, rejects revoked devices.
// Requires migration: migrations/add_player_device_security.sql

/** Device row shape from player_devices */
type DeviceRow = {
  id: number;
  player_id: number;
  token_hash: string;
  revoked_at?: string | null;
};

/** Minimal Supabase client interface for device auth queries */
export interface DeviceAuthSupabaseClient {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        maybeSingle: () => Promise<{
          data: DeviceRow | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
}

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
  supabaseAdmin: DeviceAuthSupabaseClient
): Promise<DeviceAuthResult> {
  const tokenHash = await sha256(deviceToken);

  const { data: device, error: deviceError } = await supabaseAdmin
    .from('player_devices')
    .select('id, player_id, token_hash, revoked_at')
    .eq('device_id', deviceId)
    .maybeSingle();

  if (deviceError) {
    // Schema error (migration not run)?
    const msg = String(
      (deviceError as { message?: string })?.message ?? deviceError
    );
    if (msg.includes('revoked_at') || msg.includes('column')) {
      return {
        ok: false,
        status: 500,
        body: {
          error: 'Database migration required',
          hint: 'Run migrations/add_player_device_security.sql',
        },
      };
    }
    return {
      ok: false,
      status: 401,
      body: { error: 'Unauthorized' },
    };
  }

  if (!device) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Unauthorized' },
    };
  }

  if (device.revoked_at) {
    return {
      ok: false,
      status: 401,
      body: { error: 'Token revoked' },
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
