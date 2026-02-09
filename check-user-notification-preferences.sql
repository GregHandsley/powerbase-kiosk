-- Check notification preferences for a specific user
-- Replace 'YOUR_USER_UUID' with the actual UUID, or use auth.uid() for current user

-- Option 1: Summary counts for a specific user
SELECT 
  COUNT(*) as total_preferences,
  COUNT(*) FILTER (WHERE enabled = true) as enabled_count,
  COUNT(*) FILTER (WHERE enabled = false) as disabled_count,
  COUNT(*) FILTER (WHERE in_app = true) as in_app_enabled,
  COUNT(*) FILTER (WHERE email = true) as email_enabled,
  COUNT(*) FILTER (WHERE email_digest_enabled = true) as digest_enabled
FROM public.notification_preferences
WHERE user_id = 'YOUR_USER_UUID'::uuid;  -- Replace with actual UUID

-- Option 2: Detailed breakdown by notification type
SELECT 
  type,
  enabled,
  in_app,
  email,
  email_digest_enabled,
  email_digest_frequency,
  created_at,
  updated_at
FROM public.notification_preferences
WHERE user_id = 'YOUR_USER_UUID'::uuid  -- Replace with actual UUID
ORDER BY type;

-- Option 3: For current logged-in user (uses auth.uid())
SELECT 
  COUNT(*) as total_preferences,
  COUNT(*) FILTER (WHERE enabled = true) as enabled_count,
  COUNT(*) FILTER (WHERE enabled = false) as disabled_count,
  COUNT(*) FILTER (WHERE in_app = true) as in_app_enabled,
  COUNT(*) FILTER (WHERE email = true) as email_enabled,
  COUNT(*) FILTER (WHERE email_digest_enabled = true) as digest_enabled
FROM public.notification_preferences
WHERE user_id = auth.uid();

-- Option 4: Detailed breakdown for current user
SELECT 
  type,
  enabled,
  in_app,
  email,
  email_digest_enabled,
  email_digest_frequency,
  created_at,
  updated_at
FROM public.notification_preferences
WHERE user_id = auth.uid()
ORDER BY type;

-- Option 5: Summary with user info
SELECT 
  au.email,
  p.full_name,
  COUNT(*) as total_preferences,
  COUNT(*) FILTER (WHERE np.enabled = true) as enabled_count,
  COUNT(*) FILTER (WHERE np.enabled = false) as disabled_count,
  COUNT(*) FILTER (WHERE np.in_app = true) as in_app_enabled,
  COUNT(*) FILTER (WHERE np.email = true) as email_enabled,
  COUNT(*) FILTER (WHERE np.email_digest_enabled = true) as digest_enabled
FROM public.notification_preferences np
LEFT JOIN auth.users au ON au.id = np.user_id
LEFT JOIN public.profiles p ON p.id = np.user_id
WHERE np.user_id = 'YOUR_USER_UUID'::uuid  -- Replace with actual UUID
GROUP BY au.email, p.full_name;

-- Option 6: Quick check - just the counts for current user
SELECT 
  'Total Preferences' as metric,
  COUNT(*)::text as value
FROM public.notification_preferences
WHERE user_id = auth.uid()
UNION ALL
SELECT 
  'Enabled' as metric,
  COUNT(*)::text as value
FROM public.notification_preferences
WHERE user_id = auth.uid() AND enabled = true
UNION ALL
SELECT 
  'Digest Enabled' as metric,
  COUNT(*)::text as value
FROM public.notification_preferences
WHERE user_id = auth.uid() AND email_digest_enabled = true;
