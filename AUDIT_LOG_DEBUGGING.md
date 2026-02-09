# Audit Log Debugging Guide

## Quick Checklist

1. ✅ **Audit log table exists?** - Run migrations: `add_audit_log_table.sql`
2. ✅ **log_audit_event function exists?** - Run migration: `add_log_audit_event_function.sql`
3. ✅ **RLS policies enabled?** - Run migration: `add_audit_log_rls_policies.sql`
4. ✅ **can_read_audit function exists?** - Run migration: `add_audit_permission_and_update_is_org_admin.sql`
5. ❌ **DB functions have audit logging?** - **THIS IS LIKELY THE ISSUE**
6. ✅ **Edge Function deployed?** - Deploy `get-audit-logs`
7. ✅ **Edge Function has audit logging?** - `accept-invitation` has it

## Step 1: Verify Setup

Run these queries in Supabase SQL Editor:

```sql
-- Check if audit_log table has any data
SELECT COUNT(*) FROM public.audit_log;

-- Check if log_audit_event function exists
SELECT proname FROM pg_proc
WHERE proname = 'log_audit_event'
  AND pronamespace = 'public'::regnamespace;

-- Test creating an audit log manually
SELECT public.log_audit_event(
  p_organization_id := 1,  -- Your org ID
  p_event_type := 'test.manual',
  p_entity_type := 'test',
  p_metadata := jsonb_build_object('test', true)
);
```

If the test query works, you should see a UUID returned and a row in `audit_log`.

## Step 2: Check if DB Functions Have Audit Logging

```sql
-- Check if create_invitation has audit logging
SELECT
  proname,
  CASE
    WHEN prosrc LIKE '%log_audit_event%' THEN '✅ HAS audit logging'
    ELSE '❌ MISSING audit logging'
  END as audit_status
FROM pg_proc
WHERE proname IN ('create_invitation', 'create_invitation_with_sites')
  AND pronamespace = 'public'::regnamespace;
```

If it says "MISSING", that's your problem!

## Step 3: Add Audit Logging to DB Functions

### For create_invitation:

1. Get your current function definition:

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'create_invitation'
  AND pronamespace = 'public'::regnamespace;
```

2. Copy the function definition and add this code block **AFTER** the INSERT succeeds:

```sql
BEGIN
  PERFORM public.log_audit_event(
    p_organization_id := p_organization_id,
    p_site_id := NULL,
    p_event_type := 'invitation.created',
    p_entity_type := 'invitation',
    p_entity_id := NULL,
    p_actor_user_id := COALESCE(p_invited_by, auth.uid()),
    p_subject_user_id := NULL,
    p_old_value := NULL,
    p_new_value := NULL,
    p_metadata := jsonb_build_object(
      'invitation_id', invitation_id,  -- Use your variable name
      'email_hash', encode(digest(lower(p_email), 'sha256'), 'hex'),
      'role', p_role,
      'expires_in_days', p_expires_in_days
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    NULL;  -- Fail-open
END;
```

3. Run `CREATE OR REPLACE FUNCTION` with the updated body.

### For create_invitation_with_sites:

Same process, but also include `site_ids` in metadata:

```sql
p_metadata := jsonb_build_object(
  'invitation_id', invitation_id,
  'email_hash', encode(digest(lower(p_email), 'sha256'), 'hex'),
  'role', p_role,
  'expires_in_days', p_expires_in_days,
  'site_ids', p_site_ids
)
```

## Step 4: Test

1. Create a new invitation through the UI
2. Check if audit log was created:

```sql
SELECT * FROM public.audit_log
WHERE event_type = 'invitation.created'
ORDER BY created_at DESC
LIMIT 5;
```

3. Check the audit log UI - it should appear now!

## Step 5: Verify Edge Function is Deployed

```bash
supabase functions list
```

Make sure `get-audit-logs` is in the list. If not:

```bash
supabase functions deploy get-audit-logs
```

## Common Issues

1. **No logs appearing**: DB functions don't have audit logging code yet
2. **Permission denied**: Check `can_read_audit` function and RLS policies
3. **Function errors**: Check Supabase logs for errors in `log_audit_event` calls
4. **Edge Function 404**: Function not deployed

## Quick Test Query

After adding audit logging, test by creating an invitation, then run:

```sql
SELECT
  id,
  created_at,
  event_type,
  entity_type,
  organization_id,
  metadata->>'invitation_id' as invitation_id
FROM public.audit_log
WHERE event_type LIKE 'invitation.%'
ORDER BY created_at DESC
LIMIT 10;
```

You should see your invitation creation events!
