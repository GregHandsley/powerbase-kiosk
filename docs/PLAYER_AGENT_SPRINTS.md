# Player Agent Sprints (Supabase + Powerbase Kiosk)

This plan is tailored to this repo's architecture:

- Frontend: Vite + React (TypeScript), deployed to Cloudflare Pages.
- Backend: Supabase (Postgres + Auth + Edge Functions).
- No monorepo, no separate API server in this codebase.

Key docs:

- Architecture: `docs/PLAYER_AGENT_ARCHITECTURE.md`
- Decision log: `docs/PLAYER_AGENT_DECISIONS.md`

## Raspberry Pi setup timeline (crystal clear)

**When to touch real hardware**

- After Sprint 0.3: choose OS + kiosk runtime approach, draft a golden image checklist.
- During Sprint 1.2–1.3: image 1–2 Pis for pairing + heartbeat validation.
- Sprint 2.1: first full setup (OS + agent install + unpaired screen).
- Sprint 2.2: add systemd services + kiosk watchdog on those devices.
- Sprint 6.3: finalize installer + golden image for bulk rollout.

**Minimum setup steps (applies in Sprint 2.1)**

1. Flash OS image to SD (lock OS choice in Sprint 0.1).
2. Boot Pi, set hostname, locale, timezone, and SSH.
3. Install dependencies (Chromium + any system libs).
4. Install agent (manual script until Sprint 6.3 installer).
5. Register systemd services for agent + kiosk.
6. Reboot and confirm unpaired screen shows `device_id`.

<!-- ## Sprint 0.1 — Architecture decisions + health check
**Goal:** Lock the "golden path" and prove the Supabase path end-to-end.

**Tasks**
- Write the architecture doc (Supabase-first, Edge Functions, no monorepo).
- Add `/health` Edge Function.
- Decide token strategy (hash in DB, clear token only on device).
- Decide polling interval and CEC approach.

**Acceptance Criteria**
- `/health` returns OK.
- Decision log exists and is referenced in docs.

## Sprint 0.2 — Core data model
**Goal:** Stand up the minimal schema with migrations.

**Tasks**
- Create tables:
  - `players`
  - `player_pairing_codes`
  - `player_devices`
  - `player_commands`
  - `player_logs`
- Add minimal indexes for lookups (player_id, created_at, status).

**Acceptance Criteria**
- `supabase` migrations apply cleanly.
- Schema reflects intended fields. -->

<!-- ## Sprint 0.3 — API skeleton + shared types
**Goal:** Expose device/admin endpoints with typed contracts.

**Tasks**
- Add Edge Function stubs:
  - `POST /player/pair`
  - `POST /player/heartbeat`
  - `GET /player/commands`
  - `POST /player/commands/:id/ack`
  - `POST /player/logs`
- Define shared types in `src/types/` for UI + functions.
- Add `.env.local` template and required vars doc.

**Acceptance Criteria**
- Functions compile and deploy.
- Shared types used in UI + functions. -->

<!-- ## Sprint 1.1 — Admin create Player
**Goal:** Admin can create a Player record.

**Tasks**
- Admin UI form to create players.
- Server-side validation (Edge Function or Supabase RPC).

**Acceptance Criteria**
- Admin can create Player and see it in list. -->

<!-- ## Sprint 1.2 — Pairing codes + device pairing
**Goal:** Bind a physical Pi via a pairing code.

**Tasks**
- Generate pairing codes (admin action).
- `POST /player/pair` consumes code, returns device token.
- Persist `device_id` and `token_hash`.

**Acceptance Criteria**
- Pairing code expires and is single-use.
- Device token returned on success. -->

<!-- ## Sprint 1.3 — Heartbeat + online status
**Goal:** Show that a paired device is online.

**Tasks**
- `POST /player/heartbeat` with token auth.
- Update `last_seen_at`.
- UI shows online/offline indicator.

**Acceptance Criteria**
- Heartbeat requires token (401 if invalid).
- Admin UI shows `last_seen` within 60 seconds. -->

<!-- ## Sprint 2.1 — Kiosk boot + unpaired screen
**Goal:** Pi boots and shows an unpaired screen.

**Tasks**
- Agent creates `device_id` on first run.
- Unpaired UI shows device_id and pairing instructions.

**Acceptance Criteria**
- Power cycle → unpaired screen appears. -->

## Sprint 2.2 — Kiosk runtime + watchdog

**Goal:** Chromium starts in kiosk mode and self-recovers.

**Tasks**

- Chromium launch script (`--kiosk`, GPU flags, no dialogs).
- systemd services:
  - `facilityos-agent.service`
  - `facilityos-kiosk.service`
- Agent syncs Player desired URL and restarts kiosk on change.

**Acceptance Criteria**

- Chromium crash → auto-restart via systemd.
- Boot to kiosk within target window (e.g., <90s).

## Sprint 3.1 — Command queue + polling

**Goal:** Device can receive commands via polling.

**Tasks**

- `player_commands` enqueue endpoint.
- `GET /player/commands` returns pending items.
- Poll every 5–15s (configurable).

**Acceptance Criteria**

- Commands delivered once and tracked.

## Sprint 3.2 — Command execution + ACK

**Goal:** Device executes commands and reports results.

**Tasks**

- Execute `set_url`, `reload`, `reboot`, `restart_kiosk`.
- `POST /player/commands/:id/ack` with success/failure.
- Write logs to `player_logs`.

**Acceptance Criteria**

- Failures include error text.
- Admin UI shows per-player command history.

## Sprint 4.1 — Power state commands

**Goal:** Turn screens on/off centrally.

**Tasks**

- Add `desired_power_state` + commands `display_on`/`display_off`.
- Agent runs HDMI-CEC via `cec-client`.

**Acceptance Criteria**

- CEC works where supported.

## Sprint 4.2 — Schedules + fallback

**Goal:** Automate screen on/off with fallback.

**Tasks**

- Add `power_schedule_json` to players.
- Schedule runner and fallback blank screen mode.

**Acceptance Criteria**

- CEC unsupported → fallback used and logged.
- Schedule tolerance within ±2 min.

## Sprint 5.1 — Security hardening

**Goal:** Reduce token and device risk.

**Tasks**

- Token rotation + revoke.
- Device lockout on suspicious behavior.
- Least-privilege systemd units.

**Acceptance Criteria**

- Revoked token blocks heartbeats/commands immediately.

## Sprint 5.2 — Observability + alerts

**Goal:** Make fleet health visible.

**Tasks**

- Metrics: uptime, CPU, temp, memory, Chromium status.
- Offline threshold alerts (Edge Function + scheduled job).

**Acceptance Criteria**

- Offline alert triggers after X minutes.

## Sprint 5.3 — Updates + staged rollout

**Goal:** Remote agent updates without reimaging.

**Tasks**

- Agent self-update from release endpoint.
- Staged rollout (10% → 50% → 100%).

**Acceptance Criteria**

- Agent update reports version and succeeds.

## Sprint 6.1 — Bulk ops

**Goal:** Handle many screens efficiently.

**Tasks**

- Bulk create players (CSV import).
- Bulk commands (reload all, set URL per site).

**Acceptance Criteria**

- Bulk URL change works across a site.

## Sprint 6.2 — Templates + grouping

**Goal:** Standardize configurations per site.

**Tasks**

- Templates ("Powerbase default", "Base default").
- Player grouping (site/facility).

**Acceptance Criteria**

- Templates apply consistently.

## Sprint 6.3 — Installer + golden image

**Goal:** Fast provisioning for new devices.

**Tasks**

- One-line install script.
- "Golden image" doc.
- Optional QR pairing flow.

**Acceptance Criteria**

- Provision 10 players in <30 minutes end-to-end.
- Installer reliably sets up systemd + kiosk.
