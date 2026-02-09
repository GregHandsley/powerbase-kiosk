-- Check which invitation functions have audit logging
SELECT 
  proname,
  CASE 
    WHEN prosrc LIKE '%log_audit_event%' THEN '✅ HAS audit logging'
    ELSE '❌ MISSING audit logging'
  END as audit_status
FROM pg_proc
WHERE proname IN ('create_invitation', 'create_invitation_with_sites')
  AND pronamespace = 'public'::regnamespace;
