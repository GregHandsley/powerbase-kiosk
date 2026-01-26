// src/lib/sentry.ts
import * as Sentry from '@sentry/react';
import { APP_ENV, APP_VERSION } from '../config/env';

// Get DSN from environment variable, with fallback to the provided DSN
const SENTRY_DSN =
  (import.meta.env.VITE_SENTRY_DSN as string | undefined) ||
  'https://63f7268af740f7ca6747b43c2239a8df@o4510665736519680.ingest.de.sentry.io/4510668750454864';

/**
 * Initialize Sentry for error tracking and performance monitoring
 * Should be called as early as possible in the application lifecycle
 */
export function initSentry() {
  // Suppress Sentry 429 rate limit errors in console (development only)
  if (APP_ENV === 'development') {
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      const message = args.join(' ');
      // Filter out Sentry 429 errors
      if (
        typeof message === 'string' &&
        (message.includes('sentry.io') || message.includes('Sentry')) &&
        (message.includes('429') || message.includes('Too Many Requests'))
      ) {
        return; // Silently ignore
      }
      originalError.apply(console, args);
    };
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: APP_ENV,
    release: APP_VERSION,

    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,

    // Enable logging
    enableLogs: true,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Session replay configuration
        maskAllText: true, // Privacy: mask all text by default
        blockAllMedia: true, // Privacy: block all media
      }),
      // Send console.log, console.warn, and console.error calls as logs to Sentry
      // Only in production to reduce dev noise
      ...(APP_ENV === 'production'
        ? [
            Sentry.consoleLoggingIntegration({
              levels: ['log', 'warn', 'error'],
            }),
          ]
        : []),
    ],

    // Performance Monitoring
    tracesSampleRate: APP_ENV === 'production' ? 0.1 : 0.0, // 10% in prod, 0% in dev (reduce noise)

    // Session Replay
    replaysSessionSampleRate: APP_ENV === 'production' ? 0.1 : 0.0, // 10% in prod, 0% in dev (reduce noise)
    replaysOnErrorSampleRate: APP_ENV === 'production' ? 1.0 : 0.0, // Only in prod

    // Error filtering - don't send certain errors
    beforeSend(event, hint) {
      // Filter out known non-critical errors
      const error = hint.originalException;

      // Ignore Sentry rate limiting errors (429)
      if (
        event.request?.url?.includes('sentry.io') &&
        (event.tags?.status === 429 || event.extra?.status === 429)
      ) {
        return null; // Silently ignore Sentry rate limit errors
      }

      // Ignore network errors that are expected (e.g., offline)
      if (error instanceof Error) {
        if (
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('Load failed') ||
          error.message.includes('429') ||
          error.message.includes('Too Many Requests')
        ) {
          // Only ignore in development, track in production
          if (APP_ENV === 'development') {
            return null;
          }
        }
      }

      return event;
    },

    // Ignore specific URLs (e.g., browser extensions)
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      'atomicFindClose',
      'fb_xd_fragment',
      'bmi_SafeAddOnload',
      'EBCallBackMessageReceived',
      // Network errors that might be transient
      'Network request failed',
      'NetworkError',
      // Supabase specific (we'll handle these separately)
      'JWTExpired',
    ],
  });
}

/**
 * Set user context for Sentry
 * Call this when user logs in or user info changes
 */
export function setSentryUser(
  user: {
    id: string;
    email?: string;
    role?: string;
    name?: string;
  } | null
) {
  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.email, // Fallback for username
      role: user.role,
      name: user.name,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for user actions
 */
export function addSentryBreadcrumb(
  message: string,
  category?: string,
  level?: Sentry.SeverityLevel,
  data?: Record<string, unknown>
) {
  Sentry.addBreadcrumb({
    message,
    category: category || 'user',
    level: level || 'info',
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Track Supabase errors specifically
 */
export function captureSupabaseError(
  error: { message: string; code?: string; details?: string },
  context?: Record<string, unknown>
) {
  Sentry.captureException(new Error(error.message), {
    tags: {
      errorType: 'supabase',
      errorCode: error.code || 'unknown',
    },
    extra: {
      ...context,
      details: error.details,
      code: error.code,
    },
  });
}

/**
 * Track React Query errors
 */
export function captureQueryError(
  error: Error,
  queryKey: unknown[],
  context?: Record<string, unknown>
) {
  Sentry.captureException(error, {
    tags: {
      errorType: 'react-query',
    },
    extra: {
      queryKey,
      ...context,
    },
  });
}

/**
 * Get Sentry logger for structured logging
 */
export function getSentryLogger() {
  return Sentry.logger;
}

/**
 * Create a custom span for performance tracking
 * Use this for meaningful actions like button clicks, API calls, etc.
 */
export function startSentrySpan<T>(
  options: {
    op: string;
    name: string;
    attributes?: Record<string, string | number | boolean>;
  },
  callback: (span: Sentry.Span) => T
): T {
  return Sentry.startSpan(
    {
      op: options.op,
      name: options.name,
    },
    (span) => {
      // Set attributes if provided
      if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }
      return callback(span);
    }
  );
}

/**
 * Create an async span for API calls
 */
export async function startSentrySpanAsync<T>(
  options: {
    op: string;
    name: string;
    attributes?: Record<string, string | number | boolean>;
  },
  callback: (span: Sentry.Span) => Promise<T>
): Promise<T> {
  return Sentry.startSpan(
    {
      op: options.op,
      name: options.name,
    },
    async (span) => {
      // Set attributes if provided
      if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
          span.setAttribute(key, value);
        });
      }
      return callback(span);
    }
  );
}
