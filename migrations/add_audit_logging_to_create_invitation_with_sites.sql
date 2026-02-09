-- Migration: Add audit logging to create_invitation_with_sites
-- This function calls create_invitation internally, so we'll add audit logging here
-- after the invitation is successfully created and sites are associated

CREATE OR REPLACE FUNCTION public.create_invitation_with_sites(
  p_email text,
  p_organization_id bigint,
  p_role text,
  p_expires_in_days integer DEFAULT 7,
  p_invited_by uuid DEFAULT NULL::uuid,
  p_site_ids bigint[] DEFAULT ARRAY[]::bigint[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_invitation_id bigint;
  v_token text;
  v_site_id bigint;
  v_error_message text;
BEGIN
  -- Call the existing create_invitation function to create the invitation
  SELECT invitation_id, token, error_message
  INTO v_invitation_id, v_token, v_error_message
  FROM public.create_invitation(
    p_email,
    p_organization_id,
    p_role,
    p_expires_in_days,
    p_invited_by
  );

  -- If create_invitation returned an error, bubble it up
  IF v_error_message IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_message', v_error_message,
      'token', NULL,
      'invitation_id', NULL
    );
  END IF;

  -- Check if invitation was created successfully
  IF v_invitation_id IS NULL OR v_token IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error_message', 'Failed to create invitation',
      'token', NULL,
      'invitation_id', NULL
    );
  END IF;

  -- Insert site associations if provided
  IF p_site_ids IS NOT NULL AND array_length(p_site_ids, 1) > 0 THEN
    FOREACH v_site_id IN ARRAY p_site_ids
    LOOP
      INSERT INTO public.invitation_sites (invitation_id, site_id)
      VALUES (v_invitation_id, v_site_id)
      ON CONFLICT (invitation_id, site_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Log audit event: invitation created (BEFORE RETURN - this is critical!)
  -- Note: We log here (not in create_invitation) to include site_ids in metadata
  -- and avoid duplicate logs when create_invitation_with_sites calls create_invitation
  BEGIN
    PERFORM public.log_audit_event(
      p_organization_id := p_organization_id,
      p_site_id := NULL,  -- Multiple sites possible, log in metadata
      p_event_type := 'invitation.created',
      p_entity_type := 'invitation',
      p_entity_id := NULL,
      p_actor_user_id := COALESCE(p_invited_by, auth.uid()),
      p_subject_user_id := NULL,
      p_old_value := NULL,
      p_new_value := NULL,
      p_metadata := jsonb_build_object(
        'invitation_id', v_invitation_id,
        'email_hash', encode(digest(lower(p_email), 'sha256'), 'hex'),
        'role', p_role,
        'expires_in_days', p_expires_in_days,
        'site_ids', COALESCE(p_site_ids, ARRAY[]::bigint[])
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Fail-open: ignore audit errors, don't break invitation creation
      NULL;
  END;

  -- Return success with token and invitation_id (MUST be after audit logging)
  RETURN jsonb_build_object(
    'success', true,
    'token', v_token,
    'invitation_id', v_invitation_id,
    'error_message', NULL
  );
END;
$function$;
