# Supabase Edge Functions

This directory contains Supabase Edge Functions for serverless operations.

## Setup

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link to Your Project

```bash
supabase link --project-ref your-project-ref
```

You can find your project ref in your Supabase dashboard URL: `https://app.supabase.com/project/your-project-ref`

### 4. Deploy Functions

Deploy all functions:

```bash
supabase functions deploy
```

Or deploy a specific function:

```bash
supabase functions deploy send-email
```

### 5. Set Environment Variables (if needed)

Edge Functions can access Supabase environment variables automatically. The function uses:

- `SUPABASE_URL` (automatically available)
- `SUPABASE_ANON_KEY` (automatically available)

The Resend API key is stored in the `notification_settings` table and retrieved at runtime.

## Functions

### `send-email`

Sends emails via Resend API. Called from the client-side `emailService.ts`.

**Usage:**

```typescript
import { sendEmail } from '../services/email/emailService';

await sendEmail({
  to: 'user@example.com',
  subject: 'Test Email',
  html: '<h1>Hello</h1>',
});
```

## Testing Locally

You can test Edge Functions locally using the Supabase CLI:

```bash
supabase functions serve send-email
```

Then call it from your app or use curl:

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/send-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"to":"test@example.com","subject":"Test","html":"<h1>Test</h1>"}'
```

## Production Deployment

1. Make sure you're linked to your production project
2. Deploy: `supabase functions deploy send-email`
3. The function will be available at: `https://your-project-ref.supabase.co/functions/v1/send-email`
