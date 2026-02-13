#!/bin/bash
# Run this ON the Pi after pulling the repo from GitHub.
# Copies agent.py to home and restarts facilityos-agent.
#
# Usage (on the Pi):
#   cd ~/powerbase-kiosk
#   git pull origin test-preview
#   ./scripts/player-agent/deploy-agent-on-pi.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_SRC="${SCRIPT_DIR}/agent.py"

if [ ! -f "${AGENT_SRC}" ]; then
  echo "Error: agent.py not found at ${AGENT_SRC}"
  exit 1
fi

cp "${AGENT_SRC}" ~/agent.py
echo "Copied agent.py to ~/agent.py"

sudo systemctl restart facilityos-agent
echo "Restarted facilityos-agent"

sudo systemctl status facilityos-agent --no-pager
echo "Done."
