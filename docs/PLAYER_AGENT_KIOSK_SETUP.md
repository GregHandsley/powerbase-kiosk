# Kiosk Display Setup (Raspberry Pi with Desktop)

When the Pi has a desktop with autologin, the kiosk must run in the user's graphical session. Use **autostart** instead of the systemd kiosk service.

## Quick setup (run on Pi)

```bash
# 1. Disable systemd kiosk (conflicts)
sudo systemctl stop facilityos-kiosk
sudo systemctl disable facilityos-kiosk

# 2. Fetch scripts
mkdir -p ~/facilityos
curl -L -o ~/facilityos/kiosk.sh \
  https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/test-preview/scripts/player-agent/kiosk.sh
curl -L -o ~/facilityos/kiosk-loop.sh \
  https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/test-preview/scripts/player-agent/kiosk-loop.sh
chmod +x ~/facilityos/kiosk.sh ~/facilityos/kiosk-loop.sh

# 3. Create autostart (uses your home dir automatically)
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/facilityos-kiosk.desktop << EOF
[Desktop Entry]
Type=Application
Name=FacilityOS Kiosk
Exec=${HOME}/facilityos/kiosk-loop.sh
X-GNOME-Autostart-enabled=true
EOF

# 4. Reboot
sudo reboot
```

## Verify agent is running

```bash
sudo systemctl status facilityos-agent
# Should be active (running)
```

After reboot, the kiosk starts when the desktop loads. The agent updates the URL and restarts Chromium when you change it in Admin → Players.
