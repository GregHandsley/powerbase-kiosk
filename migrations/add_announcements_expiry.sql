-- Migration: Add expires_at column to announcements table
-- Allows announcements to automatically expire after a certain date

ALTER TABLE public.announcements
ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Add index for efficient expiry queries
CREATE INDEX IF NOT EXISTS announcements_expires_at_idx
  ON public.announcements (expires_at)
  WHERE expires_at IS NOT NULL;

COMMENT ON COLUMN public.announcements.expires_at IS
  'Optional expiration date. Announcements with expires_at in the past will not be shown to users.';
