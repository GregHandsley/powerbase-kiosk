-- QUICK: Enable email digest for your current user
-- Run this in Supabase SQL Editor while logged in

-- Step 1: Enable digest on ALL existing preferences
UPDATE public.notification_preferences
SET 
  email_digest_enabled = true,
  email_digest_frequency = 'daily',
  updated_at = now()
WHERE user_id = auth.uid();

-- Step 2: Create preferences for all notification types (if missing)
-- This ensures digest is enabled on all types (matching UI behavior)
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
  type,
  true,  -- in_app
  false, -- email
  true,  -- enabled
  true,  -- email_digest_enabled
  'daily'  -- email_digest_frequency
FROM unnest(ARRAY[
  'booking:created',
  'booking:processed',
  'booking:edited',
  'booking:cancelled',
  'last_minute_change',
  'system:update',
  'feedback:response'
]::text[]) as type
ON CONFLICT (user_id, type) 
DO UPDATE SET
  email_digest_enabled = true,
  email_digest_frequency = 'daily',
  updated_at = now();

-- Step 3: Verify it worked
SELECT 
  '✅ Email digest enabled!' as status,
  user_id,
  email_digest_enabled,
  email_digest_frequency,
  COUNT(*) as preference_count
FROM public.notification_preferences
WHERE user_id = auth.uid()
  AND email_digest_enabled = true
GROUP BY user_id, email_digest_enabled, email_digest_frequency;
