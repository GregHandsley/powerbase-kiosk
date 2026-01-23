# Debugging: Audit Logs Are Empty

## Step-by-Step Debugging

### Step 1: Verify Function Was Updated

Run this query:

```sql
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

**Expected:** Both should say "HAS audit logging"
**If not:** The migration didn't run or didn't work. Re-run the migration.

### Step 2: Test log_audit_event Directly

Run this (replace `1` with your organization ID):

```sql
SELECT public.log_audit_event(
  p_organization_id := 1,
  p_event_type := 'test.direct_call',
  p_entity_type := 'test',
  p_metadata := jsonb_build_object('test', true)
);
```

**Expected:** Returns a UUID
**Then check:**

```sql
SELECT * FROM public.audit_log
WHERE event_type = 'test.direct_call'
ORDER BY created_at DESC;
```

**If this works:** The function is working, the issue is in the invitation functions.
**If this fails:** There's a problem with `log_audit_event` itself.

### Step 3: Check Function Body

Get the full function to verify audit logging code is in the right place:

```sql
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'create_invitation_with_sites'
  AND pronamespace = 'public'::regnamespace;
```

Look for:

- `PERFORM public.log_audit_event(` should appear AFTER the invitation is created
- It should be inside a `BEGIN...EXCEPTION...END` block
- The variable names should match (e.g., `v_invitation_id`)

### Step 4: Test Creating an Invitation

1. Create an invitation through the UI
2. Immediately run:

```sql
SELECT * FROM public.audit_log
WHERE event_type = 'invitation.created'
ORDER BY created_at DESC
LIMIT 5;
```

**If no logs appear:**

- The audit logging code might be in the wrong place
- There might be an error being silently caught
- The function might be returning early before reaching the audit code

### Step 5: Check for Silent Errors

The audit logging is wrapped in `EXCEPTION WHEN OTHERS THEN NULL`, which means errors are silently ignored. To debug, temporarily remove the exception handler or add logging.

### Step 6: Verify Migration Was Applied

Check if the migration actually modified the function:

```sql
-- Get the function body and search for audit logging
SELECT
  proname,
  CASE
    WHEN prosrc LIKE '%PERFORM public.log_audit_event%' THEN 'Has PERFORM call'
    WHEN prosrc LIKE '%log_audit_event%' THEN 'Has log_audit_event reference'
    ELSE 'No audit logging found'
  END as status,
  length(prosrc) as function_length
FROM pg_proc
WHERE proname = 'create_invitation_with_sites'
  AND pronamespace = 'public'::regnamespace;
```

## Common Issues

1. **Migration not run:** The SQL file was created but not executed in Supabase
2. **Wrong variable name:** The audit code uses `v_invitation_id` but your function uses a different name
3. **Code in wrong place:** Audit logging is before the invitation is created, or after an early return
4. **Exception being caught:** An error in `log_audit_event` is being silently caught
5. **RLS blocking:** Though unlikely since `log_audit_event` uses SECURITY DEFINER

## Quick Fix: Add Temporary Error Logging

If you want to see if errors are being caught, temporarily modify the exception handler:

```sql
EXCEPTION
  WHEN OTHERS THEN
    -- Temporarily log the error (remove after debugging)
    RAISE WARNING 'Audit logging failed: %', SQLERRM;
    NULL;
END;
```

This will show warnings in the Supabase logs if there are errors.
