-- Fix: Update should_send_notification to respect email digest preferences
-- When digest is enabled, individual email notifications should be suppressed
-- (they'll be sent in the digest instead)
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.should_send_notification(
  p_user_id uuid,
  p_type text,
  p_channel text -- 'in_app' or 'email'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pref public.notification_preferences;
BEGIN
  -- Get user's preference for this notification type
  SELECT * INTO v_pref
  FROM public.notification_preferences
  WHERE user_id = p_user_id AND type = p_type;

  -- If no preference exists, use defaults (allow in-app, disallow email)
  IF NOT FOUND THEN
    IF p_channel = 'in_app' THEN
      RETURN true; -- Default: allow in-app
    ELSE
      RETURN false; -- Default: disallow email
    END IF;
  END IF;

  -- Check if notification type is enabled
  IF NOT v_pref.enabled THEN
    RETURN false;
  END IF;

  -- Check channel-specific preference
  IF p_channel = 'in_app' THEN
    RETURN v_pref.in_app;
  ELSIF p_channel = 'email' THEN
    -- If digest is enabled for this type, suppress individual emails
    -- (they'll be included in the digest instead)
    IF v_pref.email_digest_enabled = true THEN
      RETURN false; -- Don't send individual email, will be in digest
    END IF;
    -- Otherwise, respect the email preference
    RETURN v_pref.email;
  END IF;

  RETURN false;
END;
$$;

-- Verify the function was updated
SELECT 
  proname,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc
WHERE proname = 'should_send_notification'
  AND pronamespace = 'public'::regnamespace;

-- Test the function (replace with your user ID and test values)
-- SELECT public.should_send_notification(
--   'YOUR_USER_UUID'::uuid,
--   'booking:created',
--   'email'
-- ) as should_send_email;
