-- Debug queries for audit log setup
-- Run these in Supabase SQL Editor to diagnose issues

-- 1. Check if audit_log table exists and has data
SELECT COUNT(*) as total_logs, 
       MIN(created_at) as oldest_log,
       MAX(created_at) as newest_log
FROM public.audit_log;

-- 2. Check recent audit logs (last 24 hours)
SELECT id, created_at, event_type, entity_type, organization_id, actor_user_id
FROM public.audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check if log_audit_event function exists
SELECT proname, proargnames, prosrc
FROM pg_proc
WHERE proname = 'log_audit_event'
  AND pronamespace = 'public'::regnamespace;

-- 4. Test calling log_audit_event directly (replace with your org ID)
-- This will help verify the function works
SELECT public.log_audit_event(
  p_organization_id := 1,  -- Replace with your organization ID
  p_event_type := 'test.event',
  p_entity_type := 'test',
  p_metadata := jsonb_build_object('test', true)
);

-- 5. Check if can_read_audit function exists
SELECT proname, proargnames
FROM pg_proc
WHERE proname = 'can_read_audit'
  AND pronamespace = 'public'::regnamespace;

-- 6. Check RLS policies on audit_log
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'audit_log';

-- 7. Check if create_invitation function has audit logging
-- Look for "log_audit_event" in the function body
SELECT 
  proname,
  CASE 
    WHEN prosrc LIKE '%log_audit_event%' THEN 'HAS audit logging'
    ELSE 'MISSING audit logging'
  END as audit_status
FROM pg_proc
WHERE proname IN ('create_invitation', 'create_invitation_with_sites', 'revoke_invitation')
  AND pronamespace = 'public'::regnamespace;

-- 8. Check invitation creation events specifically
SELECT * FROM public.audit_log
WHERE event_type = 'invitation.created'
ORDER BY created_at DESC
LIMIT 10;
