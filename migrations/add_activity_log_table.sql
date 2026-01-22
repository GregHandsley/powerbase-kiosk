-- Migration: Add activity_log table and indexes
-- Stores operational activity events (bookings, edits, approvals, etc.)
-- Separate from audit_log which is for governance/security events

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  organization_id bigint NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  site_id bigint NULL REFERENCES public.sites(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NULL,
  actor_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  subject_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  old_value jsonb NULL,
  new_value jsonb NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Add constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'activity_log_event_type_not_empty'
      AND conrelid = 'public.activity_log'::regclass
  ) THEN
    ALTER TABLE public.activity_log
      ADD CONSTRAINT activity_log_event_type_not_empty
      CHECK (length(event_type) > 0);
  END IF;
END $$;

-- Indexes optimized for common query patterns
CREATE INDEX IF NOT EXISTS activity_log_org_created_at_idx
  ON public.activity_log (organization_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS activity_log_org_event_created_at_idx
  ON public.activity_log (organization_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_log_org_actor_created_at_idx
  ON public.activity_log (organization_id, actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_log_org_entity_created_at_idx
  ON public.activity_log (organization_id, entity_type, entity_id, created_at DESC);

-- Index for site-specific queries
CREATE INDEX IF NOT EXISTS activity_log_site_created_at_idx
  ON public.activity_log (site_id, created_at DESC)
  WHERE site_id IS NOT NULL;

-- Index for automatic cleanup (retention policy)
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx
  ON public.activity_log (created_at DESC);

COMMENT ON TABLE public.activity_log IS
  'Stores operational activity events (bookings, edits, approvals, etc.) for business operations tracking. Separate from audit_log which is for governance/security events.';

COMMENT ON COLUMN public.activity_log.entity_id IS
  'Optional UUID reference to the entity. Use ONLY when the target entity has a UUID id. For bigint IDs (bookings, etc.), leave NULL and store the ID in metadata instead (e.g., { booking_id: 123 }).';
