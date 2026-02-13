-- Migration: add side key to players for schedule selection
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS side_key text NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'players_side_key_valid'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_side_key_valid
      CHECK (side_key IN ('Base', 'Power'));
  END IF;
END $$;
