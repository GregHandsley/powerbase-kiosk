# Player Agent Decision Log

This log captures architecture decisions for the Player Agent workstream.

## 2026-02-06

- **Backend approach:** Supabase-first (Postgres + Edge Functions), no new API server.
- **Device auth:** Device token stored only on device; DB stores token hash.
- **Polling interval:** 5–15 seconds (configurable on agent).
- **CEC strategy:** Use HDMI-CEC via `cec-client` with fallback to blank screen mode.
