-- Test script to verify announcements setup
-- Run this in Supabase SQL Editor to check if everything is set up correctly

-- 1. Check if announcements table exists
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'announcements')
    THEN '✅ announcements table exists'
    ELSE '❌ announcements table missing - run migrations/add_announcements.sql'
  END as table_status;

-- 2. Check if profiles.announcements_last_seen_at column exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'announcements_last_seen_at'
    )
    THEN '✅ announcements_last_seen_at column exists'
    ELSE '❌ announcements_last_seen_at column missing - run migrations/add_announcements.sql'
  END as column_status;

-- 3. Check if get_new_announcements function exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'get_new_announcements' 
      AND pronamespace = 'public'::regnamespace
    )
    THEN '✅ get_new_announcements function exists'
    ELSE '❌ get_new_announcements function missing - run migrations/add_announcements.sql'
  END as function_status;

-- 4. Check if acknowledge_announcements function exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'acknowledge_announcements' 
      AND pronamespace = 'public'::regnamespace
    )
    THEN '✅ acknowledge_announcements function exists'
    ELSE '❌ acknowledge_announcements function missing - run migrations/add_announcements.sql'
  END as ack_function_status;

-- 5. List all active announcements
SELECT 
  id,
  title,
  message,
  published_at,
  active,
  created_at
FROM public.announcements
WHERE active = true
ORDER BY published_at DESC;

-- 6. Check a specific user's last_seen_at (replace USER_ID with actual user ID)
-- SELECT 
--   id,
--   full_name,
--   announcements_last_seen_at
-- FROM public.profiles
-- WHERE id = 'USER_ID_HERE';

-- 7. Create a test announcement (uncomment and replace USER_ID)
-- INSERT INTO public.announcements (title, message, published_at, active, created_by)
-- VALUES (
--   'Test Announcement',
--   'This is a test announcement to verify the system is working.',
--   now(),
--   true,
--   'YOUR_USER_ID_HERE'::uuid
-- )
-- RETURNING *;

-- 8. Reset a user's last_seen_at to null (to test seeing announcements again)
-- UPDATE public.profiles
-- SET announcements_last_seen_at = NULL
-- WHERE id = 'USER_ID_HERE';
