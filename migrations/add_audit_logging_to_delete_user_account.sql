-- Migration: Add audit logging to delete_user_account function
-- This function is called when users delete their accounts
-- It should log invitation.deleted events for accepted invitations

-- First, get the current function definition:
-- SELECT pg_get_functiondef(oid) as function_definition
-- FROM pg_proc
-- WHERE proname = 'delete_user_account'
--   AND pronamespace = 'public'::regnamespace;

-- This migration assumes the function signature is:
-- delete_user_account(user_id uuid)

-- If your function has a different signature, adjust accordingly.

-- Note: This migration adds audit logging AFTER the invitations are marked as deleted.
-- The audit logging should happen for each accepted invitation that gets deleted.

CREATE OR REPLACE FUNCTION public.delete_user_account(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'auth'
AS $function$
DECLARE
  anonymized_name text;
  result jsonb;
  current_user_id uuid;
  deleted_at_value timestamptz;
  deleted_email text;
  v_invitation_record RECORD;
  v_email_hash text;
BEGIN
  -- Security check: Get the current authenticated user
  current_user_id := auth.uid();

  -- If auth.uid() is null, allow only service_role calls
  IF current_user_id IS NULL THEN
    IF auth.role() = 'service_role' THEN
      current_user_id := user_id; -- service role allowed to act on provided user_id
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Not authenticated'
      );
    END IF;
  END IF;

  -- Security check: Users can only delete their own account
  IF current_user_id != user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only delete your own account'
    );
  END IF;

  -- Check if profile exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Profile not found'
    );
  END IF;

  -- Check if already deleted
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND is_deleted = true) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Account is already deleted'
    );
  END IF;

  -- Get the email of the user being deleted for invitation updates
  SELECT lower(email) INTO deleted_email
  FROM auth.users
  WHERE id = user_id;

  -- Generate anonymized name (first 8 chars of UUID for reference)
  anonymized_name := 'Deleted User ' || substring(user_id::text from 1 for 8);

  -- Capture deletion timestamp once for consistency
  deleted_at_value := now();

  -- Step 1: Soft delete and anonymize ALL PII in profile
  UPDATE public.profiles
  SET 
    full_name = anonymized_name,
    is_deleted = true,
    deleted_at = deleted_at_value
  WHERE id = user_id;

  -- Step 1b: Explicitly null out optional PII columns if they exist (dynamic check)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET avatar_url = NULL WHERE id = $1' USING user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET phone = NULL WHERE id = $1' USING user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'bio'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET bio = NULL WHERE id = $1' USING user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'display_name'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET display_name = NULL WHERE id = $1' USING user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'username'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET username = NULL WHERE id = $1' USING user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'website'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET website = NULL WHERE id = $1' USING user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'location'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET location = NULL WHERE id = $1' USING user_id;
  END IF;

  -- Step 6: Mark accepted invitations for this email as deleted AND log audit events
  IF deleted_email IS NOT NULL THEN
    -- Update invitations first
    UPDATE public.invitations
    SET deleted_at = COALESCE(deleted_at, deleted_at_value)
    WHERE lower(email) = deleted_email
      AND accepted_at IS NOT NULL;

    -- Then log audit events for each deleted invitation
    FOR v_invitation_record IN
      SELECT 
        i.id,
        i.organization_id,
        i.invited_by,
        i.email,
        i.role::text
      FROM public.invitations i
      WHERE lower(i.email) = deleted_email
        AND i.accepted_at IS NOT NULL
        AND i.deleted_at = deleted_at_value  -- Only log for invitations we just marked as deleted
    LOOP
      -- Generate email hash for PII protection
      v_email_hash := encode(extensions.digest(lower(v_invitation_record.email), 'sha256'), 'hex');

      -- Log audit event: invitation deleted (fail-open)
      BEGIN
        PERFORM public.log_audit_event(
          p_organization_id := v_invitation_record.organization_id,
          p_site_id := NULL,
          p_event_type := 'invitation.deleted',
          p_entity_type := 'invitation',
          p_entity_id := NULL,
          p_actor_user_id := user_id,  -- The user deleting their account
          p_subject_user_id := user_id,  -- Also the subject (they're deleting themselves)
          p_old_value := NULL,
          p_new_value := NULL,
          p_metadata := jsonb_build_object(
            'invitation_id', v_invitation_record.id,
            'email_hash', v_email_hash,
            'role', v_invitation_record.role,
            'deleted_by_user', true  -- Indicates this was a user-initiated account deletion
          )
        );
      EXCEPTION
        WHEN OTHERS THEN
          NULL;  -- Fail-open: ignore audit errors
      END;
    END LOOP;
  END IF;

  -- Return success result
  result := jsonb_build_object(
    'success', true,
    'message', 'Account deleted and anonymised successfully',
    'user_id', user_id,
    'anonymized_name', anonymized_name,
    'deleted_at', deleted_at_value
  );

  RETURN result;
END;
$function$;

ALTER FUNCTION public.delete_user_account(uuid)
  SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.delete_user_account(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_user_account(uuid) IS 
  'GDPR-safe account deletion: soft deletes profile, anonymizes all PII, marks accepted invitations as deleted, and logs audit events. Allows service_role to act on provided user_id.';
