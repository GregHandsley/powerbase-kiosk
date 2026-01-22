# Log Retention Policy

This document describes the log retention policy implementation for `audit_log` and `activity_log` tables.

## Overview

The retention policy automatically deletes old log entries to manage database size and comply with data retention requirements.

## Policy Details

### Default Retention

- **Default**: 90 days
- **Minimum**: 30 days (safety limit)
- **Maximum**: 365 days (safety limit)

### Per-Organization Override

Organizations can override the default retention period by setting `auditRetentionDays` in their `organizations.settings` JSONB field:

```sql
-- Example: Set retention to 60 days for an organization
UPDATE organizations
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{auditRetentionDays}',
  '60'
)
WHERE id = 1;
```

The system will enforce the minimum (30 days) and maximum (365 days) limits even if a custom value is set.

## Implementation

### Database Functions

Three PostgreSQL functions handle the cleanup:

1. **`get_audit_retention_days(organization_id)`**
   - Returns the retention period in days for an organization
   - Checks `organizations.settings->>'auditRetentionDays'`
   - Enforces min/max limits

2. **`cleanup_audit_logs_for_org(organization_id)`**
   - Deletes old `audit_log` entries for a specific organization
   - Returns count of deleted rows

3. **`cleanup_activity_logs_for_org(organization_id)`**
   - Deletes old `activity_log` entries for a specific organization
   - Returns count of deleted rows

4. **`cleanup_all_logs()`**
   - Main function that processes all organizations
   - Returns per-organization deletion counts
   - Should be called by the scheduled job

### Edge Function

The `cleanup-log-retention` Edge Function provides an HTTP endpoint to trigger the cleanup:

- **Endpoint**: `/functions/v1/cleanup-log-retention`
- **Method**: POST
- **Authentication**: Requires service role key
- **Response**: JSON with deletion summary and per-org details

## Scheduling

### Option A: Supabase Cron (Recommended)

Set up a scheduled cron job in Supabase to call the Edge Function daily:

1. Go to Supabase Dashboard → Database → Cron Jobs
2. Create a new cron job:
   - **Name**: `cleanup-log-retention`
   - **Schedule**: `0 2 * * *` (runs daily at 2 AM UTC)
   - **Command**:
     ```sql
     SELECT net.http_post(
       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-log-retention',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
       ),
       body := '{}'::jsonb
     );
     ```

### Option B: External Cron Service

Use an external service (e.g., GitHub Actions, cron job on a server) to call the Edge Function:

```bash
curl -X POST \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-log-retention \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Option C: Manual Execution

You can also call the database function directly:

```sql
-- Clean up logs for all organizations
SELECT * FROM public.cleanup_all_logs();

-- Clean up logs for a specific organization
SELECT * FROM public.cleanup_audit_logs_for_org(1);
SELECT * FROM public.cleanup_activity_logs_for_org(1);
```

## Monitoring

The Edge Function returns detailed results:

```json
{
  "success": true,
  "summary": {
    "organizations_processed": 3,
    "audit_logs_deleted": 1250,
    "activity_logs_deleted": 3420
  },
  "details": [
    {
      "organization_id": 1,
      "audit_logs_deleted": 500,
      "activity_logs_deleted": 1200
    },
    {
      "organization_id": 2,
      "audit_logs_deleted": 750,
      "activity_logs_deleted": 2220
    }
  ]
}
```

## Safety Features

1. **Minimum Retention**: Enforced 30-day minimum prevents accidental data loss
2. **Maximum Retention**: Enforced 365-day maximum prevents excessive storage
3. **Per-Org Processing**: Each organization is processed independently
4. **Error Handling**: Failures for one organization don't affect others
5. **SECURITY DEFINER**: Functions run with elevated privileges to bypass RLS

## Migration

Run the migration to create the functions:

```bash
# Apply the migration
psql -d your_database -f migrations/add_log_retention_cleanup_function.sql
```

## Testing

Test the cleanup function manually:

```sql
-- Check current retention for an org
SELECT public.get_audit_retention_days(1);

-- Test cleanup for a specific org (use a test org!)
SELECT * FROM public.cleanup_audit_logs_for_org(1);
SELECT * FROM public.cleanup_activity_logs_for_org(1);

-- Test full cleanup (be careful in production!)
SELECT * FROM public.cleanup_all_logs();
```

## Future Enhancements

- [ ] Add logging/audit trail of cleanup operations
- [ ] Add metrics/dashboard for retention statistics
- [ ] Support different retention periods for audit_log vs activity_log
- [ ] Add dry-run mode to preview what would be deleted
