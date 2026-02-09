-- Diagnostic queries to check if email digest is set up correctly
-- Run these in Supabase SQL Editor

-- 1. Check if the migration functions exist
SELECT 
  proname as function_name,
  CASE 
    WHEN proname IN ('get_users_for_email_digest', 'get_unread_notifications_for_digest', 'mark_notifications_read_for_digest')
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM pg_proc
WHERE proname IN (
  'get_users_for_email_digest',
  'get_unread_notifications_for_digest', 
  'mark_notifications_read_for_digest'
)
AND pronamespace = 'public'::regnamespace
ORDER BY proname;

-- 2. Check if notification_preferences table has email_digest columns
SELECT 
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notification_preferences'
  AND column_name IN ('email_digest_enabled', 'email_digest_frequency')
ORDER BY column_name;

-- 3. Check if any users have digest enabled
SELECT 
  user_id,
  email_digest_enabled,
  email_digest_frequency,
  COUNT(*) as preference_count
FROM public.notification_preferences
WHERE email_digest_enabled = true
GROUP BY user_id, email_digest_enabled, email_digest_frequency;

-- 4. Test the get_users_for_email_digest function
SELECT * FROM public.get_users_for_email_digest('daily');

-- 5. Check if there are any notifications to send
SELECT 
  n.id,
  n.user_id,
  n.type,
  n.title,
  n.read_at,
  n.created_at
FROM public.tasks n
WHERE n.read_at IS NULL
  AND n.user_id IN (
    SELECT user_id 
    FROM public.notification_preferences 
    WHERE email_digest_enabled = true 
      AND email_digest_frequency = 'daily'
  )
ORDER BY n.created_at DESC
LIMIT 10;

-- 6. Check notification_preferences structure
SELECT 
  user_id,
  type,
  in_app,
  email,
  enabled,
  email_digest_enabled,
  email_digest_frequency
FROM public.notification_preferences
ORDER BY user_id, type
LIMIT 20;
