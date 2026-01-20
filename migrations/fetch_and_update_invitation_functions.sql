-- Step 1: Get the current function definitions
-- Run these queries first to see what your functions look like:

-- Get create_invitation function definition:
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'create_invitation'
  AND pronamespace = 'public'::regnamespace;

-- Get create_invitation_with_sites function definition:
SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'create_invitation_with_sites'
  AND pronamespace = 'public'::regnamespace;

-- ============================================================================
-- Step 2: After you get the function definitions above, you need to:
-- 1. Copy the function body
-- 2. Find the line that does: INSERT INTO invitations ... RETURNING id INTO <variable_name>
-- 3. Add the audit logging code block IMMEDIATELY AFTER that INSERT
-- 4. Run CREATE OR REPLACE FUNCTION with the updated body
--
-- The audit logging code to add:
-- ============================================================================

/*
BEGIN
  PERFORM public.log_audit_event(
    p_organization_id := p_organization_id,
    p_site_id := NULL,
    p_event_type := 'invitation.created',
    p_entity_type := 'invitation',
    p_entity_id := NULL,
    p_actor_user_id := COALESCE(p_invited_by, auth.uid()),
    p_subject_user_id := NULL,
    p_old_value := NULL,
    p_new_value := NULL,
    p_metadata := jsonb_build_object(
      'invitation_id', <your_invitation_id_variable>,  -- Replace with actual variable name
      'email_hash', encode(digest(lower(p_email), 'sha256'), 'hex'),
      'role', p_role,
      'expires_in_days', p_expires_in_days
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
*/

-- ============================================================================
-- Step 3: Example of what the updated function might look like
-- (This is a template - you MUST use your actual function definition)
-- ============================================================================

-- IMPORTANT: Replace this entire section with your actual function definition
-- and add the audit logging code after the INSERT statement.

-- Example structure (DO NOT RUN AS-IS - this is just a template):
/*
CREATE OR REPLACE FUNCTION public.create_invitation(
  p_email text,
  p_organization_id bigint,
  p_role text,
  p_expires_in_days integer DEFAULT 7,
  p_invited_by uuid DEFAULT auth.uid()
)
RETURNS TABLE(invitation_id bigint, token text, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation_id bigint;  -- Your variable name might be different
  v_token text;
  -- ... other variables ...
BEGIN
  -- Your existing logic here...
  
  -- Find this line (or similar):
  INSERT INTO public.invitations (email, organization_id, role, ...)
  VALUES (p_email, p_organization_id, p_role, ...)
  RETURNING id INTO v_invitation_id;  -- <-- Add audit logging AFTER this line
  
  -- ADD THIS CODE BLOCK HERE:
  BEGIN
    PERFORM public.log_audit_event(
      p_organization_id := p_organization_id,
      p_site_id := NULL,
      p_event_type := 'invitation.created',
      p_entity_type := 'invitation',
      p_entity_id := NULL,
      p_actor_user_id := COALESCE(p_invited_by, auth.uid()),
      p_subject_user_id := NULL,
      p_old_value := NULL,
      p_new_value := NULL,
      p_metadata := jsonb_build_object(
        'invitation_id', v_invitation_id,  -- Use your actual variable name
        'email_hash', encode(digest(lower(p_email), 'sha256'), 'hex'),
        'role', p_role,
        'expires_in_days', p_expires_in_days
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;
  
  -- Continue with your existing return logic...
  RETURN QUERY SELECT v_invitation_id, v_token, NULL::text;
END;
$$;
*/

-- ============================================================================
-- INSTRUCTIONS:
-- ============================================================================
-- 1. Run the SELECT queries at the top to get your function definitions
-- 2. Copy the function definition
-- 3. Find the INSERT ... RETURNING id INTO <variable> line
-- 4. Add the audit logging block immediately after that line
-- 5. Replace <your_invitation_id_variable> with your actual variable name
-- 6. Run CREATE OR REPLACE FUNCTION with the complete updated body
-- 7. Repeat for create_invitation_with_sites (add site_ids to metadata)
