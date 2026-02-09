-- Migration: Add player agent tables and indexes
-- Tables: players, player_pairing_codes, player_devices, player_commands, player_logs

-- Sequences for bigint primary keys (align with existing schema style)
CREATE SEQUENCE IF NOT EXISTS public.players_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.player_devices_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.player_commands_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.player_logs_id_seq;

CREATE TABLE IF NOT EXISTS public.players (
  id bigint NOT NULL DEFAULT nextval('players_id_seq'::regclass),
  organization_id bigint NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id bigint NULL REFERENCES public.sites(id) ON DELETE SET NULL,
  name text NOT NULL,
  location text NULL,
  desired_url text NULL,
  desired_power_state text NOT NULL DEFAULT 'on',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT players_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.player_pairing_codes (
  code text PRIMARY KEY,
  player_id bigint NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.player_devices (
  id bigint NOT NULL DEFAULT nextval('player_devices_id_seq'::regclass),
  device_id text NOT NULL,
  player_id bigint NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  last_seen_at timestamptz NULL,
  meta_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_devices_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.player_commands (
  id bigint NOT NULL DEFAULT nextval('player_commands_id_seq'::regclass),
  player_id bigint NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now(),
  ack_at timestamptz NULL,
  error text NULL,
  CONSTRAINT player_commands_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.player_logs (
  id bigint NOT NULL DEFAULT nextval('player_logs_id_seq'::regclass),
  player_id bigint NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  level text NOT NULL,
  message text NOT NULL,
  meta_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_logs_pkey PRIMARY KEY (id)
);

-- Constraints (added defensively to support reruns)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'players_name_not_empty'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_name_not_empty
      CHECK (length(name) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'players_power_state_valid'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_power_state_valid
      CHECK (desired_power_state IN ('on', 'off'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'player_commands_status_valid'
      AND conrelid = 'public.player_commands'::regclass
  ) THEN
    ALTER TABLE public.player_commands
      ADD CONSTRAINT player_commands_status_valid
      CHECK (status IN ('queued', 'running', 'success', 'fail'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'player_logs_level_valid'
      AND conrelid = 'public.player_logs'::regclass
  ) THEN
    ALTER TABLE public.player_logs
      ADD CONSTRAINT player_logs_level_valid
      CHECK (level IN ('debug', 'info', 'warn', 'error'));
  END IF;
END $$;

-- Indexes for lookup and polling patterns
CREATE INDEX IF NOT EXISTS players_org_created_at_idx
  ON public.players (organization_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS players_site_created_at_idx
  ON public.players (site_id, created_at DESC)
  WHERE site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS pairing_codes_player_id_idx
  ON public.player_pairing_codes (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS pairing_codes_expires_at_idx
  ON public.player_pairing_codes (expires_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS player_devices_device_id_uidx
  ON public.player_devices (device_id);

CREATE INDEX IF NOT EXISTS player_devices_player_id_idx
  ON public.player_devices (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS player_devices_last_seen_idx
  ON public.player_devices (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS player_commands_player_status_created_idx
  ON public.player_commands (player_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS player_commands_created_idx
  ON public.player_commands (created_at DESC);

CREATE INDEX IF NOT EXISTS player_logs_player_created_idx
  ON public.player_logs (player_id, created_at DESC);

-- Trigger to keep players.updated_at current
CREATE OR REPLACE FUNCTION public.update_players_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'players_updated_at'
  ) THEN
    CREATE TRIGGER players_updated_at
      BEFORE UPDATE ON public.players
      FOR EACH ROW
      EXECUTE FUNCTION public.update_players_updated_at();
  END IF;
END $$;
