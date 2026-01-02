-- Add capacity column to booking_instances table
-- This stores the number of athletes for each booking instance
ALTER TABLE public.booking_instances
ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 1 NOT NULL;

COMMENT ON COLUMN public.booking_instances.capacity IS 'Number of athletes in this booking instance';

-- Add capacity_template column to bookings table if it doesn't exist
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS capacity_template integer DEFAULT 1;

COMMENT ON COLUMN public.bookings.capacity_template IS 'Template capacity (number of athletes) for this booking series';

