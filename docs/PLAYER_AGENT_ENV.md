# Player Agent Environment Variables

This repo uses `.env.local` for local development. This file should **not**
be committed. Use the template below when setting up locally.

## `.env.local` template

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SENTRY_DSN=
VITE_ORG_OVERRIDE=
```

## Notes

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are required for the app.
- `VITE_SENTRY_DSN` is optional (production only).
- `VITE_ORG_OVERRIDE` is optional for local dev.
- Supabase Edge Functions receive `SUPABASE_URL` and `SUPABASE_ANON_KEY`
  automatically at runtime.

## Pi agent env (`/etc/facilityos-agent.env`)

- `SUPABASE_URL` – Supabase project URL
- `SUPABASE_ANON_KEY` – Supabase anon key
- `KIOSK_APP_BASE` – (optional) App base URL for unpaired screen, e.g. `https://facilityos.co.uk`
