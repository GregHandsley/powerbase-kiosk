-- Sprint 5.2: Observability + alerts
-- Stores offline alert windows per device and schedules alert scanner.

CREATE SEQUENCE IF NOT EXISTS public.player_offline_alerts_id_seq;

CREATE TABLE IF NOT EXISTS public.player_offline_alerts (
  id bigint NOT NULL DEFAULT nextval('player_offline_alerts_id_seq'::regclass),
  organization_id bigint NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  player_id bigint NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  offline_started_at timestamptz NOT NULL,
  alerted_at timestamptz NOT NULL DEFAULT now(),
  recovered_at timestamptz NULL,
  last_seen_at timestamptz NULL,
  threshold_minutes int NOT NULL DEFAULT 10,
  activity_log_id uuid NULL REFERENCES public.activity_log(id) ON DELETE SET NULL,
  CONSTRAINT player_offline_alerts_pkey PRIMARY KEY (id)
);

-- One unresolved alert per player/device.
CREATE UNIQUE INDEX IF NOT EXISTS player_offline_alerts_unresolved_uidx
  ON public.player_offline_alerts (player_id, device_id)
  WHERE recovered_at IS NULL;

CREATE INDEX IF NOT EXISTS player_offline_alerts_org_alerted_idx
  ON public.player_offline_alerts (organization_id, alerted_at DESC);

CREATE INDEX IF NOT EXISTS player_offline_alerts_player_alerted_idx
  ON public.player_offline_alerts (player_id, alerted_at DESC);

COMMENT ON TABLE public.player_offline_alerts IS
  'Tracks offline alert windows per player device to avoid duplicate alerts while still offline.';
COMMENT ON COLUMN public.player_offline_alerts.offline_started_at IS
  'Timestamp when the device went offline (derived from last_seen_at).';
COMMENT ON COLUMN public.player_offline_alerts.recovered_at IS
  'Set when the device comes back online and the offline alert window is closed.';

-- Optional scheduler setup (requires pg_cron + pg_net extensions to be enabled).
DO $$
DECLARE
  v_supabase_url text := current_setting('app.settings.supabase_url', true);
  v_job_name text := 'player-offline-alerts-every-2-min';
  v_existing_job_id int;
  v_schedule_command text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'Skipping player-offline-alerts schedule: pg_cron not enabled.';
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE NOTICE 'Skipping player-offline-alerts schedule: pg_net not enabled.';
    RETURN;
  END IF;

  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RAISE NOTICE 'Skipping player-offline-alerts schedule: app.settings.supabase_url is missing.';
    RETURN;
  END IF;

  EXECUTE format(
    'SELECT jobid FROM cron.job WHERE jobname = %L',
    v_job_name
  )
  INTO v_existing_job_id;

  IF v_existing_job_id IS NULL THEN
    v_schedule_command := format(
      $schedule$
        SELECT net.http_post(
          url := %L,
          headers := '{"Content-Type":"application/json"}'::jsonb,
          body := '{"offline_threshold_minutes":10}'::jsonb
        );
      $schedule$,
      v_supabase_url || '/functions/v1/player-offline-alerts'
    );

    EXECUTE format(
      'SELECT cron.schedule(%L, %L, %L)',
      v_job_name,
      '*/2 * * * *',
      v_schedule_command
    );
  END IF;
END $$;
