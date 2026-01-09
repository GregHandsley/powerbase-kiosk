-- Add booking status tracking fields to bookings table
-- This migration adds status workflow support for booking management

-- Create booking_status enum type
CREATE TYPE booking_status AS ENUM (
  'draft',
  'pending',
  'processed',
  'confirmed',
  'completed',
  'cancelled'
);

-- Add status column with default 'pending'
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS status booking_status NOT NULL DEFAULT 'pending';

-- Add processed_by field (references the user who processed the booking)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add processed_at timestamp
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Add last_edited_at timestamp (to detect changes after processing)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ;

-- Add last_edited_by field (references the user who last edited the booking)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS last_edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.bookings.status IS 'Current status of the booking in the workflow';
COMMENT ON COLUMN public.bookings.processed_by IS 'User ID of the bookings team member who processed this booking';
COMMENT ON COLUMN public.bookings.processed_at IS 'Timestamp when the booking was processed by the bookings team';
COMMENT ON COLUMN public.bookings.last_edited_at IS 'Timestamp of the last edit to detect changes after processing';
COMMENT ON COLUMN public.bookings.last_edited_by IS 'User ID of the person who last edited this booking';

-- Set existing bookings to 'processed' status (assuming they were already processed)
-- You may want to adjust this based on your business logic
UPDATE public.bookings
SET status = 'processed'
WHERE status = 'pending' AND created_at < NOW() - INTERVAL '1 day';

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

-- Create index on processed_by for bookings team queries
CREATE INDEX IF NOT EXISTS idx_bookings_processed_by ON public.bookings(processed_by) WHERE processed_by IS NOT NULL;

