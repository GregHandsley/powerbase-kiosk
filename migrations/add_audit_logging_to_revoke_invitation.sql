-- Migration: Add audit logging to revoke_invitation function
-- This function is called when revoking invitations

-- First, get the current function definition:
-- SELECT pg_get_functiondef(oid) as function_definition
-- FROM pg_proc
-- WHERE proname = 'revoke_invitation'
--   AND pronamespace = 'public'::regnamespace;

-- This migration assumes the function signature is:
-- revoke_invitation(p_invitation_id bigint)

-- If your function has a different signature, adjust accordingly.

-- Drop the existing function first to allow return type change
DROP FUNCTION IF EXISTS public.revoke_invitation(bigint);

CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id bigint)
RETURNS TABLE(success boolean, error_message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $function$
DECLARE
  v_org_id bigint;
  v_invited_by uuid;
  v_email text;
  v_email_hash text;
  v_role text;
BEGIN
  -- Fetch invitation details BEFORE revoking (for audit logging)
  SELECT 
    i.organization_id,
    i.invited_by,
    i.email,
    i.role::text
  INTO v_org_id, v_invited_by, v_email, v_role
  FROM public.invitations i
  WHERE i.id = p_invitation_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invitation not found'::text;
    RETURN;
  END IF;

  -- Check if already revoked
  IF EXISTS (
    SELECT 1 FROM public.invitations
    WHERE id = p_invitation_id AND revoked_at IS NOT NULL
  ) THEN
    RETURN QUERY SELECT false, 'Invitation is already revoked'::text;
    RETURN;
  END IF;

  -- Check if already accepted
  IF EXISTS (
    SELECT 1 FROM public.invitations
    WHERE id = p_invitation_id AND accepted_at IS NOT NULL
  ) THEN
    RETURN QUERY SELECT false, 'Cannot revoke an accepted invitation'::text;
    RETURN;
  END IF;

  -- Revoke the invitation
  UPDATE public.invitations
  SET revoked_at = now()
  WHERE id = p_invitation_id
    AND revoked_at IS NULL
    AND accepted_at IS NULL;

  -- Check if update succeeded
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Failed to revoke invitation'::text;
    RETURN;
  END IF;

  -- Generate email hash for PII protection
  v_email_hash := encode(extensions.digest(lower(v_email), 'sha256'), 'hex');

  -- Log audit event: invitation revoked (BEFORE RETURN)
  BEGIN
    PERFORM public.log_audit_event(
      p_organization_id := v_org_id,
      p_site_id := NULL,
      p_event_type := 'invitation.revoked',
      p_entity_type := 'invitation',
      p_entity_id := NULL,
      p_actor_user_id := COALESCE(auth.uid(), v_invited_by),
      p_subject_user_id := NULL,
      p_old_value := NULL,
      p_new_value := NULL,
      p_metadata := jsonb_build_object(
        'invitation_id', p_invitation_id,
        'email_hash', v_email_hash,
        'role', v_role
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      NULL;  -- Fail-open: ignore audit errors
  END;

  -- Return success
  RETURN QUERY SELECT true, NULL::text;
END;
$function$;

COMMENT ON FUNCTION public.revoke_invitation(bigint) IS
  'Revokes an invitation by setting revoked_at. Logs audit event invitation.revoked.';
