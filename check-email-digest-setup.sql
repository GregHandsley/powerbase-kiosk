-- Complete diagnostic for email digest setup
-- Run this in Supabase SQL Editor to see the full picture

-- 1. Check if any users have digest enabled
SELECT 
  np.user_id,
  p.email,
  np.email_digest_enabled,
  np.email_digest_frequency,
  COUNT(*) as total_preferences
FROM public.notification_preferences np
LEFT JOIN auth.users u ON u.id = np.user_id
LEFT JOIN public.profiles p ON p.id = np.user_id
WHERE np.email_digest_enabled = true
GROUP BY np.user_id, p.email, np.email_digest_enabled, np.email_digest_frequency;

-- 2. Test get_users_for_email_digest function
SELECT * FROM public.get_users_for_email_digest('daily');

-- 3. Check if those users have any unread notifications
SELECT 
  n.id,
  n.user_id,
  n.type,
  n.title,
  n.read_at,
  n.created_at,
  CASE WHEN n.read_at IS NULL THEN 'Unread' ELSE 'Read' END as status
FROM public.tasks n
WHERE n.user_id IN (
  SELECT user_id 
  FROM public.notification_preferences 
  WHERE email_digest_enabled = true 
    AND email_digest_frequency = 'daily'
)
ORDER BY n.created_at DESC
LIMIT 20;

-- 4. Count unread notifications per user (for digest)
SELECT 
  n.user_id,
  COUNT(*) as unread_count
FROM public.tasks n
WHERE n.read_at IS NULL
  AND n.user_id IN (
    SELECT user_id 
    FROM public.notification_preferences 
    WHERE email_digest_enabled = true 
      AND email_digest_frequency = 'daily'
  )
GROUP BY n.user_id;

-- 5. Show all notification preferences (to see current state)
SELECT 
  user_id,
  type,
  enabled,
  in_app,
  email,
  email_digest_enabled,
  email_digest_frequency
FROM public.notification_preferences
ORDER BY user_id, type
LIMIT 50;
