-- Migration: Add email digest preferences to notification_preferences table
-- Allows users to receive a daily or weekly summary of unread notifications via email

-- Add email digest columns to notification_preferences
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS email_digest_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS email_digest_frequency text NOT NULL DEFAULT 'daily'
  CHECK (email_digest_frequency IN ('daily', 'weekly', 'never'));

-- Update the comment to reflect digest functionality
COMMENT ON COLUMN public.notification_preferences.email_digest_enabled IS
  'If true, user will receive email digests summarizing unread notifications instead of individual emails.';

COMMENT ON COLUMN public.notification_preferences.email_digest_frequency IS
  'Frequency of email digests: daily, weekly, or never. Only applies if email_digest_enabled is true.';

-- Function to get users who should receive email digests
CREATE OR REPLACE FUNCTION public.get_users_for_email_digest(
  p_frequency text DEFAULT 'daily'
)
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  digest_frequency text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    np.user_id,
    au.email,
    COALESCE(p.full_name, 'User') as full_name,
    np.email_digest_frequency as digest_frequency
  FROM public.notification_preferences np
  INNER JOIN auth.users au ON au.id = np.user_id
  LEFT JOIN public.profiles p ON p.id = np.user_id
  WHERE np.email_digest_enabled = true
    AND np.email_digest_frequency = p_frequency
    AND au.email IS NOT NULL
    AND (p.is_deleted IS NULL OR p.is_deleted = false);
END;
$$;

-- Function to get unread notifications for a user (for digest)
-- Only includes notifications for types that are enabled in user's preferences
-- This respects individual notification type toggles (enabled/disabled)
-- Note: Must drop and recreate because we're changing the return type (id: integer -> bigint)

DROP FUNCTION IF EXISTS public.get_unread_notifications_for_digest(uuid, timestamptz);

CREATE FUNCTION public.get_unread_notifications_for_digest(
  p_user_id uuid,
  p_since timestamptz DEFAULT (now() - interval '7 days')
)
RETURNS TABLE (
  id bigint,
  type text,
  title text,
  message text,
  link text,
  created_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.type,
    n.title,
    n.message,
    n.link,
    n.created_at,
    n.metadata
  FROM public.tasks n
  INNER JOIN public.notification_preferences np 
    ON np.user_id = n.user_id 
    AND np.type = n.type
  WHERE n.user_id = p_user_id
    AND n.read_at IS NULL
    AND n.created_at >= p_since
    AND np.enabled = true  -- Only include notifications for enabled types
    AND np.email_digest_enabled = true  -- Only if digest is enabled for this type
  ORDER BY n.created_at DESC;
END;
$$;

-- Function to mark notifications as read after digest is sent
CREATE OR REPLACE FUNCTION public.mark_notifications_read_for_digest(
  p_user_id uuid,
  p_notification_ids integer[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.notifications
  SET read_at = now()
  WHERE user_id = p_user_id
    AND id = ANY(p_notification_ids)
    AND read_at IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.get_users_for_email_digest IS
  'Returns users who have email digest enabled for the specified frequency (daily or weekly).';

COMMENT ON FUNCTION public.get_unread_notifications_for_digest IS
  'Returns unread notifications for a user within the specified time period, for inclusion in email digest.';

COMMENT ON FUNCTION public.mark_notifications_read_for_digest IS
  'Marks specified notifications as read after they have been included in an email digest.';
