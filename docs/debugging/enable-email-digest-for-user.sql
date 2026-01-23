-- Enable email digest for a specific user
-- Replace 'YOUR_USER_ID' with the actual user ID (UUID)

-- Option 1: Update existing notification preferences
-- This will enable digest on all existing preference rows for the user
UPDATE public.notification_preferences
SET 
  email_digest_enabled = true,
  email_digest_frequency = 'daily',  -- or 'weekly'
  updated_at = now()
WHERE user_id = 'YOUR_USER_ID'::uuid;

-- Option 2: If user has no preferences yet, create one and enable digest
-- This creates a preference for 'booking:created' type and enables digest
INSERT INTO public.notification_preferences (
  user_id,
  type,
  in_app,
  email,
  enabled,
  email_digest_enabled,
  email_digest_frequency
)
VALUES (
  'YOUR_USER_ID'::uuid,
  'booking:created',
  true,
  false,
  true,
  true,  -- Enable digest
  'daily'  -- or 'weekly'
)
ON CONFLICT (user_id, type) 
DO UPDATE SET
  email_digest_enabled = true,
  email_digest_frequency = 'daily',
  updated_at = now();

-- Option 3: Enable digest for your current user (if you're logged in)
-- This uses auth.uid() to get your current user ID
UPDATE public.notification_preferences
SET 
  email_digest_enabled = true,
  email_digest_frequency = 'daily',
  updated_at = now()
WHERE user_id = auth.uid();

-- If you have no preferences, create one:
INSERT INTO public.notification_preferences (
  user_id,
  type,
  in_app,
  email,
  enabled,
  email_digest_enabled,
  email_digest_frequency
)
SELECT 
  auth.uid(),
  'booking:created',
  true,
  false,
  true,
  true,
  'daily'
WHERE NOT EXISTS (
  SELECT 1 
  FROM public.notification_preferences 
  WHERE user_id = auth.uid()
)
ON CONFLICT (user_id, type) 
DO UPDATE SET
  email_digest_enabled = true,
  email_digest_frequency = 'daily',
  updated_at = now();

-- Verify it worked:
SELECT 
  user_id,
  type,
  email_digest_enabled,
  email_digest_frequency
FROM public.notification_preferences
WHERE email_digest_enabled = true;
