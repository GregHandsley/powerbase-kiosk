-- Check where the audit logging code is in the function
-- This will help us see if it's in the right place

-- Get the function body and find where log_audit_event appears
SELECT 
  proname,
  -- Find the position of log_audit_event in the function
  position('log_audit_event' in prosrc) as audit_code_position,
  length(prosrc) as total_length,
  -- Check if it's after key phrases
  CASE 
    WHEN position('log_audit_event' in prosrc) > position('RETURN jsonb_build_object' in prosrc) THEN '❌ AFTER RETURN (too late!)'
    WHEN position('log_audit_event' in prosrc) > position('v_invitation_id IS NULL' in prosrc) THEN '✅ After null check'
    WHEN position('log_audit_event' in prosrc) > position('invitation_sites' in prosrc) THEN '✅ After site associations'
    WHEN position('log_audit_event' in prosrc) > position('create_invitation' in prosrc) THEN '✅ After create_invitation call'
    ELSE '⚠️ Check manually'
  END as placement_status,
  -- Check for exception handler
  CASE 
    WHEN prosrc LIKE '%EXCEPTION%WHEN OTHERS%' THEN 'Has exception handler'
    ELSE 'No exception handler found'
  END as exception_handler
FROM pg_proc
WHERE proname = 'create_invitation_with_sites'
  AND pronamespace = 'public'::regnamespace;

-- Get a snippet around the audit logging code to verify placement
SELECT 
  substring(
    prosrc,
    greatest(1, position('log_audit_event' in prosrc) - 200),
    400
  ) as code_snippet
FROM pg_proc
WHERE proname = 'create_invitation_with_sites'
  AND pronamespace = 'public'::regnamespace;
