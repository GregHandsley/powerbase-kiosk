-- Verification Script: Check if org isolation RLS is properly set up
-- Run this to verify that enforce_org_isolation_rls.sql was executed successfully

-- ============================================================================
-- 1. Check if RLS is enabled on org-scoped tables
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('bookings', 'sides')
ORDER BY tablename;

-- ============================================================================
-- 2. Check existing policies on bookings table
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'bookings'
ORDER BY policyname;

-- ============================================================================
-- 3. Check existing policies on sides table
-- ============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd as command,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'sides'
ORDER BY policyname;

-- ============================================================================
-- 4. Check if organization_memberships table exists (prerequisite)
-- ============================================================================
SELECT 
  EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'organization_memberships'
  ) as organization_memberships_exists;

-- ============================================================================
-- 5. Check if organizations table exists (prerequisite)
-- ============================================================================
SELECT 
  EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'organizations'
  ) as organizations_exists;

-- ============================================================================
-- 6. Count memberships (should have at least one per existing user)
-- ============================================================================
SELECT 
  COUNT(*) as total_memberships,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT organization_id) as unique_organizations
FROM public.organization_memberships;

-- ============================================================================
-- 7. Quick test: Check if a sample booking has organization_id
-- ============================================================================
SELECT 
  COUNT(*) as bookings_with_org_id,
  COUNT(*) FILTER (WHERE organization_id IS NOT NULL) as bookings_with_non_null_org_id
FROM public.bookings
LIMIT 1;

-- ============================================================================
-- 8. Quick test: Check if a sample side has organization_id
-- ============================================================================
SELECT 
  COUNT(*) as sides_with_org_id,
  COUNT(*) FILTER (WHERE organization_id IS NOT NULL) as sides_with_non_null_org_id
FROM public.sides
LIMIT 1;
