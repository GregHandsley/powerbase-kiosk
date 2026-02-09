-- Migration: Add audit.read permission and create can_read_audit function
-- This keeps role checks (is_org_admin) separate from permission checks (can_read_audit)

-- Step 1: Add 'audit.read' permission to permissions table
INSERT INTO public.permissions (key, name, description, category)
VALUES (
  'audit.read',
  'View Audit Logs',
  'Permission to view audit logs for an organization',
  'audit'
)
ON CONFLICT (key) DO NOTHING;

-- Step 2: Map 'audit.read' permission to 'admin' role
-- This ensures all admins have audit access by default via RBAC
INSERT INTO public.role_permissions (role, permission_id)
SELECT 
  'admin'::public.org_role,
  p.id
FROM public.permissions p
WHERE p.key = 'audit.read'
ON CONFLICT DO NOTHING;

-- Step 3: Create dedicated audit access check (permission-based)
-- This is separate from is_org_admin to keep concerns separated
-- Role checks stay role checks, permission checks stay permission checks
CREATE OR REPLACE FUNCTION public.can_read_audit(p_org_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  current_user_id uuid;
  super_admin boolean;
  allowed boolean;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Optional super admin bypass (only keep if locked down)
  SELECT COALESCE(p.is_super_admin, false) INTO super_admin
  FROM public.profiles p
  WHERE p.id = current_user_id;

  IF super_admin THEN
    RETURN true;
  END IF;

  -- Permission-based access
  -- If admin role has audit.read mapped, this will return true for admins
  -- You can also grant audit.read to other roles via role_permissions
  SELECT COALESCE(
    public.has_permission(current_user_id, p_org_id, 'audit.read'),
    false
  ) INTO allowed;

  RETURN allowed;
END;
$$;

-- Set search_path for security (prevent shadowing attacks)
ALTER FUNCTION public.can_read_audit(bigint)
  SET search_path = public, auth;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.can_read_audit(bigint) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION public.can_read_audit(bigint) IS 
  'Returns true if the current user can read audit logs for the org (super admin OR has audit.read permission via RBAC). Use this for audit_log RLS policies and audit UI access control. Keeps permission checks separate from role checks (is_org_admin).';
