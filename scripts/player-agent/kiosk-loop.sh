#!/usr/bin/env bash
# Wrapper that runs kiosk.sh in a loop - when Chromium exits (killed by agent or crash), restart it.
# Use this with autostart so the kiosk runs in the user's graphical session.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIOSK_SCRIPT="${SCRIPT_DIR}/kiosk.sh"

while true; do
  "${KIOSK_SCRIPT}" || true
  sleep 2
done
