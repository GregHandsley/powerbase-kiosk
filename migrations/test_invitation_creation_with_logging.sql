-- Test creating an invitation and immediately check for audit log
-- This helps verify the audit logging is working

-- Step 1: Create a test invitation (replace with your actual values)
-- Note: This might fail if email already exists, that's okay
DO $$
DECLARE
  v_result jsonb;
  v_invitation_id bigint;
  v_audit_count integer;
BEGIN
  -- Try to create an invitation
  -- Replace these values with your actual test data
  SELECT public.create_invitation_with_sites(
    p_email := 'test-audit-' || extract(epoch from now())::text || '@example.com',
    p_organization_id := 1,  -- Replace with your org ID
    p_role := 'snc_coach',
    p_expires_in_days := 7,
    p_invited_by := auth.uid(),
    p_site_ids := ARRAY[]::bigint[]
  ) INTO v_result;

  -- Check if it succeeded
  IF v_result->>'success' = 'true' THEN
    v_invitation_id := (v_result->>'invitation_id')::bigint;
    RAISE NOTICE 'Invitation created with ID: %', v_invitation_id;
    
    -- Wait a moment for the audit log to be written
    PERFORM pg_sleep(0.1);
    
    -- Check for audit log
    SELECT COUNT(*) INTO v_audit_count
    FROM public.audit_log
    WHERE event_type = 'invitation.created'
      AND metadata->>'invitation_id' = v_invitation_id::text;
    
    IF v_audit_count > 0 THEN
      RAISE NOTICE '✅ Audit log created successfully!';
    ELSE
      RAISE WARNING '❌ No audit log found for invitation_id: %', v_invitation_id;
      
      -- Show recent audit logs to see what's there
      RAISE NOTICE 'Recent audit logs:';
      FOR v_audit_count IN 
        SELECT id, created_at, event_type, metadata
        FROM public.audit_log
        ORDER BY created_at DESC
        LIMIT 5
      LOOP
        RAISE NOTICE '  - %: %', v_audit_count, v_audit_count;
      END LOOP;
    END IF;
  ELSE
    RAISE WARNING 'Invitation creation failed: %', v_result->>'error_message';
  END IF;
END $$;

-- Step 2: Check for any invitation.created events
SELECT 
  id,
  created_at,
  event_type,
  organization_id,
  metadata->>'invitation_id' as invitation_id,
  metadata->>'role' as role
FROM public.audit_log
WHERE event_type = 'invitation.created'
ORDER BY created_at DESC
LIMIT 10;
