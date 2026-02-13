// Edge Function: Player offline alerts scanner
// Scheduled job that emits one offline alert per offline window.
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-expect-error: Remote Deno std import is resolved at runtime/deploy time
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error: Remote Supabase client import is resolved at runtime/deploy time
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logActivityEvent } from '../_shared/activity.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type DeviceRow = {
  id: number;
  device_id: string;
  player_id: number;
  last_seen_at: string | null;
  revoked_at: string | null;
  player: {
    id: number;
    name: string;
    site_id: number | null;
    organization_id: number;
  } | null;
};

type AlertRow = {
  id: number;
  player_id: number;
  device_id: string;
  offline_started_at: string;
  alerted_at: string;
  organization_id: number;
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

  try {
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

    let body: { offline_threshold_minutes?: number; dry_run?: boolean } = {};
    try {
      body = (await req.json()) as {
        offline_threshold_minutes?: number;
        dry_run?: boolean;
      };
    } catch {
      // Empty body is valid.
    }

    const thresholdMinutes = Math.max(
      1,
      Number(
        body.offline_threshold_minutes ??
          Deno.env.get('OFFLINE_ALERT_THRESHOLD_MINUTES') ??
          10
      )
    );
    const dryRun = body.dry_run === true;
    const now = new Date();
    const thresholdMs = thresholdMinutes * 60 * 1000;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: devicesData, error: devicesError } = await supabaseAdmin
      .from('player_devices')
      .select(
        `
        id,
        device_id,
        player_id,
        last_seen_at,
        revoked_at,
        player:players (
          id,
          name,
          site_id,
          organization_id
        )
      `
      )
      .is('revoked_at', null);

    if (devicesError) {
      throw new Error(devicesError.message || 'Failed to load devices');
    }

    const { data: activeAlerts, error: activeAlertsError } = await supabaseAdmin
      .from('player_offline_alerts')
      .select(
        'id, player_id, device_id, offline_started_at, alerted_at, organization_id'
      )
      .is('recovered_at', null);

    if (activeAlertsError) {
      throw new Error(
        activeAlertsError.message || 'Failed to load active alerts'
      );
    }

    const unresolvedByKey = new Map<string, AlertRow>();
    for (const alert of (activeAlerts ?? []) as AlertRow[]) {
      unresolvedByKey.set(`${alert.player_id}:${alert.device_id}`, alert);
    }

    const devices = ((devicesData ?? []) as DeviceRow[]).filter(
      (d) => d.player?.organization_id
    );
    let offlineAlertsCreated = 0;
    let recoveredAlertsClosed = 0;
    const skipped: string[] = [];

    for (const device of devices) {
      if (!device.player || !device.last_seen_at) continue;

      const key = `${device.player_id}:${device.device_id}`;
      const existingAlert = unresolvedByKey.get(key);
      const offlineForMs =
        now.getTime() - new Date(device.last_seen_at).getTime();
      const isOffline = offlineForMs > thresholdMs;

      if (isOffline && !existingAlert) {
        if (dryRun) {
          offlineAlertsCreated += 1;
          continue;
        }

        const { data: insertedAlert, error: insertAlertError } =
          await supabaseAdmin
            .from('player_offline_alerts')
            .insert({
              organization_id: device.player.organization_id,
              player_id: device.player_id,
              device_id: device.device_id,
              offline_started_at: device.last_seen_at,
              last_seen_at: device.last_seen_at,
              threshold_minutes: thresholdMinutes,
            })
            .select('id')
            .single();

        if (insertAlertError) {
          skipped.push(
            `alert_insert_failed:${device.player_id}:${insertAlertError.message}`
          );
          continue;
        }

        const activityId = await logActivityEvent({
          organizationId: device.player.organization_id,
          siteId: device.player.site_id ?? null,
          eventType: 'player.offline_alert',
          entityType: 'player',
          metadata: {
            player_id: device.player_id,
            player_name: device.player.name,
            device_id: device.device_id,
            last_seen_at: device.last_seen_at,
            offline_for_minutes: Math.floor(offlineForMs / 60000),
            threshold_minutes: thresholdMinutes,
          },
        });

        if (activityId) {
          await supabaseAdmin
            .from('player_offline_alerts')
            .update({ activity_log_id: activityId })
            .eq('id', insertedAlert.id);
        }

        offlineAlertsCreated += 1;
      }

      if (!isOffline && existingAlert) {
        if (dryRun) {
          recoveredAlertsClosed += 1;
          continue;
        }

        const { error: resolveError } = await supabaseAdmin
          .from('player_offline_alerts')
          .update({ recovered_at: now.toISOString() })
          .eq('id', existingAlert.id);

        if (resolveError) {
          skipped.push(
            `alert_resolve_failed:${device.player_id}:${resolveError.message}`
          );
          continue;
        }

        await logActivityEvent({
          organizationId: device.player.organization_id,
          siteId: device.player.site_id ?? null,
          eventType: 'player.offline_recovered',
          entityType: 'player',
          metadata: {
            player_id: device.player_id,
            player_name: device.player.name,
            device_id: device.device_id,
            offline_started_at: existingAlert.offline_started_at,
            recovered_at: now.toISOString(),
            offline_duration_minutes: Math.max(
              0,
              Math.floor(
                (now.getTime() -
                  new Date(existingAlert.offline_started_at).getTime()) /
                  60000
              )
            ),
          },
        });

        recoveredAlertsClosed += 1;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        threshold_minutes: thresholdMinutes,
        dry_run: dryRun,
        scanned_devices: devices.length,
        offline_alerts_created: offlineAlertsCreated,
        recovered_alerts_closed: recoveredAlertsClosed,
        skipped,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[player-offline-alerts] error:', error);
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
