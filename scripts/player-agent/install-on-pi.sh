#!/usr/bin/env bash
# Run this ON the Raspberry Pi (paste the curl one-liner from docs/PI_SETUP.md).
# Installs dependencies, downloads agent + kiosk from GitHub, installs systemd + autostart.
#
# Optional: use a different branch (default is main):
#   BRANCH=test-preview curl -sL https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/test-preview/scripts/player-agent/install-on-pi.sh | bash

set -e
BRANCH="${BRANCH:-main}"
REPO="GregHandsley/powerbase-kiosk"
BASE="https://raw.githubusercontent.com/${REPO}/${BRANCH}/scripts/player-agent"

echo "Using branch: ${BRANCH}"
echo "Installing packages (may ask for your password)..."
sudo apt-get update -qq
sudo apt-get install -y curl python3 || true
if command -v chromium-browser >/dev/null 2>&1; then
  echo "Chromium already installed."
elif command -v chromium >/dev/null 2>&1; then
  echo "Chromium already installed."
else
  sudo apt-get install -y chromium-browser || sudo apt-get install -y chromium || true
fi

PI_USER="$(whoami)"
PI_HOME="${HOME}"
FACILITYOS_DIR="${PI_HOME}/facilityos"
echo "User: ${PI_USER}  Home: ${PI_HOME}  Dir: ${FACILITYOS_DIR}"

mkdir -p "${FACILITYOS_DIR}"
echo "Downloading agent and kiosk scripts..."
curl -sL -o "${FACILITYOS_DIR}/agent.py"     "${BASE}/agent.py"
curl -sL -o "${FACILITYOS_DIR}/kiosk.sh"     "${BASE}/kiosk.sh"
curl -sL -o "${FACILITYOS_DIR}/kiosk-loop.sh" "${BASE}/kiosk-loop.sh"
chmod +x "${FACILITYOS_DIR}/agent.py" "${FACILITYOS_DIR}/kiosk.sh" "${FACILITYOS_DIR}/kiosk-loop.sh"
echo "Downloaded to ${FACILITYOS_DIR}"

if [[ ! -s /etc/facilityos-agent.env ]]; then
  echo "Creating /etc/facilityos-agent.env (you must edit it with your Supabase URL and key)."
  sudo tee /etc/facilityos-agent.env << 'ENVEOF'
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
ENVEOF
else
  echo "Config already exists: /etc/facilityos-agent.env"
fi

echo "Installing systemd services for user ${PI_USER}..."
curl -sL "${BASE}/systemd/facilityos-agent.service" | sed -e "s/greghandsley/${PI_USER}/g" -e "s|/home/greghandsley|${PI_HOME}|g" -e "s|/home/greghandsley/facilityos|${FACILITYOS_DIR}|g" | sudo tee /etc/systemd/system/facilityos-agent.service >/dev/null
curl -sL "${BASE}/systemd/facilityos-kiosk.service" | sed -e "s/greghandsley/${PI_USER}/g" -e "s|/home/greghandsley|${PI_HOME}|g" -e "s|/home/greghandsley/facilityos|${FACILITYOS_DIR}|g" | sudo tee /etc/systemd/system/facilityos-kiosk.service >/dev/null

sudo systemctl daemon-reload

# Autostart kiosk when user logs in (desktop)
mkdir -p "${PI_HOME}/.config/autostart"
cat > "${PI_HOME}/.config/autostart/facilityos-kiosk.desktop" << EOF
[Desktop Entry]
Type=Application
Name=FacilityOS Kiosk
Exec=${FACILITYOS_DIR}/kiosk-loop.sh
X-GNOME-Autostart-enabled=true
EOF
echo "Autostart entry created (kiosk will start after you log in)."

# Disable systemd kiosk so it doesn't fight with autostart (user can enable if using Lite)
sudo systemctl disable facilityos-kiosk 2>/dev/null || true

echo ""
echo "--- Next steps ---"
echo "1. Edit Supabase config:  sudo nano /etc/facilityos-agent.env"
echo "   Set SUPABASE_URL and SUPABASE_ANON_KEY (from Supabase dashboard → Settings → API)."
echo "2. Enable agent and reboot:  sudo systemctl enable --now facilityos-agent && sudo reboot"
echo "3. After reboot, open Admin → Players in the web app and pair using the code on the Pi."
echo ""
