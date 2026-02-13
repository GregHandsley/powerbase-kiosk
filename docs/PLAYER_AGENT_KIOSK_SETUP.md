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

## Update agent only (curl)

To update just the agent after setup:

```bash
curl -L -o ~/facilityos/agent.py \
  https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/test-preview/scripts/player-agent/agent.py
chmod +x ~/facilityos/agent.py
sudo systemctl restart facilityos-agent
```

Or run the deploy script:

```bash
curl -sL https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/test-preview/scripts/player-agent/deploy-agent-on-pi.sh | bash
```

## Update systemd services only

```bash
curl -L -o ~/facilityos-agent.service \
  https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/test-preview/scripts/player-agent/systemd/facilityos-agent.service
curl -L -o ~/facilityos-kiosk.service \
  https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/test-preview/scripts/player-agent/systemd/facilityos-kiosk.service
sudo cp ~/facilityos-agent.service ~/facilityos-kiosk.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart facilityos-agent facilityos-kiosk
```

## Pairing (new or revoked devices)

When the device is not paired or has been revoked, the kiosk shows a pairing screen:

1. Open Admin → Players.
2. Create or select a Player and click "Generate code" (or "Rotate" after revoking).
3. Enter the code on the kiosk screen and click Pair.

No command line required.
