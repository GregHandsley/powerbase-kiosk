// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/env";
import { captureSupabaseError } from "./sentry";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // Global error handler for Supabase operations
  global: {
    headers: {
      "x-client-info": "powerbase-kiosk",
    },
  },
});

// Helper function to handle Supabase errors with Sentry tracking
export async function handleSupabaseError<T>(
  operation: () => Promise<{ data: T | null; error: { message: string; code?: string; details?: string } | null }>,
  context?: Record<string, unknown>
): Promise<{ data: T | null; error: { message: string; code?: string; details?: string } | null }> {
  try {
    const result = await operation();
    
    if (result.error) {
      // Track Supabase errors in Sentry
      captureSupabaseError(result.error, context);
    }
    
    return result;
  } catch (error) {
    // Handle unexpected errors
    if (error instanceof Error) {
      captureSupabaseError(
        { message: error.message, code: "UNEXPECTED_ERROR" },
        { ...context, originalError: error }
      );
    }
    
    return {
      data: null,
      error: error instanceof Error 
        ? { message: error.message, code: "UNEXPECTED_ERROR" }
        : { message: "An unexpected error occurred", code: "UNEXPECTED_ERROR" },
    };
  }
}
