-- Migration: Add audit logging to create_invitation function
-- This function is called when creating invitations without sites

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
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_token TEXT;
  v_token_hash TEXT;
  v_invitation_id BIGINT;
  v_expires_at TIMESTAMPTZ;
  v_role_enum public.org_role;
BEGIN
  -- Permission check: user must have invitations.create permission
  IF NOT public.has_permission(auth.uid(), p_organization_id, 'invitations.create') THEN
    RETURN QUERY SELECT
      NULL::BIGINT,
      NULL::TEXT,
      'Permission denied: You do not have permission to create invitations'::TEXT;
    RETURN;
  END IF;

  -- Validate organization exists
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RETURN QUERY SELECT
      NULL::BIGINT,
      NULL::TEXT,
      'Organization not found'::TEXT;
    RETURN;
  END IF;

  -- Validate role (cast to enum - will raise error if invalid)
  BEGIN
    v_role_enum := p_role::public.org_role;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN QUERY SELECT
        NULL::BIGINT,
        NULL::TEXT,
        format('Invalid role: %s. Must be one of: admin, bookings_team, coach, snc_coach, fitness_coach, customer_service_assistant, duty_manager, facility_manager', p_role)::TEXT;
      RETURN;
  END;

  -- Validate email format (basic check)
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN QUERY SELECT
      NULL::BIGINT,
      NULL::TEXT,
      'Email is required'::TEXT;
    RETURN;
  END IF;

  -- Normalize email to lowercase
  p_email := lower(trim(p_email));

  -- Check for duplicate pending invite (same email + org)
  IF EXISTS (
    SELECT 1
    FROM public.invitations
    WHERE email = p_email
      AND organization_id = p_organization_id
      AND accepted_at IS NULL
      AND revoked_at IS NULL
  ) THEN
    RETURN QUERY SELECT
      NULL::BIGINT,
      NULL::TEXT,
      'A pending invitation already exists for this email and organization'::TEXT;
    RETURN;
  END IF;

  -- Generate token (UUID-based for simplicity)
  v_token := 'inv_' || gen_random_uuid()::TEXT || '_' || encode(extensions.gen_random_bytes(16), 'hex');
  
  -- Hash the token
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  -- Calculate expiration
  v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;

  -- Insert invitation
  -- Security: Always use auth.uid() for invited_by to prevent spoofing
  INSERT INTO public.invitations (
    email,
    organization_id,
    role,
    token_hash,
    expires_at,
    invited_by
  )
  VALUES (
    p_email,
    p_organization_id,
    v_role_enum,  -- Use the validated enum value
    v_token_hash,
    v_expires_at,
    auth.uid()  -- Always use current user, ignore p_invited_by parameter
  )
  RETURNING id INTO v_invitation_id;

  -- Log audit event: invitation created (BEFORE RETURN QUERY)
  BEGIN
    PERFORM public.log_audit_event(
      p_organization_id := p_organization_id,
      p_site_id := NULL,
      p_event_type := 'invitation.created',
      p_entity_type := 'invitation',
      p_entity_id := NULL,
      p_actor_user_id := auth.uid(),
      p_subject_user_id := NULL,
      p_old_value := NULL,
      p_new_value := NULL,
      p_metadata := jsonb_build_object(
        'invitation_id', v_invitation_id,
        'email_hash', encode(extensions.digest(lower(p_email), 'sha256'), 'hex'),
        'role', p_role,
        'expires_in_days', p_expires_in_days
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      NULL;  -- Fail-open: ignore audit errors
  END;

  -- Return success
  RETURN QUERY SELECT
    v_invitation_id,
    v_token,
    NULL::TEXT;
END;
$function$;
