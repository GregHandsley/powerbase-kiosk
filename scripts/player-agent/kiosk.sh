#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE_SYSTEM="/etc/facilityos-kiosk.conf"
CONFIG_FILE_USER="${HOME}/.facilityos/kiosk.conf"
DEFAULT_URL="https://facilityos.co.uk/kiosk/unpaired"
PROFILE_DIR="${HOME}/.facilityos/chromium-profile"

if [[ -f "${CONFIG_FILE_SYSTEM}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE_SYSTEM}"
elif [[ -f "${CONFIG_FILE_USER}" ]]; then
  # shellcheck disable=SC1090
  source "${CONFIG_FILE_USER}"
fi

KIOSK_URL="${KIOSK_URL:-${DEFAULT_URL}}"

if command -v chromium >/dev/null 2>&1; then
  CHROME_BIN="chromium"
elif command -v chromium-browser >/dev/null 2>&1; then
  CHROME_BIN="chromium-browser"
else
  echo "Chromium not found. Install 'chromium' package." >&2
  exit 1
fi

mkdir -p "${PROFILE_DIR}"
pkill -f chromium >/dev/null 2>&1 || true
sleep 1

exec "${CHROME_BIN}" \
  --kiosk \
  --noerrdialogs \
  --no-first-run \
  --no-default-browser-check \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --disable-translate \
  --disable-features=TranslateUI \
  --incognito \
  --user-data-dir="${PROFILE_DIR}" \
  --autoplay-policy=no-user-gesture-required \
  "${KIOSK_URL}"
