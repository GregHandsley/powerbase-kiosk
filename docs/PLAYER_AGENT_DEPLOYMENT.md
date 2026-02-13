# Player Agent Deployment (Local Runtime + Scheduled Updates)

This guide covers:

- Running the kiosk locally on the Pi (no code fetch during normal operation).
- Forcing updates during development.
- Overnight-only updates in production.
- How to tell if a Pi is pointing at production or development.

## 1) Local runtime (always)

The Pi should run from local scripts:

- `~/facilityos/agent.py`
- `~/facilityos/kiosk.sh`

These are the only files executed at runtime. The Pi should only call the API for:

- heartbeat
- config sync (desired URL)

## 2) Development updates (forced)

Use this when you are actively testing changes and want immediate updates.

### Manual update (dev)

Run on the Pi:

```
curl -L -o ~/facilityos/agent.py \
  https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/main/scripts/player-agent/agent.py

curl -L -o ~/facilityos/kiosk.sh \
  https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/main/scripts/player-agent/kiosk.sh

chmod +x ~/facilityos/agent.py ~/facilityos/kiosk.sh
sudo systemctl restart facilityos-agent.service
sudo systemctl restart facilityos-kiosk.service
```

### Optional: dev-only cron (frequent)

If you want automatic dev updates every 10 minutes:

```
crontab -e
```

Add:

```
*/10 * * * * /bin/bash -lc 'curl -L -o ~/facilityos/agent.py https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/main/scripts/player-agent/agent.py && curl -L -o ~/facilityos/kiosk.sh https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/main/scripts/player-agent/kiosk.sh && chmod +x ~/facilityos/agent.py ~/facilityos/kiosk.sh && sudo systemctl restart facilityos-agent.service && sudo systemctl restart facilityos-kiosk.service'
```

## 3) Production updates (overnight only)

Use a scheduled update window so the display is never interrupted during the day.

### Nightly update (prod)

```
crontab -e
```

Add (example: 02:30 daily):

```
30 2 * * * /bin/bash -lc 'curl -L -o ~/facilityos/agent.py https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/main/scripts/player-agent/agent.py && curl -L -o ~/facilityos/kiosk.sh https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/main/scripts/player-agent/kiosk.sh && chmod +x ~/facilityos/agent.py ~/facilityos/kiosk.sh && sudo systemctl restart facilityos-agent.service && sudo systemctl restart facilityos-kiosk.service'
```

## 4) How to tell if a Pi is dev or prod

The Pi’s environment is determined by its **Supabase URL** and **desired URL**:

### Check Supabase project (API environment)

```
cat /etc/facilityos-agent.env
```

If `SUPABASE_URL` points to your production Supabase project, the Pi is **production**.
If it points to a dev/staging project, the Pi is **development**.

### Check the kiosk URL

```
cat ~/.facilityos/kiosk.conf
```

This shows the **current URL** displayed by Chromium.

## 5) Recommended practice

- **Dev Pis:** update frequently, or manually after each change.
- **Prod Pis:** update only overnight.
- Always run local scripts; updates only replace those files.

## Notes

- Keep keys in `/etc/facilityos-agent.env` (not in shell history).
- If the Pi must be fully locked down, schedule a maintenance window for updates.

## 6) Sprint 5.3 self-update controls

Player agent updates can now be controlled from Admin -> Players -> Advanced.

- Queue updates per device from row Actions -> `Update agent`.
- Use bulk controls in Advanced:
  - `Update selected`
  - `Update all filtered`
- Optional `manifest_url` can be supplied from the Admin advanced panel.
- Fallback manifest env on Pi: `PLAYER_AGENT_UPDATE_MANIFEST_URL`.

### Manifest JSON format

```
{
  "version": "2026.02.13.1",
  "agent_url": "https://raw.githubusercontent.com/<org>/<repo>/<ref>/scripts/player-agent/agent.py",
  "agent_sha256": "<optional sha256 hex>"
}
```

### Observability

Heartbeat now reports:

- `agent_version`
- `agent_update_status`
- `agent_update_last_error`
- `agent_update_last_success_at`
