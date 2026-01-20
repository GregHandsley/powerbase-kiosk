-- Run this to get the create_invitation function definition
-- We need this to add audit logging to it

SELECT pg_get_functiondef(oid) as function_definition
FROM pg_proc
WHERE proname = 'create_invitation'
  AND pronamespace = 'public'::regnamespace;
