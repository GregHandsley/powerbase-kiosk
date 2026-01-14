Powerbase Kiosk — Infrastructure & Deployment Context
Purpose of this document

This document defines the infrastructure, deployment pipeline, and operational constraints of the Powerbase Kiosk application.

Any code changes, refactors, or suggestions should respect this setup unless explicitly instructed otherwise.

High-level architecture

Frontend:

Vite + React (TypeScript)

Static build output (dist/)

Hosting:

Cloudflare Pages (static hosting)

Backend / Data:

Supabase (PostgreSQL + Auth + Storage)

CI:

GitHub Actions (lint + type-check + build)

CD:

Cloudflare Pages auto-deploys from main

Domains:

facilityos.co.uk (primary)

loughboroughsport.facilityos.co.uk (organisation-specific)

Observability:

Sentry (production only)

Branching & deployment model
Branches

main

Production

Automatically deployed to Cloudflare Pages

Must always pass CI

Feature branches

Local development only

Merged into main via PR

CI rules

GitHub Actions runs on:

Pull requests → main

Pushes to main

CI steps:

npm ci

npm run lint

npm run type-check

npm run build

If any step fails:

The PR must not be merged

Production must not deploy

Environment separation
Local development

Uses .env.local

May point to development Supabase

Safe for experimentation and migrations

Never commits secrets

Production (Cloudflare Pages)

Environment variables are configured in Cloudflare, not in GitHub:

VITE_SUPABASE_URL → production DB

VITE_SUPABASE_ANON_KEY → production key

SENTRY_DSN → production only

SENTRY_AUTH_TOKEN → build-time only

SENTRY_PROJECT

ORG_OVERRIDE → unset in production

⚠️ Never hardcode secrets in code or commit them to Git

Organisation / multi-tenant logic

Organisation is determined at runtime, based on hostname.

Source of truth
getOrganisation(): Organisation

Located in:

src/config/organisation.ts

Rules

loughboroughsport.facilityos.co.uk → loughboroughsport

Default → facilityos

Local dev override supported via:

VITE_ORG_OVERRIDE

Constraints

Organisation logic must not live in env.ts

env.ts only reads environment variables

Business logic lives elsewhere

Versioning & releases

App version is injected at build time via:

**APP_VERSION**

Used for:

Sentry release tracking

Debugging production issues

Version corresponds to Git commit SHA or tag

Husky & git hooks

Husky runs locally only

Husky must never block CI

CI workflow sets HUSKY=0 environment variable to skip Husky execution

prepare script runs Husky, but Husky respects HUSKY=0 and exits early in CI

Do not reintroduce:

Husky execution in CI

Git hooks that affect production builds

Code quality standards

Mandatory:

TypeScript strict checks must pass

ESLint must pass with zero warnings

Prettier formatting enforced

CI is the final authority:

If CI fails, the change is invalid

Local “it works on my machine” is insufficient

What NOT to change without discussion

Cursor should not suggest or implement the following unless explicitly requested:

Switching hosting providers (Vercel / Netlify / AWS)

Moving secrets into GitHub

Removing CI steps

Disabling TypeScript strictness

Collapsing dev/prod environments

Introducing runtime environment mutation

Converting this to a monorepo

Adding server-side rendering

What IS encouraged

Feature development

Performance optimisations

Better typing

Improved error handling

Safer DB access patterns

UI/UX improvements

Test additions (unit or integration)

Incremental refactors

Mental model to follow

Production is sacred.

Local is flexible.
CI is non-negotiable.
Deployments are boring and predictable.

If something feels clever, magical, or fragile — it is probably wrong.

Summary for Cursor

This is a static frontend app

Deployed via Cloudflare Pages

Protected by GitHub Actions CI

Uses Supabase as a managed backend

Environment separation is intentional

Organisation detection is runtime-based

Stability > speed of change
