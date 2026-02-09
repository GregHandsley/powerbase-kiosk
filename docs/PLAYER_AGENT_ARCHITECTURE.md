# Player Agent Architecture (Supabase-first)

This architecture fits the current Powerbase Kiosk repo and infrastructure:

- Frontend: Vite + React (TypeScript) on Cloudflare Pages.
- Backend: Supabase (Postgres + Auth + Edge Functions).
- No monorepo, no separate API server in this codebase.

## Components

- **Admin UI (this app):** Creates Players, issues pairing codes, sends commands.
- **Supabase Postgres:** Stores players, devices, pairing codes, commands, logs.
- **Supabase Edge Functions:** Device-facing API (pair, heartbeat, commands, logs).
- **Player Agent (Raspberry Pi):** Polls, executes commands, runs kiosk runtime.

## Golden path flows

**Pairing**

1. Admin creates Player and pairing code in UI.
2. Agent posts pairing code + device_id to `/player/pair`.
3. API validates code, stores device record, returns device token.
4. Agent stores token locally (token hash only in DB).

**Heartbeat**

1. Agent sends `/player/heartbeat` with device token.
2. API validates token, updates `last_seen_at`, stores metadata.

**Commands**

1. Admin enqueues command for a Player.
2. Agent polls `/player/commands`.
3. Agent executes command and ACKs `/player/commands/:id/ack`.

## Security model (summary)

- Device tokens are **stored only on device**; DB stores **token hash**.
- Device API is **polling only** (no inbound connections).
- Admin actions use existing Supabase auth session.

## Hosting and deployment

- UI deploys via Cloudflare Pages from `main`.
- Edge Functions deploy via Supabase CLI.
- Supabase migrations live in `migrations/`.

## Decisions

See `docs/PLAYER_AGENT_DECISIONS.md` for the decision log.
