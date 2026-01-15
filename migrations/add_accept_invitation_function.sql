-- Accept Invitation Function
-- This function handles the invitation acceptance flow
-- Layer 3: Invitations (Access Control Entry Point) - 2.2.3
--
-- This function validates the invitation token and creates the necessary records.
-- Note: User creation in auth.users must be done via Supabase Auth API from the frontend.
-- This function only handles the database-side operations after user is created.
--
-- IMPORTANT: The function accepts a plain token and hashes it internally for comparison.
-- This ensures tokens are never sent in plain text over the network.

-- Enable pgcrypto extension if not already enabled (for hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.validate_invitation_token(token TEXT)
RETURNS TABLE(
  invitation_id BIGINT,
  email TEXT,
  organization_id BIGINT,
  role TEXT,
  is_valid BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  inv_record RECORD;
BEGIN
  -- Hash the provided token and find the invitation
  -- Using SHA256 for token hashing
  -- token_hash is unique, so LIMIT 1 is unnecessary
  SELECT 
    inv.id,
    inv.email,
    inv.organization_id,
    inv.role,
    inv.expires_at,
    inv.accepted_at,
    inv.revoked_at
  INTO inv_record
  FROM public.invitations AS inv
  WHERE inv.token_hash = encode(extensions.digest(validate_invitation_token.token, 'sha256'), 'hex');

  -- If invitation not found
  IF inv_record IS NULL THEN
    RETURN QUERY SELECT 
      NULL::BIGINT,
      NULL::TEXT,
      NULL::BIGINT,
      NULL::TEXT,
      false::BOOLEAN,
      'Invalid invitation token'::TEXT;
    RETURN;
  END IF;

  -- Check if already accepted
  IF inv_record.accepted_at IS NOT NULL THEN
    RETURN QUERY SELECT 
      inv_record.id,
      inv_record.email,
      inv_record.organization_id,
      inv_record.role,
      false::BOOLEAN,
      'This invitation has already been accepted'::TEXT;
    RETURN;
  END IF;

  -- Check if revoked
  IF inv_record.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT 
      inv_record.id,
      inv_record.email,
      inv_record.organization_id,
      inv_record.role,
      false::BOOLEAN,
      'This invitation has been revoked'::TEXT;
    RETURN;
  END IF;

  -- Check if expired
  IF inv_record.expires_at < NOW() THEN
    RETURN QUERY SELECT 
      inv_record.id,
      inv_record.email,
      inv_record.organization_id,
      inv_record.role,
      false::BOOLEAN,
      'This invitation has expired'::TEXT;
    RETURN;
  END IF;

  -- All checks passed - invitation is valid
  RETURN QUERY SELECT 
    inv_record.id,
    inv_record.email,
    inv_record.organization_id,
    inv_record.role,
    true::BOOLEAN,
    NULL::TEXT;
END;
$$;

-- Function to finalize invitation acceptance
-- Called after user is created via Supabase Auth API
-- Accepts plain token (will be hashed internally)
-- Requires user_email to verify it matches the invitation email
CREATE OR REPLACE FUNCTION public.accept_invitation(
  token TEXT,
  user_id UUID,
  user_email TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  inv_record RECORD;
  existing_membership RECORD;
BEGIN
  -- Hash the provided token and validate the invitation
  -- FOR UPDATE locks the row to prevent race conditions (double acceptance)
  -- token_hash is unique, so LIMIT 1 is unnecessary
  SELECT 
    inv.id,
    inv.email,
    inv.organization_id,
    inv.role,
    inv.expires_at,
    inv.accepted_at,
    inv.revoked_at
  INTO inv_record
  FROM public.invitations AS inv
  WHERE inv.token_hash = encode(extensions.digest(accept_invitation.token, 'sha256'), 'hex')
  FOR UPDATE;

  -- Check if invitation exists
  IF inv_record IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Invalid invitation token'::TEXT;
    RETURN;
  END IF;

  -- Check if already accepted
  IF inv_record.accepted_at IS NOT NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Invitation already accepted'::TEXT;
    RETURN;
  END IF;

  -- Check if revoked
  IF inv_record.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Invitation has been revoked'::TEXT;
    RETURN;
  END IF;

  -- Check if expired
  IF inv_record.expires_at < NOW() THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Invitation has expired'::TEXT;
    RETURN;
  END IF;

  -- Verify user email matches invitation email
  -- This is a security check to ensure the user was created with the correct email
  IF lower(trim(accept_invitation.user_email)) != lower(inv_record.email) THEN
    RETURN QUERY SELECT false::BOOLEAN, 'User email does not match invitation email'::TEXT;
    RETURN;
  END IF;

  -- Check if user already has a membership in this organization
  SELECT * INTO existing_membership
  FROM public.organization_memberships AS om
  WHERE om.user_id = accept_invitation.user_id
    AND om.organization_id = inv_record.organization_id;

  IF existing_membership IS NOT NULL THEN
    -- User already has membership, but we should still mark invitation as accepted
    UPDATE public.invitations
    SET accepted_at = NOW()
    WHERE id = inv_record.id;
    
    RETURN QUERY SELECT true::BOOLEAN, NULL::TEXT;
    RETURN;
  END IF;

  -- Create organization membership
  INSERT INTO public.organization_memberships (organization_id, user_id, role)
  VALUES (inv_record.organization_id, accept_invitation.user_id, inv_record.role)
  ON CONFLICT ON CONSTRAINT organization_memberships_organization_id_user_id_key DO NOTHING;

  -- Create profile if it doesn't exist (identity only, no role)
  -- Roles belong in organization_memberships, not profiles
  -- This supports multi-org where a user can have different roles in different orgs
  INSERT INTO public.profiles (id)
  VALUES (accept_invitation.user_id)
  ON CONFLICT (id) DO NOTHING;

  -- Mark invitation as accepted
  UPDATE public.invitations
  SET accepted_at = NOW()
  WHERE id = inv_record.id;

  RETURN QUERY SELECT true::BOOLEAN, NULL::TEXT;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invitation(TEXT, UUID, TEXT) TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.validate_invitation_token(TEXT) IS 
  'Validates an invitation token (plain text, will be hashed internally) and returns invitation details if valid. Can be called by anyone (anon) to check token validity.';
COMMENT ON FUNCTION public.accept_invitation(TEXT, UUID, TEXT) IS 
  'Finalizes invitation acceptance after user is created. Accepts plain token (will be hashed internally) and user_email for verification. Creates organization membership and profile (identity only, roles in memberships), marks invitation as accepted. Uses FOR UPDATE to prevent race conditions.';
