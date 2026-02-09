-- Update default email preferences to be OFF for all notification types
-- This changes the default behavior so users must opt-in to email notifications
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.get_notification_preference(
  p_user_id uuid,
  p_type text
)
RETURNS public.notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pref public.notification_preferences;
BEGIN
  -- Try to get existing preference
  SELECT * INTO v_pref
  FROM public.notification_preferences
  WHERE user_id = p_user_id AND type = p_type;

  -- If not found, return defaults based on type
  -- ALL email defaults are now false (opt-in)
  IF NOT FOUND THEN
    -- Default preferences vary by notification type
    CASE p_type
      WHEN 'booking:created' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email (OFF by default)
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
      WHEN 'booking:processed' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email (OFF by default - changed from true)
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
      WHEN 'booking:edited' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email (OFF by default)
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
      WHEN 'booking:cancelled' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email (OFF by default - changed from true)
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
      WHEN 'last_minute_change' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email (OFF by default - changed from true)
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
      WHEN 'system:update' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email (OFF by default)
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
      WHEN 'feedback:response' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email (OFF by default - changed from true)
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
      ELSE
        -- Fallback defaults
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email (OFF by default)
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
    END CASE;
  END IF;

  RETURN v_pref;
END;
$$;

-- Verify the function was updated
SELECT 
  proname,
  'Function updated - all email defaults are now false' as status
FROM pg_proc
WHERE proname = 'get_notification_preference'
  AND pronamespace = 'public'::regnamespace;

-- Note: This only affects NEW users or when preferences don't exist
-- Existing users' preferences are not changed by this migration
