-- Get the current function definition to see what's actually in the database
SELECT pg_get_functiondef(oid) as current_function
FROM pg_proc
WHERE proname = 'create_invitation_with_sites'
  AND pronamespace = 'public'::regnamespace;

-- After you get the output above, we'll create a corrected version
-- The issue is that the audit logging code needs to be BEFORE the final RETURN statement
