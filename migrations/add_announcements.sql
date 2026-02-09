-- Migration: Add announcements table and user tracking
-- System updates/announcements that can be shown to users on login

-- Create announcements table
CREATE TABLE IF NOT EXISTS public.announcements (
  id bigserial PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS announcements_published_at_idx
  ON public.announcements (published_at DESC)
  WHERE active = true;

-- Add column to profiles to track when user last saw announcements
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS announcements_last_seen_at timestamptz;

-- Enable RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Everyone can read active announcements
CREATE POLICY "Anyone can view active announcements"
  ON public.announcements
  FOR SELECT
  USING (active = true);

-- RLS Policy: Only admins can create/update announcements
-- (We'll check for super_admin or org admin in the function)
CREATE POLICY "Admins can manage announcements"
  ON public.announcements
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- Function to get new announcements for a user
CREATE OR REPLACE FUNCTION public.get_new_announcements(
  p_user_id uuid
)
RETURNS TABLE (
  id bigint,
  title text,
  message text,
  published_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_seen_at timestamptz;
BEGIN
  -- Get user's last seen timestamp
  SELECT p.announcements_last_seen_at INTO v_last_seen_at
  FROM public.profiles p
  WHERE p.id = p_user_id;

  -- If never seen, return latest announcement (or latest 1)
  IF v_last_seen_at IS NULL THEN
    RETURN QUERY
    SELECT 
      a.id AS id,
      a.title AS title,
      a.message AS message,
      a.published_at AS published_at
    FROM public.announcements a
    WHERE a.active = true
      AND (a.expires_at IS NULL OR a.expires_at > now())
    ORDER BY a.published_at DESC
    LIMIT 1;
  ELSE
    -- Return announcements published after last seen
    RETURN QUERY
    SELECT 
      a.id AS id,
      a.title AS title,
      a.message AS message,
      a.published_at AS published_at
    FROM public.announcements a
    WHERE a.active = true
      AND a.published_at > v_last_seen_at
      AND (a.expires_at IS NULL OR a.expires_at > now())
    ORDER BY a.published_at DESC;
  END IF;
END;
$$;

-- Function to acknowledge announcements (update last_seen_at)
CREATE OR REPLACE FUNCTION public.acknowledge_announcements(
  p_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET announcements_last_seen_at = now()
  WHERE id = p_user_id;
END;
$$;

COMMENT ON TABLE public.announcements IS
  'System announcements shown to users on login. Users can dismiss them.';

COMMENT ON COLUMN public.profiles.announcements_last_seen_at IS
  'Timestamp when user last acknowledged/viewed announcements. Used to determine if there are new announcements.';
