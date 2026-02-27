# Powerbase Kiosk

Powerbase Kiosk is a web app for facility booking and wayfinding, plus kiosk displays that run on Raspberry Pi.

## Run locally

1. **Install dependencies:** `npm install`
2. **Configure env:** Copy `.env.example` to `.env` (e.g. `cp .env.example .env`) and fill in your values.
3. **Start dev server:** `npm run dev`

### Environment variables

- **Required:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (from Supabase Dashboard → Settings → API).
- **Optional:** `VITE_SENTRY_DSN` (error tracking), `VITE_ORG_OVERRIDE` (e.g. `facilityos` or `loughboroughsport` for dev/preview).

See [.env.example](.env.example) for a template.

## Kiosk on Raspberry Pi

To run the kiosk and player agent on a Raspberry Pi, follow the step-by-step guide:

**[docs/PI_SETUP.md](docs/PI_SETUP.md)** — install Chromium and the agent, add your Supabase URL and key, then pair the Pi to a player from the web app.
