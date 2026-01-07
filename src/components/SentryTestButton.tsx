// src/components/SentryTestButton.tsx
// Test component to verify Sentry error tracking is working
import * as Sentry from "@sentry/react";

/**
 * Test button component to verify Sentry error tracking
 * Add this to your app temporarily to test that Sentry is working
 */
export function SentryTestButton() {
  return (
    <button
      type="button"
      onClick={() => {
        throw new Error("This is your first error!");
      }}
      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm"
    >
      Break the world (Test Sentry)
    </button>
  );
}

