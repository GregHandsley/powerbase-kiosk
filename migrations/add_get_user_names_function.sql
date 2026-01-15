-- Database function to get user full names from profiles table
-- This allows the client to safely get full names for display
-- without being blocked by RLS policies

CREATE OR REPLACE FUNCTION public.get_user_names(user_ids UUID[])
RETURNS TABLE(user_id UUID, full_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id::UUID as user_id,
    p.full_name::TEXT as full_name
  FROM public.profiles p
  WHERE p.id = ANY(user_ids);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_names(UUID[]) TO authenticated;

COMMENT ON FUNCTION public.get_user_names IS 'Safely retrieves full names for given user IDs from profiles table, bypassing RLS';
