# Sentry Source Maps Setup Guide

## Why Set Up Source Maps?

Without source maps, production errors in Sentry will show minified code like:
```
Error at t.functionName (main.js:1:2345)
```

With source maps, you'll see:
```
Error at handleBookingClick (Schedule.tsx:207:15)
```

**Much easier to debug!** 🎯

## Step 1: Create a Sentry Auth Token

1. Go to [Sentry.io](https://sentry.io) and log in
2. Navigate to **Settings** → **Auth Tokens**
3. Click **Create New Token**
4. Give it a name like "Powerbase Kiosk Source Maps"
5. Select the scope: **`project:releases`** (this is the minimum required)
6. Click **Create Token**
7. **Copy the token immediately** - you won't be able to see it again!

## Step 2: Set the Token

### Option A: For Local Development / Testing

Create or update `.env.local` (this file should be in `.gitignore`):

```bash
# Sentry Source Maps Upload
SENTRY_AUTH_TOKEN=your-auth-token-here
SENTRY_ORG=sleeveandsend
SENTRY_PROJECT=loughboroughsportfacilityosdev
```

**Note**: The org and project are already set as defaults in `vite.config.ts`, but you can override them here if needed.

### Option B: For CI/CD (Recommended for Production)

Add these as **secret environment variables** in your CI/CD platform:

#### GitHub Actions Example:
```yaml
env:
  SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
  SENTRY_ORG: sleeveandsend
  SENTRY_PROJECT: loughboroughsportfacilityosdev
```

#### Vercel Example:
1. Go to Project Settings → Environment Variables
2. Add:
   - `SENTRY_AUTH_TOKEN` (as Secret)
   - `SENTRY_ORG` = `sleeveandsend`
   - `SENTRY_PROJECT` = `loughboroughsportfacilityosdev`

#### Netlify Example:
1. Go to Site Settings → Build & Deploy → Environment
2. Add the same variables

## Step 3: Test It

1. Build your project:
   ```bash
   npm run build
   ```

2. You should see Sentry uploading source maps in the build output:
   ```
   > Uploading source maps to Sentry...
   > Source maps uploaded successfully
   ```

3. Check Sentry Dashboard:
   - Go to **Settings** → **Source Maps**
   - You should see your release with uploaded source maps

## Alternative: Use Sentry Wizard (Easier)

You can also use the Sentry wizard which will set everything up automatically:

```bash
npx @sentry/wizard@latest -i sourcemaps --saas --org sleeveandsend --project loughboroughsportfacilityosdev
```

This will:
- Create the auth token for you
- Set up the configuration
- Update your build scripts if needed

## Security Notes

⚠️ **Important**:
- **Never commit** `SENTRY_AUTH_TOKEN` to git
- Add `.env.local` to `.gitignore` if not already there
- The token only needs `project:releases` scope (minimum required)
- If the token is compromised, you can revoke it in Sentry settings

## Verification

After setting up, when you deploy to production:

1. Trigger an error (or wait for a real one)
2. Go to Sentry → Issues
3. Click on an error
4. You should see **readable stack traces** with file names and line numbers from your source code

## Troubleshooting

### Source maps not uploading?

1. Check that `SENTRY_AUTH_TOKEN` is set during build:
   ```bash
   echo $SENTRY_AUTH_TOKEN  # Should show your token
   ```

2. Check build output for Sentry plugin messages

3. Verify token has correct scope (`project:releases`)

4. Check Sentry dashboard → Settings → Source Maps for any errors

### Source maps uploading but not working?

1. Ensure `sourcemap: true` is in `vite.config.ts` (✅ already set)
2. Check that the release version matches between build and Sentry
3. Wait a few minutes - source maps can take time to process

---

**That's it!** Once set up, source maps will automatically upload on every production build, making debugging much easier. 🚀

