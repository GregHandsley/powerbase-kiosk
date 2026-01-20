-- Get the full function definition and analyze its structure
-- This will help us understand why the audit code appears after RETURN

-- Get full function
SELECT pg_get_functiondef(oid) as full_function
FROM pg_proc
WHERE proname = 'create_invitation_with_sites'
  AND pronamespace = 'public'::regnamespace;

-- Also get positions of key elements
SELECT 
  proname,
  position('RETURN jsonb_build_object' in prosrc) as return_position,
  position('log_audit_event' in prosrc) as audit_position,
  position('PERFORM public.log_audit_event' in prosrc) as perform_position,
  -- Find the LAST RETURN statement (the final one)
  length(prosrc) - position(reverse('RETURN jsonb_build_object') in reverse(prosrc)) + 1 as last_return_position,
  length(prosrc) as total_length
FROM pg_proc
WHERE proname = 'create_invitation_with_sites'
  AND pronamespace = 'public'::regnamespace;

-- Get code snippet showing what's around the RETURN
SELECT 
  substring(
    prosrc,
    greatest(1, position('RETURN jsonb_build_object' in prosrc) - 150),
    300
  ) as code_around_return
FROM pg_proc
WHERE proname = 'create_invitation_with_sites'
  AND pronamespace = 'public'::regnamespace;

-- Get code snippet showing what's around the audit logging
SELECT 
  substring(
    prosrc,
    greatest(1, position('log_audit_event' in prosrc) - 50),
    200
  ) as code_around_audit
FROM pg_proc
WHERE proname = 'create_invitation_with_sites'
  AND pronamespace = 'public'::regnamespace;
