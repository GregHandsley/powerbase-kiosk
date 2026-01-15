-- Invitations Table
-- This migration creates the invitations table to model invite lifecycle
-- Layer 3: Invitations (Access Control Entry Point) - 2.2.2

-- Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  organization_id BIGINT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'coach')),
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Ensure token_hash is unique (one active token per invitation)
  UNIQUE (token_hash),
  
  -- Enforce lowercase emails to prevent duplicate invites with different casing
  CONSTRAINT invitations_email_lowercase CHECK (email = lower(email))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invitations_email 
  ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_organization_id 
  ON public.invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token_hash 
  ON public.invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at 
  ON public.invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_invitations_status 
  ON public.invitations(accepted_at, revoked_at, expires_at);

-- Create a unique partial index to prevent duplicate pending invitations
-- This ensures only one pending invitation per email + organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_pending_unique 
  ON public.invitations(email, organization_id) 
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- Add comments for documentation
COMMENT ON TABLE public.invitations IS 
  'Stores invitation records for controlled user onboarding. Invitations can be accepted, revoked, or expire. IMPORTANT: Application code must insert emails using lower(email) to ensure consistency.';
COMMENT ON COLUMN public.invitations.organization_id IS 
  'Organization the user will join upon acceptance';
COMMENT ON COLUMN public.invitations.role IS 
  'Role the user will have in the organization (admin or coach)';
COMMENT ON COLUMN public.invitations.token_hash IS 
  'Hashed token used to validate invitation acceptance (never store plain tokens)';
COMMENT ON COLUMN public.invitations.expires_at IS 
  'When the invitation expires and becomes invalid';
COMMENT ON COLUMN public.invitations.accepted_at IS 
  'When the invitation was accepted (NULL if not yet accepted)';
COMMENT ON COLUMN public.invitations.revoked_at IS 
  'When the invitation was revoked (NULL if not revoked)';
COMMENT ON COLUMN public.invitations.invited_by IS 
  'User who created/sent this invitation';
COMMENT ON COLUMN public.invitations.email IS 
  'Email address of the person being invited (stored in lowercase)';
