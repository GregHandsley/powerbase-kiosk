#!/bin/bash
# Run this ON the Pi. Fetches only agent.py from GitHub and restarts the service.
# No repo clone required.
#
# Usage (on the Pi):
#   curl -sSL https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/test-preview/scripts/player-agent/update-agent-on-pi.sh | bash
#
# Or save and run:
#   curl -sSO https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/test-preview/scripts/player-agent/update-agent-on-pi.sh
#   chmod +x update-agent-on-pi.sh
#   ./update-agent-on-pi.sh

set -e
REPO="GregHandsley/powerbase-kiosk"
BRANCH="test-preview"
URL="https://raw.githubusercontent.com/${REPO}/${BRANCH}/scripts/player-agent/agent.py"

echo "Fetching agent.py..."
curl -sSL -o ~/agent.py "${URL}"

echo "Restarting facilityos-agent..."
sudo systemctl restart facilityos-agent

echo "Done."
sudo systemctl status facilityos-agent --no-pager
