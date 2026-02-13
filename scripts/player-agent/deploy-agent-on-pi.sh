#!/bin/bash
# Deploy agent to Pi. Uses curl to fetch from GitHub (no local repo required).
#
# Usage (on the Pi):
#   curl -sL https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/test-preview/scripts/player-agent/deploy-agent-on-pi.sh | bash
#
# Or run directly:
#   ./scripts/player-agent/deploy-agent-on-pi.sh

set -e
BASE="https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/test-preview/scripts/player-agent"

mkdir -p ~/facilityos
curl -L -o ~/facilityos/agent.py \
  "${BASE}/agent.py"
chmod +x ~/facilityos/agent.py
echo "Deployed agent.py to ~/facilityos/agent.py"

sudo systemctl restart facilityos-agent 2>/dev/null || true
echo "Restarted facilityos-agent (or start it if not yet configured)"

if systemctl is-active --quiet facilityos-agent 2>/dev/null; then
  sudo systemctl status facilityos-agent --no-pager
fi
echo "Done."
