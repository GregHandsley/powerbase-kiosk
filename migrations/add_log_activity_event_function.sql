-- Migration: Add log_activity_event function
-- Inserts an activity log event. Best-effort (fail-open).
-- IMPORTANT: Do NOT expose EXECUTE to authenticated users.

CREATE OR REPLACE FUNCTION public.log_activity_event(
  p_organization_id bigint,
  p_event_type text,
  p_entity_type text,
  p_site_id bigint DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_actor_user_id uuid DEFAULT NULL,
  p_subject_user_id uuid DEFAULT NULL,
  p_old_value jsonb DEFAULT NULL,
  p_new_value jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activity_id uuid;
BEGIN
  -- Insert activity log event
  -- SECURITY DEFINER allows this function to bypass RLS
  -- Coalesce metadata to empty object if null
  INSERT INTO public.activity_log (
    organization_id,
    site_id,
    event_type,
    entity_type,
    entity_id,
    actor_user_id,
    subject_user_id,
    old_value,
    new_value,
    metadata,
    created_at
  )
  VALUES (
    p_organization_id,
    p_site_id,
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_actor_user_id,
    p_subject_user_id,
    p_old_value,
    p_new_value,
    COALESCE(p_metadata, '{}'::jsonb),
    now()
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
EXCEPTION
  -- Fail-open: catch all errors and return NULL
  -- App should treat this as "best effort" logging
  WHEN OTHERS THEN
    -- Log error but don't fail the calling operation
    -- In production, you might want to log to a separate error table
    RETURN NULL;
END;
$$;

-- Set search_path for security (prevent shadowing attacks)
ALTER FUNCTION public.log_activity_event(bigint, text, text, bigint, uuid, uuid, uuid, jsonb, jsonb, jsonb)
  SET search_path = public, auth;

-- Lock down execution (critical - do not allow authenticated users to call this)
-- SECURITY DEFINER functions can be abused if exposed to regular users
REVOKE EXECUTE ON FUNCTION public.log_activity_event(bigint, text, text, bigint, uuid, uuid, uuid, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_activity_event(bigint, text, text, bigint, uuid, uuid, uuid, jsonb, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_activity_event(bigint, text, text, bigint, uuid, uuid, uuid, jsonb, jsonb, jsonb) FROM authenticated;

-- If you have a backend DB role, grant to that instead:
-- GRANT EXECUTE ON FUNCTION public.log_activity_event(bigint, text, text, bigint, uuid, uuid, uuid, jsonb, jsonb, jsonb) TO <backend_role>;

-- Add comment explaining the function
COMMENT ON FUNCTION public.log_activity_event(bigint, text, text, bigint, uuid, uuid, uuid, jsonb, jsonb, jsonb) IS
  'Inserts an activity log event. SECURITY DEFINER. Returns activity id on success, NULL on failure. Execution should be server-only (do not grant to authenticated). Call via service role or backend role only. Note: p_entity_id should be NULL for bigint IDs (store in metadata instead).';
