# Raspberry Pi Setup (Fresh Devices)

This guide is the exact, step-by-step setup for brand new Raspberry Pis with no software installed.
It assumes you will run the Player Agent and Chromium kiosk on Raspberry Pi OS.

## What you need

- Raspberry Pi (Pi 4 or Pi 5 recommended)
- microSD card (16GB+)
- Power supply, monitor, keyboard/mouse (for first boot), Ethernet or Wi-Fi
- A laptop/desktop with the Raspberry Pi Imager installed

<!-- ## Step 1: Flash the OS (no software installed yet)
1. Install Raspberry Pi Imager: https://www.raspberrypi.com/software/
2. Open Raspberry Pi Imager.
3. Choose OS:
   - Recommended: "Raspberry Pi OS Lite (64-bit)"
4. Choose Storage: select your microSD card.
5. Click the gear icon (advanced settings) and set:
   - Hostname: e.g. `kiosk-01`
   - Enable SSH: yes
   - Username/password: set a strong password
   - Configure Wi-Fi (if not using Ethernet)
   - Locale and timezone
6. Click Write and wait for it to finish.

## Step 2: First boot
1. Insert the microSD card into the Pi and power it on.
2. If using a monitor, wait for the login prompt.
3. If using SSH, connect:
   - `ssh <username>@<hostname>.local`
   - Example: `ssh kiosk@kiosk-01.local`

## Step 3: System updates
Run:
```
sudo apt update
sudo apt -y upgrade
sudo reboot
```
Reconnect after reboot.

## Step 4: Install kiosk dependencies
Run:
```
sudo apt install -y \
  chromium \
  xserver-xorg \
  xinit \
  unclutter \
  fonts-noto \
  fonts-noto-color-emoji
```

## Step 5: Create a kiosk user (optional but recommended)
```
sudo adduser kiosk
sudo usermod -aG sudo kiosk
```
Switch to the kiosk user:
```
su - kiosk
``` -->

## Step 6: Install the Player Agent (pairing + heartbeat script)

Until the full agent repo exists, use the minimal agent script in this repo.

1. Copy the script to the Pi:

```
scp /Users/psgh4/dev/powerbase-kiosk/scripts/player-agent/agent.py \
  <username>@<hostname>.local:~/agent.py
```

2. Make it executable and generate a device_id:

```
chmod +x ~/agent.py
./agent.py init
```

## Step 7: Configure systemd services (agent + kiosk)

Create two services:

- `facilityos-agent.service` (heartbeat loop)
- `facilityos-kiosk.service` (Chromium kiosk)

1. Copy the kiosk launcher script:

```
cp /media/<usb-name>/kiosk.sh ~/
chmod +x ~/kiosk.sh
```

2. Ensure X server packages are installed (needed for Chromium):

```
sudo apt update
sudo apt install -y xserver-xorg xinit
```

3. Create the agent env file:

```
sudo tee /etc/facilityos-agent.env > /dev/null <<'EOF'
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
EOF
```

4. Create the agent service:

```
sudo tee /etc/systemd/system/facilityos-agent.service > /dev/null <<'EOF'
[Unit]
Description=FacilityOS Player Agent (heartbeat loop)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=greghandsley
WorkingDirectory=/home/greghandsley
EnvironmentFile=/etc/facilityos-agent.env
ExecStart=/usr/bin/python3 /home/greghandsley/agent.py heartbeat-loop --interval 25
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

5. Kiosk URL will be managed automatically.
   The agent writes `~/.facilityos/kiosk.conf` based on the Player's desired URL.

6. Create the kiosk service:

```
sudo tee /etc/systemd/system/facilityos-kiosk.service > /dev/null <<'EOF'
[Unit]
Description=FacilityOS Kiosk (Chromium)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=greghandsley
WorkingDirectory=/home/greghandsley
Environment=DISPLAY=:0
ExecStart=/usr/bin/startx /home/greghandsley/kiosk.sh -- :0
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF
```

7. Enable and start:

```
sudo systemctl daemon-reload
sudo systemctl enable facilityos-agent.service
sudo systemctl enable facilityos-kiosk.service
sudo systemctl start facilityos-agent.service
sudo systemctl start facilityos-kiosk.service
```

8. Check status/logs:

```
systemctl status facilityos-agent.service
systemctl status facilityos-kiosk.service
journalctl -u facilityos-agent.service -f
```

## Step 8: Validate kiosk launch

1. Reboot the Pi.
2. Confirm Chromium starts in kiosk mode.
3. Confirm the unpaired screen shows the device_id (until paired).

## Step 9: Pair the device

1. In the Powerbase admin UI, create a Player and generate a pairing code.
2. Run the agent pairing command:

```
SUPABASE_URL="https://<project-ref>.supabase.co" \
SUPABASE_ANON_KEY="<anon-key>" \
./agent.py pair <PAIRING_CODE>
```

3. Verify the device shows as paired and online.

## Notes

- If you want a "golden image" for bulk rollout, do not clone yet. Wait for Sprint 6.3.
- This doc will be updated once the agent repo and installer are finalized.
