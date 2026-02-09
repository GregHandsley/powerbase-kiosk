-- Check which users have email digest enabled
-- This will show you exactly who has it turned on

-- Option 1: Simple count and list
SELECT 
  np.user_id,
  au.email,
  p.full_name,
  np.email_digest_enabled,
  np.email_digest_frequency,
  COUNT(*) as preference_count
FROM public.notification_preferences np
LEFT JOIN auth.users au ON au.id = np.user_id
LEFT JOIN public.profiles p ON p.id = np.user_id
WHERE np.email_digest_enabled = true
GROUP BY np.user_id, au.email, p.full_name, np.email_digest_enabled, np.email_digest_frequency
ORDER BY au.email;

-- Option 2: More detailed - show all notification types per user
SELECT 
  np.user_id,
  au.email,
  p.full_name,
  np.type as notification_type,
  np.email_digest_enabled,
  np.email_digest_frequency,
  np.enabled as notification_enabled,
  np.in_app,
  np.email as email_notifications
FROM public.notification_preferences np
LEFT JOIN auth.users au ON au.id = np.user_id
LEFT JOIN public.profiles p ON p.id = np.user_id
WHERE np.email_digest_enabled = true
ORDER BY au.email, np.type;

-- Option 3: Check if they're admins
SELECT 
  np.user_id,
  au.email,
  p.full_name,
  p.is_super_admin,
  om.role as org_role,
  np.email_digest_enabled,
  np.email_digest_frequency,
  COUNT(*) as preference_count
FROM public.notification_preferences np
LEFT JOIN auth.users au ON au.id = np.user_id
LEFT JOIN public.profiles p ON p.id = np.user_id
LEFT JOIN public.organization_memberships om ON om.user_id = np.user_id
WHERE np.email_digest_enabled = true
GROUP BY np.user_id, au.email, p.full_name, p.is_super_admin, om.role, np.email_digest_enabled, np.email_digest_frequency
ORDER BY p.is_super_admin DESC, au.email;

-- Option 4: Check your current user specifically
SELECT 
  'Your current user' as label,
  auth.uid() as user_id,
  au.email,
  p.full_name,
  COUNT(*) FILTER (WHERE np.email_digest_enabled = true) as digest_enabled_count,
  COUNT(*) as total_preferences
FROM public.profiles p
LEFT JOIN auth.users au ON au.id = p.id
LEFT JOIN public.notification_preferences np ON np.user_id = p.id
WHERE p.id = auth.uid()
GROUP BY p.id, au.email, p.full_name;
