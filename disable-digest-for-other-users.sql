-- Disable email digest for specific users (if needed)
-- Use this if you accidentally enabled it for users who shouldn't have it

-- Option 1: Disable for everyone EXCEPT your current user
UPDATE public.notification_preferences
SET 
  email_digest_enabled = false,
  email_digest_frequency = 'never',
  updated_at = now()
WHERE email_digest_enabled = true
  AND user_id != auth.uid();

-- Option 2: Disable for specific users by email
UPDATE public.notification_preferences
SET 
  email_digest_enabled = false,
  email_digest_frequency = 'never',
  updated_at = now()
WHERE email_digest_enabled = true
  AND user_id IN (
    SELECT id 
    FROM auth.users 
    WHERE email IN (
      'user1@example.com',
      'user2@example.com'
      -- Add emails you want to disable for
    )
  );

-- Option 3: Disable for all non-super-admins
UPDATE public.notification_preferences
SET 
  email_digest_enabled = false,
  email_digest_frequency = 'never',
  updated_at = now()
WHERE email_digest_enabled = true
  AND user_id NOT IN (
    SELECT id 
    FROM public.profiles 
    WHERE is_super_admin = true
  );

-- Option 4: Disable for everyone (nuclear option)
UPDATE public.notification_preferences
SET 
  email_digest_enabled = false,
  email_digest_frequency = 'never',
  updated_at = now()
WHERE email_digest_enabled = true;

-- Verify after disabling
SELECT 
  COUNT(*) as users_with_digest_remaining
FROM public.notification_preferences
WHERE email_digest_enabled = true;
