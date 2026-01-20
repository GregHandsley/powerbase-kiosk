-- Migration: Add is_org_admin function as single source of truth for org admin checks
-- This function determines if the current authenticated user is an admin of an organization
-- Works with RBAC system: checks for 'admin' role in organization_memberships
-- Use this for admin-area gating only (role check). Do not use for audit access.
--
-- Note: This checks the role directly. If you want to use RBAC permissions instead,
-- you could call has_permission(p_user_id, p_org_id, 'admin.access') or similar.
-- However, 'admin' role is the standard way to grant org admin access in your system.

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  current_user_id uuid;
  is_super_admin boolean;
  is_admin boolean;
BEGIN
  -- Get current authenticated user
  current_user_id := auth.uid();
  
  -- If not authenticated, return false
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check if user is super admin (global admin, has access to all orgs)
  -- Super admins bypass RBAC and have access to everything
  SELECT COALESCE(p.is_super_admin, false) INTO is_super_admin
  FROM public.profiles p
  WHERE p.id = current_user_id;

  IF is_super_admin THEN
    RETURN true;
  END IF;

  -- Check if user has 'admin' role in the specified organization
  -- This works with your RBAC system: 'admin' role is granted via organization_memberships
  -- The admin role then has permissions mapped via role_permissions table
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.user_id = current_user_id
      AND om.organization_id = p_org_id
      AND om.role = 'admin'::public.org_role
  ) INTO is_admin;

  RETURN is_admin;
END;
$$;

-- Set search_path for security (prevent shadowing attacks)
ALTER FUNCTION public.is_org_admin(bigint)
  SET search_path = public, auth;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_org_admin(bigint) TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION public.is_org_admin(bigint) IS 
  'Role-based org admin check (super admin OR org role admin). Use for admin-area gating. Do not use for audit access; use can_read_audit instead.';
