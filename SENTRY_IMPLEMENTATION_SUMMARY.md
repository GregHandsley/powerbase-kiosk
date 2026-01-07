# Sentry Implementation Summary

Sentry.io has been successfully integrated into the Powerbase Kiosk project. Here's what was implemented:

## ✅ What's Been Done

### 1. **Package Installation**
- ✅ `@sentry/react` - Core Sentry SDK for React
- ✅ `@sentry/vite-plugin` - Source maps upload plugin

### 2. **Core Configuration** (`src/lib/sentry.ts`)
- ✅ Sentry initialization with environment detection
- ✅ Performance monitoring (10% sample rate in prod, 100% in dev)
- ✅ Session replay (privacy-focused, masks all text/media)
- ✅ Error filtering for known non-critical errors
- ✅ User context management
- ✅ Breadcrumb tracking utilities
- ✅ Supabase error tracking helper
- ✅ React Query error tracking helper

### 3. **Integration Points**

#### Main App (`src/main.tsx`)
- ✅ Sentry initialized before React renders
- ✅ Sentry ErrorBoundary wraps the entire app
- ✅ Existing error boundaries enhanced with Sentry tracking
- ✅ React Query errors automatically tracked

#### Authentication (`src/context/AuthContext.tsx`)
- ✅ User context automatically set on login
- ✅ User context updated with profile info (role, name)
- ✅ User context cleared on sign out

#### Error Boundaries
- ✅ `KioskErrorScreen` sends errors to Sentry
- ✅ `ErrorFallback` in main.tsx sends errors to Sentry

#### Supabase Client (`src/lib/supabaseClient.ts`)
- ✅ Helper function for tracking Supabase errors
- ✅ Can be used optionally for enhanced error tracking

### 4. **Build Configuration** (`vite.config.ts`)
- ✅ Source maps enabled for production
- ✅ Sentry plugin configured for automatic source map uploads
- ✅ Conditional plugin loading (only when auth token provided)

### 5. **Environment Configuration** (`src/config/env.ts`)
- ✅ `VITE_SENTRY_DSN` added to environment variables

## 📋 Next Steps

### Required: Set Up Sentry Account

1. **Create Sentry Account**
   - Go to [sentry.io](https://sentry.io) and sign up
   - Create a new React project
   - Copy your DSN

2. **Add Environment Variable**
   ```bash
   # Add to .env or .env.local
   VITE_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
   ```

3. **Optional: Source Maps Upload** (for production)
   ```bash
   # Add to your CI/CD or build environment
   SENTRY_ORG=your-org-slug
   SENTRY_PROJECT=your-project-slug
   SENTRY_AUTH_TOKEN=your-auth-token
   ```

### Testing

1. **Test Error Tracking**
   - Add a test button that throws an error
   - Check Sentry dashboard - error should appear within seconds

2. **Verify User Context**
   - Log in as admin/coach
   - Check Sentry → Issues → User context shows email/role

3. **Check Performance**
   - Navigate through the app
   - Check Sentry → Performance for transaction data

## 🎯 Features Enabled

### Automatic Tracking
- ✅ All unhandled JavaScript errors
- ✅ React component errors
- ✅ Unhandled promise rejections
- ✅ React Query query/mutation errors
- ✅ Error boundary catches

### User Context
- ✅ User ID, email, role, name automatically attached
- ✅ Updates when user logs in/out
- ✅ Cleared on sign out

### Performance Monitoring
- ✅ Page load times
- ✅ React component render performance
- ✅ API call performance
- ✅ Sample rate: 10% production, 100% development

### Session Replay
- ✅ Automatic replay on errors
- ✅ 10% normal session sampling
- ✅ Privacy: all text/media masked

## 📚 Documentation

See `SENTRY_SETUP.md` for:
- Detailed setup instructions
- Usage examples
- Troubleshooting guide
- Privacy considerations

## 🔒 Privacy & Security

- ✅ Session replays mask all text by default
- ✅ Session replays block all media by default
- ✅ DSN is safe to expose (public key, write-only)
- ✅ No sensitive data should be in error messages

## 🚀 Usage Examples

### Manual Error Tracking
```typescript
import * as Sentry from "@sentry/react";
Sentry.captureException(new Error("Custom error"));
```

### Add Breadcrumbs
```typescript
import { addSentryBreadcrumb } from "./lib/sentry";
addSentryBreadcrumb("User created booking", "user-action", "info", { bookingId: 123 });
```

### Track Supabase Errors
```typescript
import { handleSupabaseError } from "./lib/supabaseClient";
const { data, error } = await handleSupabaseError(
  () => supabase.from("bookings").select("*"),
  { context: "fetching bookings" }
);
```

## 📊 What You'll See in Sentry

1. **Issues Dashboard**: All errors grouped by type
2. **Performance**: Slow transactions and API calls
3. **Releases**: Errors by app version
4. **User Impact**: Which users are affected
5. **Session Replay**: Video replay of user sessions before errors

## ⚠️ Important Notes

- Sentry will **not** initialize if `VITE_SENTRY_DSN` is not set
- This is safe for development - app works normally without DSN
- Source maps upload is optional (only needed for readable production stack traces)
- Sample rates can be adjusted in `src/lib/sentry.ts` to manage quota

---

**Implementation Date**: January 2026  
**Status**: ✅ Complete - Ready for configuration

