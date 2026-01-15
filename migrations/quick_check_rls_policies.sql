-- Quick check: Verify RLS policies exist
-- This confirms that enforce_org_isolation_rls.sql ran successfully

-- Check for the new org-aware policies
SELECT 
  tablename,
  policyname,
  cmd as command_type
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('bookings', 'sides')
  AND policyname LIKE '%own_org%'
ORDER BY tablename, cmd, policyname;

-- Expected: 8 policies total
-- bookings: SELECT, INSERT, UPDATE, DELETE (4 policies)
-- sides: SELECT, INSERT, UPDATE, DELETE (4 policies)
