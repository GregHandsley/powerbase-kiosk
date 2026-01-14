-- Add 'pending_cancellation' status to booking_status enum
-- This allows bookings to be marked for cancellation and reviewed by bookings team
-- 
-- IMPORTANT: This migration must be run manually in Supabase Dashboard → SQL Editor
-- PostgreSQL doesn't support IF NOT EXISTS for ALTER TYPE ADD VALUE in all versions
-- If you get an error that the value already exists, you can safely ignore it

-- Add the new enum value
-- Note: This cannot be rolled back easily, so ensure you want to add this status
DO $$ 
BEGIN
    -- Check if the value already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'pending_cancellation' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'booking_status')
    ) THEN
        ALTER TYPE booking_status ADD VALUE 'pending_cancellation';
    END IF;
END $$;

-- Add comment for documentation
COMMENT ON TYPE booking_status IS 'Booking status workflow: draft -> pending -> processed/confirmed -> completed/cancelled. pending_cancellation is an intermediate state before final cancellation.';
