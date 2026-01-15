-- Comprehensive Diagnostic for Invitation Function 404 Errors
-- Run this to identify the exact issue

-- 1. Check if functions exist in public schema
SELECT 
  'Function Existence Check' as check_type,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname IN ('create_invitation', 'resend_invitation', 'revoke_invitation')
ORDER BY p.proname;

-- 2. Check exact function signature for create_invitation
SELECT 
  'Function Signature Check' as check_type,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as full_signature,
  p.pronargs as parameter_count,
  (SELECT string_agg(pg_catalog.format_type(unnest(p.proargtypes), NULL), ', ' ORDER BY unnest(p.proallargtypes)) 
   FROM unnest(p.proallargtypes) WITH ORDINALITY) as parameter_types
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proname = 'create_invitation'
  AND n.nspname = 'public';

-- 3. Check permissions
SELECT 
  'Permission Check' as check_type,
  p.proname as function_name,
  r.rolname as role_name,
  has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN pg_roles r
WHERE p.proname = 'create_invitation'
  AND n.nspname = 'public'
  AND r.rolname IN ('authenticated', 'anon', 'service_role')
ORDER BY r.rolname;

-- 4. Check if pgcrypto is enabled
SELECT 
  'Extension Check' as check_type,
  extname,
  extversion
FROM pg_extension 
WHERE extname = 'pgcrypto';

-- 5. Test the function directly (replace with your actual values)
-- Uncomment and modify to test:
/*
SELECT * FROM public.create_invitation(
  'test@example.com'::TEXT,
  1::BIGINT,
  'coach'::TEXT,
  7::INTEGER,
  auth.uid()
);
*/
