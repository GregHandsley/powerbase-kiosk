// src/config/env.ts

export const APP_ENV = import.meta.env.MODE; // "development" | "production"

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_ANON_KEY = import.meta.env
  .VITE_SUPABASE_ANON_KEY as string;

export const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

// Optional org override (dev / preview)
export const ORG_OVERRIDE = import.meta.env.VITE_ORG_OVERRIDE as
  | string
  | undefined;

// Will be injected by Vite define(), fallback to "dev"
declare const __APP_VERSION__: string | undefined;
export const APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
