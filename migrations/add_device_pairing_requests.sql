-- Device-initiated pairing: kiosk displays code, admin enters it to pair
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.device_pairing_requests (
  code text PRIMARY KEY,
  device_id text NOT NULL,
  device_secret text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.device_pairing_completions (
  device_id text PRIMARY KEY,
  device_token text NOT NULL,
  player_id bigint NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_pairing_requests_expires_at_idx
  ON public.device_pairing_requests (expires_at);

CREATE INDEX IF NOT EXISTS device_pairing_completions_expires_at_idx
  ON public.device_pairing_completions (expires_at);
