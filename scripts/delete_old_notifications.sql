-- Script to manually delete old notifications that can't be deleted via UI
-- Run this in Supabase SQL Editor if you need to clean up old notifications

-- Option 1: Delete all notifications for a specific user
-- Replace 'USER_ID_HERE' with the actual user ID
-- DELETE FROM public.notifications WHERE user_id = 'USER_ID_HERE';

-- Option 2: Delete notifications older than a certain date
-- DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '30 days';

-- Option 3: Delete specific notifications by ID
-- Replace the IDs with the actual notification IDs you want to delete
-- DELETE FROM public.notifications WHERE id IN (1, 2, 3);

-- Option 4: Delete notifications that don't have a valid user_id (orphaned)
-- DELETE FROM public.notifications WHERE user_id NOT IN (SELECT id FROM auth.users);

-- To find notifications for debugging:
-- SELECT id, user_id, type, title, created_at, metadata 
-- FROM public.notifications 
-- ORDER BY created_at DESC 
-- LIMIT 50;

