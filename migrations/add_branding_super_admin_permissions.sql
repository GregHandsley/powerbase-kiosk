-- Restrict organization branding updates to super admins

-- Enable RLS on organizations (safe if already enabled)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Allow org members (or super admins) to read organizations
DROP POLICY IF EXISTS "Organizations readable by members" ON public.organizations;
CREATE POLICY "Organizations readable by members"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships
    WHERE organization_id = organizations.id
      AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_super_admin = true
  )
);

-- Only super admins can update organizations (branding)
DROP POLICY IF EXISTS "Organizations update by super admins" ON public.organizations;
CREATE POLICY "Organizations update by super admins"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_super_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_super_admin = true
  )
);
