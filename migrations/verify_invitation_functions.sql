-- Verify Invitation Functions
-- Run this to check if the invitation functions are properly set up

-- 1. Check if functions exist in public schema
SELECT 
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('create_invitation', 'resend_invitation', 'revoke_invitation')
  AND n.nspname = 'public'
ORDER BY p.proname;

-- 2. Check if functions have execute permissions for authenticated role
SELECT 
  p.proname as function_name,
  r.rolname as role_name,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE p.proname IN ('create_invitation', 'resend_invitation', 'revoke_invitation')
  AND n.nspname = 'public'
  AND r.rolname = 'authenticated'
ORDER BY p.proname;

-- 3. Check if pgcrypto extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
