-- Migration: Add notification_preferences table
-- 
-- INDIVIDUAL USER PREFERENCES (not system settings)
-- Allows each user to control which notification types they receive and how (in-app, email, or both)
-- 
-- This is separate from notification_settings (system-wide admin configuration):
-- - notification_settings: Admin controls system behavior (windows, schedules, who gets alerts)
-- - notification_preferences: Users control their personal preferences (what they want to receive)

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  in_app boolean NOT NULL DEFAULT true,
  email boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, type),
  CONSTRAINT notification_preferences_type_check CHECK (
    type IN (
      'booking:created',
      'booking:processed',
      'booking:edited',
      'booking:cancelled',
      'last_minute_change',
      'system:update',
      'feedback:response'
    )
  )
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS notification_preferences_user_id_idx
  ON public.notification_preferences (user_id);

-- Index for type lookups
CREATE INDEX IF NOT EXISTS notification_preferences_type_idx
  ON public.notification_preferences (type);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only view/edit their own preferences
CREATE POLICY "Users can view their own notification preferences"
  ON public.notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
  ON public.notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
  ON public.notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification preferences"
  ON public.notification_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to get or create default preferences for a user
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
  IF NOT FOUND THEN
    -- Default preferences vary by notification type
    CASE p_type
      WHEN 'booking:created' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
      WHEN 'booking:processed' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email (OFF by default)
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
      WHEN 'booking:edited' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
      WHEN 'booking:cancelled' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email (OFF by default)
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
      WHEN 'last_minute_change' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email (OFF by default)
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
      WHEN 'system:update' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
      WHEN 'feedback:response' THEN
        RETURN ROW(
          p_user_id,
          p_type,
          true,  -- in_app
          false, -- email (OFF by default)
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
          false, -- email
          true,  -- enabled
          now(),
          now()
        )::public.notification_preferences;
    END CASE;
  END IF;

  RETURN v_pref;
END;
$$;

-- Function to check if a notification should be sent (respects preferences)
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
    RETURN v_pref.email;
  END IF;

  RETURN false;
END;
$$;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_preferences_updated_at();

COMMENT ON TABLE public.notification_preferences IS
  'User preferences for notification types, controlling whether notifications are sent in-app, via email, or both.';

COMMENT ON COLUMN public.notification_preferences.in_app IS
  'Whether to show this notification type in the in-app notification bell/dropdown.';

COMMENT ON COLUMN public.notification_preferences.email IS
  'Whether to send this notification type via email.';

COMMENT ON COLUMN public.notification_preferences.enabled IS
  'Master switch: if false, no notifications of this type will be sent regardless of in_app/email settings.';
