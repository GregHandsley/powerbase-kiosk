#!/bin/bash
# Deploy agent.py to the Pi and restart the facilityos-agent service.
# Usage: ./deploy-agent.sh [user@host]
# Example: ./deploy-agent.sh greghandsley@Powerbase-Reception.local

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_SRC="${SCRIPT_DIR}/agent.py"
TARGET="${1:-greghandsley@Powerbase-Reception.local}"

echo "Deploying agent to ${TARGET}..."
scp "${AGENT_SRC}" "${TARGET}:~/agent.py"

echo "Restarting facilityos-agent..."
ssh "${TARGET}" "sudo systemctl restart facilityos-agent"

echo "Checking status..."
ssh "${TARGET}" "sudo systemctl status facilityos-agent --no-pager"

echo "Done."
