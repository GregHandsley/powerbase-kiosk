-- Migration: Remove unused booking_squads.short_name column
-- Safe to run multiple times.

ALTER TABLE public.booking_squads
  DROP COLUMN IF EXISTS short_name;
