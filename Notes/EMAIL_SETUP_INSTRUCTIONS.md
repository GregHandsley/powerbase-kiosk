# Email Service Setup Instructions

This guide will help you set up Resend email service with Supabase Edge Functions.

## Prerequisites

1. A Resend account (sign up at https://resend.com)
2. Supabase CLI installed (`npm install -g supabase`)
3. Your Supabase project linked

## Step 1: Get Your Resend API Key

1. Go to https://resend.com and sign up/login
2. Navigate to **API Keys** in the dashboard
3. Click **Create API Key**
4. Give it a name (e.g., "Powerbase Kiosk")
5. Copy the API key (starts with `re_`)

## Step 2: Verify Your Domain (Optional but Recommended)

For production, you should verify your domain:

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Follow the DNS setup instructions
4. Once verified, you can use emails like `noreply@yourdomain.com`

For testing, you can use Resend's test domain, but emails will be limited.

## Step 3: Configure in Admin Settings

1. Run the database migration: `migrations/add_notification_settings_tables.sql`
2. Go to `/admin?view=notification-settings` in your app
3. Enter your Resend API key in the "Email Service Configuration" section
4. Set your "From Email Address" (must be verified in Resend)
5. Set your "From Name" (e.g., "Powerbase Kiosk")
6. Click "Save API Key"

## Step 4: Deploy the Edge Function

### Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

### Login to Supabase

```bash
supabase login
```

### Link to Your Project

```bash
supabase link --project-ref your-project-ref
```

You can find your project ref in your Supabase dashboard URL:
`https://app.supabase.com/project/your-project-ref`

### Deploy the Function

```bash
supabase functions deploy send-email
```

## Step 5: Test Email Sending

1. In the admin settings, click "Send Test Email"
2. Or create a test booking after the notification window
3. Check your email inbox

## Troubleshooting

### "Email service not configured"

- Make sure you've run the migration
- Check that the `notification_settings` table has a row with `id = 1`

### "Resend API key not configured"

- Make sure you've entered and saved your API key in admin settings
- Check that the API key starts with `re_`

### "Failed to send email"

- Verify your Resend API key is correct
- Check that your "From Email Address" is verified in Resend
- Check the Supabase Edge Function logs in the dashboard

### Edge Function not found

- Make sure you've deployed the function: `supabase functions deploy send-email`
- Check that you're using the correct Supabase project

## Security Notes

- The Resend API key is stored in the database (encrypted field)
- Only admins can view/edit the API key
- The Edge Function retrieves the API key at runtime (never exposed to client)
- Always use HTTPS in production

## Next Steps

Once email is working:

1. Configure notification window settings
2. Set up recipient lists
3. Configure reminder schedules
4. Test with real bookings
