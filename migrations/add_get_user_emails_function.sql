-- Database function to get user emails from auth.users
-- This allows the client to safely get email addresses for notification recipients
-- without exposing all user data

CREATE OR REPLACE FUNCTION public.get_user_emails(user_ids UUID[])
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    au.id::UUID as user_id,
    au.email::TEXT as email
  FROM auth.users au
  WHERE au.id = ANY(user_ids);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_emails(UUID[]) TO authenticated;

COMMENT ON FUNCTION public.get_user_emails IS 'Safely retrieves email addresses for given user IDs from auth.users';

