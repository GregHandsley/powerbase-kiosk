-- Migration: Add power schedule JSON to players
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS power_schedule_json jsonb NULL;
