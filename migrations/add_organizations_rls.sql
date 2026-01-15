-- Add RLS to Organizations Table
-- This restricts visibility so users can only see organizations they belong to

-- Enable RLS on organizations table
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see organizations they have membership in
CREATE POLICY "users_can_view_own_organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
  )
);

-- Policy: Users can only insert organizations (for future use - may want to restrict to super_admin later)
-- For now, allow authenticated users to create organizations
-- This can be restricted later when we add role-based permissions
CREATE POLICY "authenticated_can_create_organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Users can only update organizations they belong to
-- (Restrict to admins later when we add permissions)
CREATE POLICY "users_can_update_own_organizations"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
  )
);

-- Policy: Users can only delete organizations they belong to
-- (Restrict to admins later when we add permissions)
CREATE POLICY "users_can_delete_own_organizations"
ON public.organizations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
  )
);

-- Add comments
COMMENT ON POLICY "users_can_view_own_organizations" ON public.organizations IS 
  'RLS policy: Users can only view organizations they have membership in';
COMMENT ON POLICY "authenticated_can_create_organizations" ON public.organizations IS 
  'RLS policy: Authenticated users can create organizations (may be restricted later)';
COMMENT ON POLICY "users_can_update_own_organizations" ON public.organizations IS 
  'RLS policy: Users can only update organizations they have membership in';
COMMENT ON POLICY "users_can_delete_own_organizations" ON public.organizations IS 
  'RLS policy: Users can only delete organizations they have membership in';
