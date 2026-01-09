-- Add processed_snapshot field to store booking state when processed
-- This allows us to detect and display what changed after processing

ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS processed_snapshot JSONB;

COMMENT ON COLUMN public.bookings.processed_snapshot IS 'Snapshot of booking state when processed (instances count, capacity, time, racks) to detect changes';

