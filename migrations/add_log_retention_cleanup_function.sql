-- Migration: Add log retention cleanup function
-- Implements retention policy for audit_log and activity_log tables
--
-- Policy:
-- - Default retention: 90 days
-- - Per-org override: organizations.settings->>'auditRetentionDays' (optional)
-- - Minimum retention: 30 days (safety limit)
-- - Maximum retention: 365 days (safety limit)

-- Function to get retention days for an organization
CREATE OR REPLACE FUNCTION public.get_audit_retention_days(
  p_organization_id bigint
)
RETURNS integer
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_retention_days integer := 90;
  v_org_settings jsonb;
  v_raw text;
BEGIN
  SELECT settings
    INTO v_org_settings
  FROM public.organizations
  WHERE id = p_organization_id;

  IF v_org_settings IS NOT NULL AND v_org_settings ? 'auditRetentionDays' THEN
    v_raw := v_org_settings->>'auditRetentionDays';

    -- Only accept plain integers; otherwise keep default.
    IF v_raw ~ '^\s*\d+\s*$' THEN
      v_retention_days := v_raw::integer;
    END IF;
  END IF;

  IF v_retention_days < 30 THEN
    v_retention_days := 30;
  ELSIF v_retention_days > 365 THEN
    v_retention_days := 365;
  END IF;

  RETURN v_retention_days;
END;
$$;

COMMENT ON FUNCTION public.get_audit_retention_days(bigint) IS
  'Returns the retention period in days for an organization. Defaults to 90 days, can be overridden in organizations.settings.auditRetentionDays. Enforces min 30 days, max 365 days.';

-- Function to clean up old audit_log entries for a specific organization
CREATE OR REPLACE FUNCTION public.cleanup_audit_logs_for_org(
  p_organization_id bigint
)
RETURNS TABLE(deleted_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_retention_days integer;
  v_cutoff_date timestamptz;
  v_deleted_count bigint;
BEGIN
  v_retention_days := public.get_audit_retention_days(p_organization_id);
  v_cutoff_date := now() - make_interval(days => v_retention_days);

  DELETE FROM public.audit_log
  WHERE organization_id = p_organization_id
    AND created_at < v_cutoff_date;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN QUERY SELECT v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_audit_logs_for_org(bigint) IS
  'Deletes audit_log entries older than the retention period for a specific organization. SECURITY DEFINER. Returns count of deleted rows.';

-- Function to clean up old activity_log entries for a specific organization
CREATE OR REPLACE FUNCTION public.cleanup_activity_logs_for_org(
  p_organization_id bigint
)
RETURNS TABLE(deleted_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_retention_days integer;
  v_cutoff_date timestamptz;
  v_deleted_count bigint;
BEGIN
  v_retention_days := public.get_audit_retention_days(p_organization_id);
  v_cutoff_date := now() - make_interval(days => v_retention_days);

  DELETE FROM public.activity_log
  WHERE organization_id = p_organization_id
    AND created_at < v_cutoff_date;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN QUERY SELECT v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_activity_logs_for_org(bigint) IS
  'Deletes activity_log entries older than the retention period for a specific organization. SECURITY DEFINER. Returns count of deleted rows.';

-- Function to clean up logs for all organizations
-- This is the main function that should be called by the scheduled job
CREATE OR REPLACE FUNCTION public.cleanup_all_logs()
RETURNS TABLE(
  organization_id bigint,
  audit_logs_deleted bigint,
  activity_logs_deleted bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_org RECORD;
  v_audit_deleted bigint;
  v_activity_deleted bigint;
BEGIN
  FOR v_org IN SELECT id FROM public.organizations
  LOOP
    SELECT deleted_count INTO v_audit_deleted
    FROM public.cleanup_audit_logs_for_org(v_org.id);

    SELECT deleted_count INTO v_activity_deleted
    FROM public.cleanup_activity_logs_for_org(v_org.id);

    RETURN QUERY SELECT
      v_org.id,
      COALESCE(v_audit_deleted, 0),
      COALESCE(v_activity_deleted, 0);
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.cleanup_all_logs() IS
  'Cleans up old audit_log and activity_log entries for all organizations based on their retention policies. SECURITY DEFINER. Should be called by a scheduled job (daily recommended). Returns per-organization deletion counts.';

-- Revoke public access (only service role should call these)
REVOKE EXECUTE ON FUNCTION public.get_audit_retention_days(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_audit_retention_days(bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_audit_retention_days(bigint) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_audit_logs_for_org(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_audit_logs_for_org(bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_audit_logs_for_org(bigint) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_activity_logs_for_org(bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_activity_logs_for_org(bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_activity_logs_for_org(bigint) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_all_logs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_all_logs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_all_logs() FROM authenticated;

-- Strongly recommended indexes if they don't exist:
-- These indexes are critical for performance when deleting old logs
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_log_org_created_at_idx
--   ON public.audit_log (organization_id, created_at);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS activity_log_org_created_at_idx
--   ON public.activity_log (organization_id, created_at);
