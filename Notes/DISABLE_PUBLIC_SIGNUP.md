# Disable Public Sign-Up

This document describes how to disable public user registration as per Layer 3: Invitations (2.2.1).

## Goal

Lock the front door - remove/block public registration. Only allow auth via invite acceptance. Keep login untouched.

## Implementation Steps

### 1. Disable Sign-Up in Supabase Dashboard (Primary Method)

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Settings** → **Auth Providers**
3. Under **Email** provider settings:
   - Find **"Enable email signup"** or **"Allow new user signups"**
   - **Disable** this setting
4. Save changes

This prevents users from signing up via the Supabase Auth API, even if someone tries to call `supabase.auth.signUp()` directly.

### 2. Database-Level Protection (Optional Safety Net)

If you want an additional safety net at the database level, you can create a trigger on `auth.users`. However, note that:

- Supabase may restrict triggers on `auth.users` table
- The dashboard setting is the primary protection method

See `migrations/disable_public_signup.sql` for a database trigger approach (may need to be adapted based on Supabase version/restrictions).

### 3. Application-Level (Already Done)

✅ **No sign-up UI exists** - The Login page only has sign-in functionality
✅ **No sign-up code in AuthContext** - Only `signIn` method exists, no `signUp`

## Verification

To verify sign-up is disabled:

1. **Test via Supabase Dashboard:**
   - Try to create a user manually in Authentication → Users
   - If sign-up is disabled, you should see a message or the option should be grayed out

2. **Test via API (if you have access):**

   ```javascript
   // This should fail if sign-up is disabled
   const { data, error } = await supabase.auth.signUp({
     email: 'test@example.com',
     password: 'testpassword123',
   });
   // Should return an error
   ```

3. **Check Supabase Settings:**
   - Go to Authentication → Settings
   - Verify "Enable email signup" is disabled

## Next Steps

After disabling public sign-up:

- ✅ Outcome: Access is now controlled
- Next: Implement invitations table (2.2.2)
- Then: Invitation acceptance flow (2.2.3) - this will allow user creation via invites

## Notes

- **Login remains untouched** - Existing users can still sign in
- **Service role can still create users** - This will be used by the invite acceptance flow
- **No UI changes needed** - There's no sign-up UI to remove
