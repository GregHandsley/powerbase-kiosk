-- Migration: Add RLS policies for audit_log table (Layer 6, Step 2)
-- Enables read access for users with audit.read permission, append-only (service role writes)

-- Enable RLS on audit_log (with FORCE to ensure even table owner is subject to RLS)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

-- SELECT policy: Allow read access if user can_read_audit (permission-based)
-- This uses can_read_audit which checks for audit.read permission via RBAC
-- Note: can_read_audit signature must match organization_id type (bigint)
CREATE POLICY audit_log_select
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.can_read_audit(organization_id));

-- No INSERT policy: Only service role can insert (bypasses RLS)
-- This ensures append-only: clients cannot write audit logs directly

-- No UPDATE/DELETE policies: Effectively blocked (append-only table)

COMMENT ON POLICY audit_log_select ON public.audit_log IS
  'Allows authenticated users to read audit logs if they have audit.read permission for the organization (checked via can_read_audit).';
