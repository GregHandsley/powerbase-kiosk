# Quick Test: Email Digest Function

## ✅ Migration Status: APPLIED

All database functions exist:

- ✅ `get_users_for_email_digest`
- ✅ `get_unread_notifications_for_digest`
- ✅ `mark_notifications_read_for_digest`

## 🧪 Test the Function

### Step 1: Test the function directly

Run this command (replace `YOUR_SERVICE_ROLE_KEY`):

```bash
./scripts/test/test-email-digest-now.sh YOUR_SERVICE_ROLE_KEY
```

**Get your service role key from:**

- Supabase Dashboard → Settings → API → `service_role` key (secret)

### Step 2: Check what the response means

**If you see:**

```json
{
  "success": true,
  "usersProcessed": 0,
  "emailsSent": 0
}
```

→ **This is normal!** It means:

- ✅ Function works
- ✅ No users have digest enabled yet
- ✅ Nothing to send

**If you see:**

```json
{
  "error": "Missing required configuration"
}
```

→ **Check environment variables:**

- Supabase Dashboard → Edge Functions → `send-email-digest` → Settings
- Required: `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**If you see:**

```json
{
  "success": true,
  "usersProcessed": 1,
  "emailsSent": 1
}
```

→ **Success!** Email was sent.

### Step 3: Check database state

Run this SQL in Supabase SQL Editor:

```sql
-- Check if any users have digest enabled
SELECT
  np.user_id,
  p.email,
  np.email_digest_enabled,
  np.email_digest_frequency
FROM public.notification_preferences np
LEFT JOIN public.profiles p ON p.id = np.user_id
WHERE np.email_digest_enabled = true;
```

**If this returns 0 rows:**

- No users have enabled digest yet
- Go to Profile → Notification Preferences → Enable "Email digest"

**If this returns rows:**

- Users have digest enabled
- Check if they have unread notifications:

```sql
SELECT COUNT(*)
FROM public.tasks
WHERE read_at IS NULL
  AND user_id IN (
    SELECT user_id
    FROM public.notification_preferences
    WHERE email_digest_enabled = true
  );
```

### Step 4: Check function logs

After running the test, check logs:

- https://app.supabase.com/project/qyzlqvfdmxvestditilq/functions/send-email-digest/logs

You should now see log entries showing:

- Function execution
- Users processed
- Emails sent (or reasons why not)

## 🎯 Expected Behavior

1. **Function is called** → Logs appear
2. **No users with digest** → Returns `usersProcessed: 0` (normal)
3. **Users with digest but no notifications** → Returns `emailsSent: 0` (normal)
4. **Users with digest + notifications** → Returns `emailsSent: 1+` (success!)

## 🔧 Troubleshooting

**Empty logs after test:**

- Function might not be deployed correctly
- Check function status in dashboard
- Try redeploying: `./scripts/deploy/deploy-send-email-digest-function.sh`

**Function returns error:**

- Check environment variables
- Check function logs for detailed error
- Verify database functions exist (you already confirmed this ✅)

**Function works but no emails:**

- Check if users have digest enabled
- Check if users have unread notifications
- Verify Resend API key is valid
- Check email from address is valid
