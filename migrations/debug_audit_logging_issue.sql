-- Comprehensive debugging for audit logging issues
-- Run these queries one by one to diagnose the problem

-- 1. Verify the function was updated (should show "HAS audit logging")
SELECT 
  proname,
  CASE 
    WHEN prosrc LIKE '%log_audit_event%' THEN '✅ HAS audit logging'
    ELSE '❌ MISSING audit logging'
  END as audit_status
FROM pg_proc
WHERE proname IN ('create_invitation', 'create_invitation_with_sites')
  AND pronamespace = 'public'::regnamespace;

-- 2. Check if log_audit_event function exists and is callable
SELECT 
  proname,
  proargnames,
  CASE 
    WHEN prosecdef THEN 'SECURITY DEFINER'
    ELSE 'SECURITY INVOKER'
  END as security_type
FROM pg_proc
WHERE proname = 'log_audit_event'
  AND pronamespace = 'public'::regnamespace;

-- 3. Test log_audit_event directly (replace with your org ID)
-- This should return a UUID and create a row in audit_log
SELECT public.log_audit_event(
  p_organization_id := 1,  -- Replace with your organization ID
  p_event_type := 'test.direct_call',
  p_entity_type := 'test',
  p_metadata := jsonb_build_object('test', true, 'timestamp', now()::text)
) as audit_log_id;

-- 4. Check if the test log was created
SELECT id, created_at, event_type, organization_id, metadata
FROM public.audit_log
WHERE event_type = 'test.direct_call'
ORDER BY created_at DESC
LIMIT 5;

-- 5. Check for any recent errors in PostgreSQL logs
-- (This might not work in Supabase, but worth trying)
-- SELECT * FROM pg_stat_statements WHERE query LIKE '%log_audit_event%';

-- 6. Verify RLS is not blocking inserts (log_audit_event uses SECURITY DEFINER, so it should bypass RLS)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'audit_log';

-- 7. Check RLS policies on audit_log
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'audit_log';

-- 8. Try to manually insert into audit_log (should work if RLS allows)
-- Replace with your org ID and user ID
INSERT INTO public.audit_log (
  organization_id,
  event_type,
  entity_type,
  actor_user_id,
  metadata
) VALUES (
  1,  -- Your org ID
  'test.manual_insert',
  'test',
  auth.uid(),  -- Current user
  jsonb_build_object('test', true)
)
RETURNING id, created_at;

-- 9. Check if manual insert worked
SELECT * FROM public.audit_log
WHERE event_type = 'test.manual_insert'
ORDER BY created_at DESC
LIMIT 5;

-- 10. Check the actual function body to see if audit logging code is there
-- Look for "log_audit_event" in the output
SELECT 
  proname,
  substring(prosrc, 1, 500) as function_start,  -- First 500 chars
  CASE 
    WHEN prosrc LIKE '%log_audit_event%' THEN 'Found log_audit_event call'
    ELSE 'log_audit_event NOT FOUND'
  END as audit_check
FROM pg_proc
WHERE proname = 'create_invitation_with_sites'
  AND pronamespace = 'public'::regnamespace;

-- 11. Get full function body to verify the audit logging code placement
SELECT pg_get_functiondef(oid) as full_function_definition
FROM pg_proc
WHERE proname = 'create_invitation_with_sites'
  AND pronamespace = 'public'::regnamespace;

-- 12. Check if there are ANY audit logs at all
SELECT 
  COUNT(*) as total_logs,
  COUNT(DISTINCT event_type) as unique_event_types,
  MIN(created_at) as oldest_log,
  MAX(created_at) as newest_log
FROM public.audit_log;

-- 13. List all event types in audit_log
SELECT event_type, COUNT(*) as count
FROM public.audit_log
GROUP BY event_type
ORDER BY count DESC;
