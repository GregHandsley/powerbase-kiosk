-- Make profiles.role nullable
-- This migration supports the transition to multi-org where roles belong in organization_memberships
-- Layer 3: Invitations (Access Control Entry Point) - 2.2.3
--
-- In the new model:
-- - profiles.role becomes nullable (legacy, may be removed later)
-- - Roles are stored in organization_memberships (supports multi-org)
--
-- This allows invitation acceptance to work without requiring a role in profiles

-- Make the role column nullable
-- Note: No need to update existing NULL values since role is currently NOT NULL
ALTER TABLE public.profiles
ALTER COLUMN role DROP NOT NULL;

-- Add a comment explaining the change
COMMENT ON COLUMN public.profiles.role IS 
  'Legacy role field. In multi-org model, roles are stored in organization_memberships. This field may be removed in the future.';
