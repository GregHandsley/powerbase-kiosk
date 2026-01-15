-- Enable pgcrypto Extension
-- This extension is required for the digest() function used in invitation token hashing
-- Run this FIRST before running other invitation-related migrations
-- 
-- Note: In Supabase, this extension should be available. If you get a permission error,
-- you may need to enable it via Supabase Dashboard → Database → Extensions

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Verify the extension is enabled
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
  ) THEN
    RAISE EXCEPTION 'pgcrypto extension could not be enabled. Please enable it manually in Supabase Dashboard → Database → Extensions';
  END IF;
END $$;

COMMENT ON EXTENSION pgcrypto IS 'Required for secure token hashing in invitation system';
