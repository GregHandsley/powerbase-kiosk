-- Add Test Organization for Isolation Testing
-- This creates a second organization with test data to verify RLS isolation works

-- ============================================================================
-- 1. Create second organization
-- ============================================================================
INSERT INTO public.organizations (id, name, slug, settings)
VALUES (2, 'Test Organization', 'test-org', '{}'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2. Create test sides for the second organization
-- ============================================================================
-- These will be isolated from the default org (id = 1)
INSERT INTO public.sides (id, key, name, organization_id)
VALUES 
  (100, 'power', 'Power', 2),
  (101, 'base', 'Base', 2)
ON CONFLICT (organization_id, key) DO NOTHING;

-- ============================================================================
-- 3. Helper: Add a user to the test organization
-- ============================================================================
-- Usage: Replace 'USER_UUID_HERE' with an actual user UUID
-- You can find user UUIDs by running: SELECT id, email FROM auth.users;
-- 
-- Example:
-- INSERT INTO public.organization_memberships (organization_id, user_id, role)
-- VALUES (2, 'YOUR_USER_UUID_HERE'::uuid, 'admin')
-- ON CONFLICT (organization_id, user_id) DO NOTHING;

-- ============================================================================
-- 4. Helper: Create a test booking for organization 2
-- ============================================================================
-- This creates a test booking that should only be visible to users in org 2
-- Uncomment and adjust the side_id (should be 100 or 101 from above) and user_id
--
-- INSERT INTO public.bookings (
--   title,
--   side_id,
--   organization_id,
--   start_template,
--   end_template,
--   areas,
--   racks,
--   created_by,
--   status
-- )
-- VALUES (
--   'Test Booking - Org 2',
--   100,  -- Use side_id 100 (Power) or 101 (Base) from org 2
--   2,    -- Organization 2
--   NOW() + INTERVAL '1 day',
--   NOW() + INTERVAL '1 day' + INTERVAL '1 hour',
--   '[]'::jsonb,
--   '[1, 2]'::jsonb,
--   'YOUR_USER_UUID_HERE'::uuid,  -- User who is member of org 2
--   'pending'
-- );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check organizations exist:
-- SELECT id, name, slug FROM public.organizations ORDER BY id;

-- Check sides are properly scoped:
-- SELECT id, key, name, organization_id FROM public.sides ORDER BY organization_id, id;

-- Check memberships:
-- SELECT om.*, o.name as org_name, p.full_name as user_name
-- FROM public.organization_memberships om
-- JOIN public.organizations o ON o.id = om.organization_id
-- LEFT JOIN public.profiles p ON p.id = om.user_id
-- ORDER BY om.organization_id, om.user_id;

-- Test isolation (run as different users):
-- As user in org 1: SELECT * FROM public.bookings; -- Should only see org 1 bookings
-- As user in org 2: SELECT * FROM public.bookings; -- Should only see org 2 bookings
