-- Tag processed booking state so changes are never shown again after processing.
-- When a booking is marked processed, we store a signature of the snapshot;
-- the Bookings Team UI never shows "changes" for that state again (no repeat, no missing).
-- Run this migration before deploying the app change that sets processed_snapshot_signature.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS processed_snapshot_signature TEXT;

COMMENT ON COLUMN public.bookings.processed_snapshot_signature IS
  'Hash of the processed_snapshot at process time; used to never show the same changes again.';
