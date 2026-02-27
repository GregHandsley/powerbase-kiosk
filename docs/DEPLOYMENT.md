# Deployment

## Frontend

The app is deployed to **Cloudflare Pages** (or similar). Deploy by pushing to `main` (or your configured production branch); the build runs in CI or in the host’s build pipeline.

- **Build:** `npm run build`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (and any other `VITE_*` vars you use) in the host’s environment.
- **Source maps:** For Sentry, set `SENTRY_AUTH_TOKEN` (and optionally `SENTRY_ORG`, `SENTRY_PROJECT`) in the build environment so the Vite Sentry plugin can upload source maps.

## Supabase Edge Functions

Edge Functions are deployed using the scripts in **`scripts/deploy/`** (e.g. `deploy-send-email-digest-function.sh`, `deploy-process-org-logo-function.sh`). Run them after linking to your Supabase project.

- **Details:** See [supabase/functions/README.md](../supabase/functions/README.md) for local testing and production deploy commands.
- **Secrets:** Configure function environment variables (e.g. `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`) in the Supabase Dashboard under Edge Functions → each function → Settings.

## Database

Migrations live in the **`migrations/`** directory at the project root. Apply them manually or via the Supabase CLI (e.g. `supabase db push` or by running the SQL in the Supabase SQL editor). Run migrations in order when they depend on each other.
