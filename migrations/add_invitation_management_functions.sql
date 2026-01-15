-- Invitation Management Functions
-- Functions for creating, resending, and revoking invitations
-- Layer 3: Invitations (Access Control Entry Point) - 2.2.4

-- Enable pgcrypto extension if not already enabled (for secure random token generation)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to create a new invitation
-- Generates a secure random token, hashes it, and stores the invitation
CREATE OR REPLACE FUNCTION public.create_invitation(
  p_email TEXT,
  p_organization_id BIGINT,
  p_role TEXT,
  p_expires_in_days INTEGER DEFAULT 7,
  p_invited_by UUID DEFAULT auth.uid()
)
RETURNS TABLE(
  invitation_id BIGINT,
  token TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
  v_token_hash TEXT;
  v_invitation_id BIGINT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Validate inputs
  IF p_email IS NULL OR trim(p_email) = '' THEN
    RETURN QUERY SELECT NULL::BIGINT, NULL::TEXT, 'Email is required'::TEXT;
    RETURN;
  END IF;

  IF p_organization_id IS NULL THEN
    RETURN QUERY SELECT NULL::BIGINT, NULL::TEXT, 'Organization ID is required'::TEXT;
    RETURN;
  END IF;

  IF p_role NOT IN ('admin', 'coach') THEN
    RETURN QUERY SELECT NULL::BIGINT, NULL::TEXT, 'Role must be admin or coach'::TEXT;
    RETURN;
  END IF;

  -- Normalize email to lowercase
  p_email := lower(trim(p_email));

  -- Check if organization exists
  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = p_organization_id) THEN
    RETURN QUERY SELECT NULL::BIGINT, NULL::TEXT, 'Organization not found'::TEXT;
    RETURN;
  END IF;

  -- Generate a secure random token
  -- Using multiple UUIDs for entropy (gen_random_uuid() is built-in, no extension needed)
  v_token := 'inv_' || gen_random_uuid()::TEXT || '_' || replace(gen_random_uuid()::TEXT, '-', '') || '_' || replace(gen_random_uuid()::TEXT, '-', '');

  -- Hash the token using pgcrypto (schema-qualified for clarity)
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  -- Calculate expiration
  v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;

  -- Insert the invitation
  INSERT INTO public.invitations (
    email,
    organization_id,
    role,
    token_hash,
    expires_at,
    invited_by
  ) VALUES (
    p_email,
    p_organization_id,
    p_role,
    v_token_hash,
    v_expires_at,
    p_invited_by
  )
  RETURNING id INTO v_invitation_id;

  -- Return the invitation ID and plain token (only time token is returned)
  RETURN QUERY SELECT v_invitation_id, v_token, NULL::TEXT;
END;
$$;

-- Function to resend an invitation (rotate token)
-- Generates a new token for an existing invitation
CREATE OR REPLACE FUNCTION public.resend_invitation(
  p_invitation_id BIGINT,
  p_expires_in_days INTEGER DEFAULT 7
)
RETURNS TABLE(
  success BOOLEAN,
  token TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token TEXT;
  v_token_hash TEXT;
  v_expires_at TIMESTAMPTZ;
  v_invitation RECORD;
BEGIN
  -- Find the invitation
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  -- Check if invitation exists
  IF v_invitation IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, NULL::TEXT, 'Invitation not found'::TEXT;
    RETURN;
  END IF;

  -- Check if already accepted
  IF v_invitation.accepted_at IS NOT NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, NULL::TEXT, 'Invitation has already been accepted'::TEXT;
    RETURN;
  END IF;

  -- Generate a new secure random token
  -- Using multiple UUIDs for entropy (gen_random_uuid() is built-in, no extension needed)
  v_token := 'inv_' || gen_random_uuid()::TEXT || '_' || replace(gen_random_uuid()::TEXT, '-', '') || '_' || replace(gen_random_uuid()::TEXT, '-', '');

  -- Hash the new token using pgcrypto (schema-qualified for clarity)
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  -- Calculate new expiration
  v_expires_at := NOW() + (p_expires_in_days || ' days')::INTERVAL;

  -- Update the invitation with new token and expiration
  -- Clear revoked_at if it was previously revoked
  UPDATE public.invitations
  SET 
    token_hash = v_token_hash,
    expires_at = v_expires_at,
    revoked_at = NULL
  WHERE id = p_invitation_id;

  -- Return the new token
  RETURN QUERY SELECT true::BOOLEAN, v_token, NULL::TEXT;
END;
$$;

-- Function to revoke an invitation
CREATE OR REPLACE FUNCTION public.revoke_invitation(
  p_invitation_id BIGINT
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
  v_invitation RECORD;
BEGIN
  -- Find the invitation
  SELECT * INTO v_invitation
  FROM public.invitations
  WHERE id = p_invitation_id
  FOR UPDATE;

  -- Check if invitation exists
  IF v_invitation IS NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Invitation not found'::TEXT;
    RETURN;
  END IF;

  -- Check if already accepted
  IF v_invitation.accepted_at IS NOT NULL THEN
    RETURN QUERY SELECT false::BOOLEAN, 'Cannot revoke an accepted invitation'::TEXT;
    RETURN;
  END IF;

  -- Check if already revoked
  IF v_invitation.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT true::BOOLEAN, NULL::TEXT; -- Already revoked, return success
    RETURN;
  END IF;

  -- Revoke the invitation
  UPDATE public.invitations
  SET revoked_at = NOW()
  WHERE id = p_invitation_id;

  RETURN QUERY SELECT true::BOOLEAN, NULL::TEXT;
END;
$$;

-- Grant execute permissions
-- Only authenticated users (admins) can manage invitations
-- IMPORTANT: After running this migration, reload the Supabase schema cache:
-- Go to Supabase Dashboard → Settings → API → Click "Reload schema cache"
--
-- Note: PostgreSQL doesn't create multiple function signatures for default parameters.
-- There is only one function signature, so we only grant that one.
GRANT EXECUTE ON FUNCTION public.create_invitation(TEXT, BIGINT, TEXT, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resend_invitation(BIGINT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_invitation(BIGINT) TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.create_invitation(TEXT, BIGINT, TEXT, INTEGER, UUID) IS 
  'Creates a new invitation with a secure random token. Returns the invitation ID and plain token (only time token is returned).';
COMMENT ON FUNCTION public.resend_invitation(BIGINT, INTEGER) IS 
  'Resends an invitation by rotating the token. Generates a new token and extends expiration. Returns the new plain token.';
COMMENT ON FUNCTION public.revoke_invitation(BIGINT) IS 
  'Revokes an invitation by setting revoked_at timestamp. Cannot revoke accepted invitations.';
