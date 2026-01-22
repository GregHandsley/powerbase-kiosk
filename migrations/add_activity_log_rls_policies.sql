-- Migration: Add RLS policies for activity_log table
-- Less restrictive than audit_log: users can see their own activity and organization activity

-- Enable RLS on activity_log (with FORCE to ensure even table owner is subject to RLS)
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log FORCE ROW LEVEL SECURITY;

-- SELECT policy: Allow users to see activity logs for their organization
-- Users can see:
-- 1. Activity where they are the actor (their own actions)
-- 2. Activity where they are the subject (actions affecting them)
-- 3. Activity in their organization (if they have appropriate permissions)
-- This is more permissive than audit_log which requires explicit audit.read permission

CREATE POLICY activity_log_select_own
  ON public.activity_log
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own activity (as actor or subject)
    actor_user_id = auth.uid() OR subject_user_id = auth.uid()
  );

CREATE POLICY activity_log_select_org
  ON public.activity_log
  FOR SELECT
  TO authenticated
  USING (
    -- User can see activity in organizations they belong to
    EXISTS (
      SELECT 1
      FROM public.organization_memberships
      WHERE organization_memberships.organization_id = activity_log.organization_id
        AND organization_memberships.user_id = auth.uid()
    )
  );

-- No INSERT policy: Only service role can insert (bypasses RLS)
-- This ensures append-only: clients cannot write activity logs directly

-- No UPDATE/DELETE policies: Effectively blocked (append-only table)

COMMENT ON POLICY activity_log_select_own ON public.activity_log IS
  'Allows authenticated users to read activity logs where they are the actor or subject.';

COMMENT ON POLICY activity_log_select_org ON public.activity_log IS
  'Allows authenticated users to read activity logs for organizations they belong to.';
