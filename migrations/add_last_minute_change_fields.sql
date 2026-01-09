-- Add last-minute change tracking fields to bookings table
-- This migration adds support for tracking bookings created/edited after the cutoff deadline

-- Add last_minute_change flag
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS last_minute_change BOOLEAN NOT NULL DEFAULT false;

-- Add cutoff_at timestamp (when the cutoff was for this booking)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS cutoff_at TIMESTAMPTZ;

-- Add override_by field (if an admin overrides the cutoff)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add override_reason text field (optional reason for override)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS override_reason TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.bookings.last_minute_change IS 'True if this booking was created or edited after the cutoff deadline';
COMMENT ON COLUMN public.bookings.cutoff_at IS 'The cutoff deadline that applied to this booking';
COMMENT ON COLUMN public.bookings.override_by IS 'User ID of admin who overrode the cutoff (if applicable)';
COMMENT ON COLUMN public.bookings.override_reason IS 'Optional reason provided for overriding the cutoff';

-- Create index on last_minute_change for filtering
CREATE INDEX IF NOT EXISTS idx_bookings_last_minute_change ON public.bookings(last_minute_change) WHERE last_minute_change = true;

