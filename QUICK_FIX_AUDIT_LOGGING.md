# Quick Fix: Add Audit Logging to Invitation Functions

## The Problem

The migration file only contains instructions - it doesn't actually modify your functions. You need to manually update them.

## Quick Steps

### 1. Get Your Function Definitions

Run this in Supabase SQL Editor:

```sql
-- Get create_invitation
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'create_invitation'
  AND pronamespace = 'public'::regnamespace;

-- Get create_invitation_with_sites
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'create_invitation_with_sites'
  AND pronamespace = 'public'::regnamespace;
```

### 2. Copy the Function Definition

Copy the entire function definition that's returned.

### 3. Find the INSERT Statement

Look for a line like:

```sql
INSERT INTO public.invitations (...)
VALUES (...)
RETURNING id INTO v_invitation_id;  -- or whatever your variable is named
```

### 4. Add Audit Logging Code

Add this code block **IMMEDIATELY AFTER** the INSERT statement (before any other logic):

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
      'invitation_id', v_invitation_id,  -- Replace v_invitation_id with YOUR variable name
      'email_hash', encode(digest(lower(p_email), 'sha256'), 'hex'),
      'role', p_role,
      'expires_in_days', p_expires_in_days
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
```

**Important:** Replace `v_invitation_id` with whatever variable name your function uses to store the invitation ID.

### 5. For create_invitation_with_sites

Use the same code, but add `site_ids` to metadata:

```sql
p_metadata := jsonb_build_object(
  'invitation_id', v_invitation_id,
  'email_hash', encode(digest(lower(p_email), 'sha256'), 'hex'),
  'role', p_role,
  'expires_in_days', p_expires_in_days,
  'site_ids', p_site_ids  -- Add this line
)
```

### 6. Run CREATE OR REPLACE FUNCTION

Paste your modified function definition and run it with `CREATE OR REPLACE FUNCTION`.

### 7. Verify

Run this to check:

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

It should now say "HAS audit logging"!

### 8. Test

Create an invitation through the UI, then check:

```sql
SELECT * FROM public.audit_log
WHERE event_type = 'invitation.created'
ORDER BY created_at DESC
LIMIT 5;
```

You should see your invitation creation event!

## Need Help?

If you share your function definition (the output from step 1), I can help you modify it correctly.
