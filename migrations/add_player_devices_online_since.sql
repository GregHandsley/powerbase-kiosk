-- Migration: Add online_since to player_devices
ALTER TABLE public.player_devices
  ADD COLUMN IF NOT EXISTS online_since timestamptz NULL;

CREATE INDEX IF NOT EXISTS player_devices_online_since_idx
  ON public.player_devices (online_since DESC)
  WHERE online_since IS NOT NULL;
