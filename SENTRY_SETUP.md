# Sentry Setup Guide

This project uses [Sentry](https://sentry.io) for error tracking and performance monitoring.

## Initial Setup

### 1. Sentry is Already Configured! ✅

The Sentry DSN is already configured in the code:
- **DSN**: `https://63f7268af740f7ca6747b43c2239a8df@o4510665736519680.ingest.de.sentry.io/4510668750454864`
- **Organization**: `sleeveandsend`
- **Project**: `loughboroughsportfacilityosdev`

### 2. Optional: Override DSN via Environment Variable

If you want to use a different DSN, add to your `.env` file:

```bash
# Sentry Configuration (optional - defaults to configured DSN)
VITE_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
```

**Note**: The DSN is safe to expose in client-side code. It's a public key that only allows sending events, not reading data.

### 3. Source Maps Upload (Production Only)

For readable stack traces in production, configure source map uploads:

1. Create a Sentry Auth Token:
   - Go to Sentry → Settings → Auth Tokens
   - Create a new token with `project:releases` scope

2. Set environment variables for builds:
   ```bash
   # These are already configured in vite.config.ts, but you can override:
   SENTRY_ORG=sleeveandsend
   SENTRY_PROJECT=loughboroughsportfacilityosdev
   SENTRY_AUTH_TOKEN=your-auth-token
   ```

3. Source maps will be automatically uploaded during `npm run build`

**Or use the wizard:**
```bash
npx @sentry/wizard@latest -i sourcemaps --saas --org sleeveandsend --project loughboroughsportfacilityosdev
```

## Features Enabled

### Error Tracking
- ✅ Automatic error capture from React error boundaries
- ✅ Unhandled promise rejections
- ✅ JavaScript runtime errors
- ✅ React component errors

### Performance Monitoring
- ✅ Page load performance
- ✅ React component render times
- ✅ API call performance (via React Query)
- ✅ Custom span instrumentation helpers
- ✅ 10% sample rate in production (100% in development)

### Session Replay
- ✅ Automatic replay capture on errors
- ✅ 10% sample rate for normal sessions
- ✅ Privacy-focused: all text and media masked by default

### Logging
- ✅ Structured logging enabled (`enableLogs: true`)
- ✅ Console logging integration (console.log, console.warn, console.error)
- ✅ Logger utility available via `getSentryLogger()`

### User Context
- ✅ Automatic user identification (email, role, name)
- ✅ User context attached to all errors
- ✅ PII data collection enabled (`sendDefaultPii: true`)
- ✅ Cleared on sign out

### Custom Tracking
- ✅ Supabase error tracking
- ✅ React Query error tracking
- ✅ Breadcrumb tracking for user actions
- ✅ Custom span instrumentation for button clicks and API calls

## Usage

### Manual Error Tracking

```typescript
import * as Sentry from "@sentry/react";

// Capture an exception
Sentry.captureException(new Error("Something went wrong"));
```

### Structured Logging

```typescript
import { getSentryLogger } from "./lib/sentry";

const logger = getSentryLogger();

// Use logger.fmt for template literals with variables
logger.trace("Starting database connection", { database: "users" });
logger.debug(logger.fmt`Cache miss for user: ${userId}`);
logger.info("Updated profile", { profileId: 345 });
logger.warn("Rate limit reached for endpoint", {
  endpoint: "/api/results/",
  isEnterprise: false,
});
logger.error("Failed to process payment", {
  orderId: "order_123",
  amount: 99.99,
});
logger.fatal("Database connection pool exhausted", {
  database: "users",
  activeConnections: 100,
});
```

### Custom Span Instrumentation

#### For Button Clicks / UI Actions

```typescript
import { startSentrySpan } from "./lib/sentry";

function BookingButton() {
  const handleClick = () => {
    startSentrySpan(
      {
        op: "ui.click",
        name: "Create Booking Button Click",
        attributes: {
          side: "Power",
          date: "2026-01-28",
        },
      },
      (span) => {
        // Your button click logic here
        createBooking();
      }
    );
  };

  return <button onClick={handleClick}>Create Booking</button>;
}
```

#### For API Calls

```typescript
import { startSentrySpanAsync } from "./lib/sentry";

async function fetchUserData(userId: string) {
  return startSentrySpanAsync(
    {
      op: "http.client",
      name: `GET /api/users/${userId}`,
    },
    async (span) => {
      const response = await fetch(`/api/users/${userId}`);
      const data = await response.json();
      return data;
    }
  );
}
```

### Add Breadcrumbs

```typescript
import { addSentryBreadcrumb } from "./lib/sentry";
addSentryBreadcrumb("User clicked booking button", "user-action", "info", { bookingId: 123 });
```

### Tracking Supabase Errors

```typescript
import { handleSupabaseError } from "./lib/supabaseClient";

const { data, error } = await handleSupabaseError(
  () => supabase.from("bookings").select("*"),
  { context: "fetching bookings" }
);
```

### Adding Custom Context

```typescript
import * as Sentry from "@sentry/react";

Sentry.setContext("booking", {
  bookingId: 123,
  side: "Power",
  date: "2026-01-28",
});
```

## Configuration

Configuration is in `src/lib/sentry.ts`. Key settings:

- **Environment**: Automatically set from `VITE_MODE` (development/production)
- **Release**: Uses app version from `package.json`
- **Sample Rates**: 
  - Development: 100% (capture everything)
  - Production: 10% (to manage quota)

## Privacy Considerations

- ✅ All text in session replays is masked by default
- ✅ All media in session replays is blocked by default
- ✅ User emails are tracked (can be disabled if needed)
- ✅ No sensitive data should be logged in error messages

## Testing

### Test Error Tracking

A test component is available at `src/components/SentryTestButton.tsx`. You can:

1. Import and add it to any page:
```typescript
import { SentryTestButton } from "./components/SentryTestButton";

// In your component:
<SentryTestButton />
```

2. Click the button - it will throw an error
3. Check your Sentry dashboard - the error should appear within seconds

### Verify Logging

1. Open browser console
2. Run: `console.log("Test log")`, `console.warn("Test warn")`, `console.error("Test error")`
3. Check Sentry → Logs - you should see these entries

## Disabling Sentry

If you need to disable Sentry (e.g., for local development):

1. Remove or comment out `VITE_SENTRY_DSN` from your `.env` file
2. Sentry will not initialize and won't affect your app

## Troubleshooting

### Errors not appearing in Sentry

1. Check that `VITE_SENTRY_DSN` is set correctly
2. Check browser console for Sentry initialization errors
3. Verify your Sentry project is active
4. Check network tab for requests to `sentry.io`

### Source maps not working

1. Ensure `SENTRY_AUTH_TOKEN` is set during build
2. Check that source maps are generated (`sourcemap: true` in vite.config.ts)
3. Verify upload in Sentry → Settings → Source Maps

### Too many events

- Adjust `tracesSampleRate` and `replaysSessionSampleRate` in `src/lib/sentry.ts`
- Add more filters in `beforeSend` hook

## Resources

- [Sentry React Documentation](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Sentry Session Replay](https://docs.sentry.io/product/session-replay/)

