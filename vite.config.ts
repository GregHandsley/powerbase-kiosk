import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// Determine app version from environment variables or fallback to "dev"
const APP_VERSION =
  process.env.CF_PAGES_COMMIT_SHA || // Cloudflare Pages env var (when building on Pages)
  process.env.GITHUB_SHA || // GitHub Actions env var (if you build there)
  process.env.VITE_APP_VERSION || // manual override
  'dev';

export default defineConfig({
  plugins: [
    react(),
    // Sentry plugin for source maps upload (only in production builds)
    process.env.NODE_ENV === 'production' && process.env.SENTRY_AUTH_TOKEN
      ? sentryVitePlugin({
          org: process.env.SENTRY_ORG || 'sleeveandsend',
          project:
            process.env.SENTRY_PROJECT || 'loughboroughsportfacilityosdev',
          authToken: process.env.SENTRY_AUTH_TOKEN,
          sourcemaps: {
            assets: './dist/**',
            ignore: ['node_modules'],
            filesToDeleteAfterUpload: './dist/**/*.map',
          },
        })
      : null,
  ].filter(Boolean),
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  build: {
    // Generate source maps for production (Sentry will upload them)
    sourcemap: true,
  },
});
