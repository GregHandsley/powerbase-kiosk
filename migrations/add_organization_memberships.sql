-- Organization Memberships Table
-- This migration introduces the membership model to prepare for multi-org users
-- Layer 2: Isolation & Safety - Preparing for multi-org without changing UX

-- Create organization_memberships table
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure a user can only have one membership per organization
  UNIQUE (organization_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organization_memberships_organization_id 
  ON public.organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_user_id 
  ON public.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_memberships_role 
  ON public.organization_memberships(role);

-- Migrate existing users to organization memberships
-- One membership per user → default org (id = 1)
-- Use existing role from profiles, or default to 'admin' if no profile exists
INSERT INTO public.organization_memberships (organization_id, user_id, role)
SELECT 
  1 as organization_id,  -- Default organization
  p.id as user_id,
  COALESCE(p.role, 'admin') as role  -- Use existing role, default to admin if no profile
FROM public.profiles p
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Also create memberships for any auth.users that don't have profiles yet
-- (This handles edge cases where users exist in auth but not in profiles)
INSERT INTO public.organization_memberships (organization_id, user_id, role)
SELECT 
  1 as organization_id,  -- Default organization
  au.id as user_id,
  'admin' as role  -- Default role for users without profiles
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.organization_memberships om 
  WHERE om.user_id = au.id AND om.organization_id = 1
)
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE public.organization_memberships IS 'Membership model for multi-org support. Each user can belong to multiple organizations with different roles.';
COMMENT ON COLUMN public.organization_memberships.organization_id IS 'Organization the user belongs to';
COMMENT ON COLUMN public.organization_memberships.user_id IS 'User who is a member';
COMMENT ON COLUMN public.organization_memberships.role IS 'Role of the user in this organization (admin or coach)';
