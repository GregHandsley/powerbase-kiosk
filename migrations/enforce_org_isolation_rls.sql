-- Enforce Organization Isolation with RLS
-- This migration implements true multi-tenant isolation by enforcing RLS policies
-- Layer 2: Isolation & Safety - Prevent cross-org data leaks

-- Enable RLS on sides (if not already enabled)
ALTER TABLE public.sides ENABLE ROW LEVEL SECURITY;

-- RLS is already enabled on bookings, but ensure it's enabled
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies on bookings and sides if they exist
-- (We're replacing them with org-aware policies)
DROP POLICY IF EXISTS "admin_bookings_all" ON public.bookings;
DROP POLICY IF EXISTS "coach_insert_unlocked_bookings" ON public.bookings;
DROP POLICY IF EXISTS "coach_update_own_bookings" ON public.bookings;
DROP POLICY IF EXISTS "coach_select_bookings" ON public.bookings;
DROP POLICY IF EXISTS "coach_delete_own_bookings" ON public.bookings;
DROP POLICY IF EXISTS "admins_can_manage_bookings" ON public.bookings;
DROP POLICY IF EXISTS "coaches_can_manage_own_bookings" ON public.bookings;
DROP POLICY IF EXISTS "authenticated_can_read_bookings" ON public.bookings;

-- Note: We're not dropping sides policies here as they may not exist yet
-- If they do exist, they'll need to be dropped manually or in a separate step

-- ============================================================================
-- BOOKINGS POLICIES
-- ============================================================================

-- Policy: Users can only see bookings from organizations they belong to
CREATE POLICY "users_can_view_own_org_bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = bookings.organization_id
      AND om.user_id = auth.uid()
  )
);

-- Policy: Users can only insert bookings into organizations they belong to
CREATE POLICY "users_can_insert_own_org_bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = bookings.organization_id
      AND om.user_id = auth.uid()
  )
);

-- Policy: Users can only update bookings in organizations they belong to
-- Note: Cannot change organization_id (enforced by WITH CHECK)
CREATE POLICY "users_can_update_own_org_bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = bookings.organization_id
      AND om.user_id = auth.uid()
  )
)
WITH CHECK (
  -- Ensure organization_id cannot be changed
  organization_id = (
    SELECT organization_id
    FROM public.bookings
    WHERE id = bookings.id
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = bookings.organization_id
      AND om.user_id = auth.uid()
  )
);

-- Policy: Users can only delete bookings from organizations they belong to
CREATE POLICY "users_can_delete_own_org_bookings"
ON public.bookings
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = bookings.organization_id
      AND om.user_id = auth.uid()
  )
);

-- ============================================================================
-- SIDES POLICIES
-- ============================================================================

-- Policy: Users can only see sides from organizations they belong to
CREATE POLICY "users_can_view_own_org_sides"
ON public.sides
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = sides.organization_id
      AND om.user_id = auth.uid()
  )
);

-- Policy: Users can only insert sides into organizations they belong to
CREATE POLICY "users_can_insert_own_org_sides"
ON public.sides
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = sides.organization_id
      AND om.user_id = auth.uid()
  )
);

-- Policy: Users can only update sides in organizations they belong to
-- Note: Cannot change organization_id (enforced by WITH CHECK)
CREATE POLICY "users_can_update_own_org_sides"
ON public.sides
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = sides.organization_id
      AND om.user_id = auth.uid()
  )
)
WITH CHECK (
  -- Ensure organization_id cannot be changed
  organization_id = (
    SELECT organization_id
    FROM public.sides
    WHERE id = sides.id
  )
  AND EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = sides.organization_id
      AND om.user_id = auth.uid()
  )
);

-- Policy: Users can only delete sides from organizations they belong to
CREATE POLICY "users_can_delete_own_org_sides"
ON public.sides
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_memberships om
    WHERE om.organization_id = sides.organization_id
      AND om.user_id = auth.uid()
  )
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "users_can_view_own_org_bookings" ON public.bookings IS 
  'RLS policy: Users can only view bookings from organizations they have membership in';
COMMENT ON POLICY "users_can_insert_own_org_bookings" ON public.bookings IS 
  'RLS policy: Users can only create bookings in organizations they have membership in';
COMMENT ON POLICY "users_can_update_own_org_bookings" ON public.bookings IS 
  'RLS policy: Users can only update bookings in organizations they have membership in. Prevents changing organization_id.';
COMMENT ON POLICY "users_can_delete_own_org_bookings" ON public.bookings IS 
  'RLS policy: Users can only delete bookings from organizations they have membership in';

COMMENT ON POLICY "users_can_view_own_org_sides" ON public.sides IS 
  'RLS policy: Users can only view sides from organizations they have membership in';
COMMENT ON POLICY "users_can_insert_own_org_sides" ON public.sides IS 
  'RLS policy: Users can only create sides in organizations they have membership in';
COMMENT ON POLICY "users_can_update_own_org_sides" ON public.sides IS 
  'RLS policy: Users can only update sides in organizations they have membership in. Prevents changing organization_id.';
COMMENT ON POLICY "users_can_delete_own_org_sides" ON public.sides IS 
  'RLS policy: Users can only delete sides from organizations they have membership in';
