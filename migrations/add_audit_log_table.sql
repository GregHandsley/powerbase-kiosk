-- Migration: Add audit_log table and indexes (Layer 6, Step 1)

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.audit_log (
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
    WHERE conname = 'audit_log_event_type_not_empty'
      AND conrelid = 'public.audit_log'::regclass
  ) THEN
    ALTER TABLE public.audit_log
      ADD CONSTRAINT audit_log_event_type_not_empty
      CHECK (length(event_type) > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS audit_log_org_created_at_idx
  ON public.audit_log (organization_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS audit_log_org_event_created_at_idx
  ON public.audit_log (organization_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_org_actor_created_at_idx
  ON public.audit_log (organization_id, actor_user_id, created_at DESC);

-- Optional: enable if you filter by site frequently
-- CREATE INDEX IF NOT EXISTS audit_log_site_created_at_idx
--   ON public.audit_log (site_id, created_at DESC);

COMMENT ON TABLE public.audit_log IS
  'Stores immutable audit events for user actions and system changes, scoped by organization.';

COMMENT ON COLUMN public.audit_log.entity_id IS
  'Optional UUID reference to the entity. Use ONLY when the target entity has a UUID id. For bigint IDs (invitations, etc.), leave NULL and store the ID in metadata instead (e.g., { invitation_id: 123 }).';
