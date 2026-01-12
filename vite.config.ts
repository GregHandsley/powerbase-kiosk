import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// You can read from package.json or a manual string
import pkg from './package.json';

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
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    // Generate source maps for production (Sentry will upload them)
    sourcemap: true,
  },
});
