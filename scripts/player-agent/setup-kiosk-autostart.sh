#!/usr/bin/env bash
# Run this ON the Pi to set up kiosk via autostart (for Pi with desktop/autologin).
# Usage: ./setup-kiosk-autostart.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USERNAME="$(whoami)"
HOME_DIR="${HOME}"

echo "Setting up kiosk for user: ${USERNAME}"

# Stop and disable systemd kiosk (it conflicts)
echo "Disabling systemd kiosk service..."
sudo systemctl stop facilityos-kiosk 2>/dev/null || true
sudo systemctl disable facilityos-kiosk 2>/dev/null || true

# Ensure kiosk scripts exist
mkdir -p "${HOME_DIR}/facilityos"
cp "${SCRIPT_DIR}/kiosk.sh" "${HOME_DIR}/facilityos/"
cp "${SCRIPT_DIR}/kiosk-loop.sh" "${HOME_DIR}/facilityos/"
chmod +x "${HOME_DIR}/facilityos/kiosk.sh" "${HOME_DIR}/facilityos/kiosk-loop.sh"

# Create autostart
mkdir -p "${HOME_DIR}/.config/autostart"
cat > "${HOME_DIR}/.config/autostart/facilityos-kiosk.desktop" << EOF
[Desktop Entry]
Type=Application
Name=FacilityOS Kiosk
Exec=${HOME_DIR}/facilityos/kiosk-loop.sh
X-GNOME-Autostart-enabled=true
EOF

echo "Done. Reboot to start the kiosk: sudo reboot"
