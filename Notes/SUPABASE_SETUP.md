# Supabase Database Connection Setup

## Quick Setup

### 1. Get Your Supabase Credentials

1. Go to your Supabase project dashboard: https://app.supabase.com
2. Navigate to **Settings** → **API**
3. Copy the following:
   - **Project URL** (this is your `VITE_SUPABASE_URL`)
   - **anon/public key** (this is your `VITE_SUPABASE_ANON_KEY`)

### 2. Create Environment File

Create a `.env.local` file in the project root:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# Sentry (if you set it up)
VITE_SENTRY_DSN=your-sentry-dsn
```

**Important:** `.env.local` is already in `.gitignore`, so it won't be committed.

### 3. Verify Connection

Start your dev server:
```bash
npm run dev
```

The app should now connect to your Supabase database. You can test by:
- Trying to log in (if you have users)
- Viewing the schedule (if you have bookings)
- Checking the admin panel

---

## Database Schema Setup

### Option A: Using Supabase Dashboard (Recommended for Production)

1. Go to Supabase Dashboard → **SQL Editor**
2. Copy the contents of `supabase-schema-prod.sql`
3. Paste and run it in the SQL Editor
4. This will create all tables, RLS policies, and seed data

### Option B: Using Supabase CLI (For Development)

If you have Supabase CLI installed:

```bash
# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

---

## Running Migrations

You have migration files in the `migrations/` folder. To apply them:

1. Go to Supabase Dashboard → **SQL Editor**
2. Run each migration file in order:
   - `add_capacity_to_booking_instances.sql`
   - `add_platforms_to_capacity_schedules.sql`
   - `add_platforms_to_period_type_defaults.sql`

Or copy-paste the contents into the SQL Editor and run.

---

## Verifying Your Setup

### Check Connection
Open browser console and check for any Supabase connection errors.

### Test Queries
You can test in the Supabase Dashboard → **Table Editor**:
- Check if `sides` table exists and has data
- Check if `profiles` table exists
- Check if `bookings` table exists

---

## Troubleshooting

### "Invalid API key" error
- Double-check your `VITE_SUPABASE_ANON_KEY` in `.env.local`
- Make sure you're using the **anon** key, not the **service_role** key

### "Failed to fetch" error
- Check your `VITE_SUPABASE_URL` is correct
- Make sure your Supabase project is active
- Check browser console for CORS errors

### Tables not found
- Run the schema SQL file in Supabase Dashboard
- Check that migrations have been applied
- Verify table names match what the code expects

---

## Next Steps

Once connected:
1. ✅ Verify you can see data in the app
2. ✅ Test creating a booking
3. ✅ Test admin features
4. ✅ Check that real-time updates work

---

## Security Notes

- **Never commit** `.env.local` to git (it's already in `.gitignore`)
- The **anon key** is safe to use in frontend code (it's public)
- Use **service_role key** only in backend/server code (never in frontend)
- RLS (Row Level Security) policies protect your data

---

## Optional: Supabase CLI Setup

If you want to use Supabase CLI for local development:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Pull schema (syncs remote schema to local)
supabase db pull
```

This allows you to:
- Run migrations locally
- Generate TypeScript types from your schema
- Test migrations before applying to production

