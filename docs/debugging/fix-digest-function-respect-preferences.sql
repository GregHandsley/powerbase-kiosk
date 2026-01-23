-- Fix: Update get_unread_notifications_for_digest to respect individual notification preferences
-- This makes the digest only include notifications for types that are enabled
-- Run this in Supabase SQL Editor

-- Drop the old function first (required when changing return type)
DROP FUNCTION IF EXISTS public.get_unread_notifications_for_digest(uuid, timestamptz);

-- Recreate with updated logic that respects individual notification type toggles
CREATE FUNCTION public.get_unread_notifications_for_digest(
  p_user_id uuid,
  p_since timestamptz DEFAULT (now() - interval '7 days')
)
RETURNS TABLE (
  id bigint,
  type text,
  title text,
  message text,
  link text,
  created_at timestamptz,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.type,
    n.title,
    n.message,
    n.link,
    n.created_at,
    n.metadata
  FROM public.tasks n
  INNER JOIN public.notification_preferences np 
    ON np.user_id = n.user_id 
    AND np.type = n.type
  WHERE n.user_id = p_user_id
    AND n.read_at IS NULL
    AND n.created_at >= p_since
    AND np.enabled = true  -- Only include notifications for enabled types
    AND np.email_digest_enabled = true  -- Only if digest is enabled for this type
  ORDER BY n.created_at DESC;
END;
$$;

-- Also update mark_notifications_read_for_digest to use bigint[] instead of integer[]
-- and fix the table name from notifications to tasks
DROP FUNCTION IF EXISTS public.mark_notifications_read_for_digest(uuid, integer[]);
DROP FUNCTION IF EXISTS public.mark_notifications_read_for_digest(uuid, bigint[]);

CREATE FUNCTION public.mark_notifications_read_for_digest(
  p_user_id uuid,
  p_notification_ids bigint[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.tasks
  SET read_at = now()
  WHERE user_id = p_user_id
    AND id = ANY(p_notification_ids)
    AND read_at IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Verify both functions were created
SELECT 
  proname,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc
WHERE proname IN ('get_unread_notifications_for_digest', 'mark_notifications_read_for_digest')
  AND pronamespace = 'public'::regnamespace
ORDER BY proname;
