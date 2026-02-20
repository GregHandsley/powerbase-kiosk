# Raspberry Pi setup – Powerbase Kiosk (step-by-step)

This is the **only** guide you need. Do the steps in order on a Pi that already has **Raspberry Pi OS** installed.

Repo: **https://github.com/GregHandsley/powerbase-kiosk**

---

## What you need before starting

- Raspberry Pi with Raspberry Pi OS (desktop or lite; desktop is easier for kiosk).
- Pi connected to the internet (Wi‑Fi or ethernet).
- Your **Supabase project URL** and **anon key** (same as your web app: Project Settings → API in Supabase dashboard).

---

## Step 1: Open a terminal on the Pi

- If you have the desktop: **Menu → Terminal** (or press `Ctrl+Alt+T`).
- You’ll see a window with a prompt like `pi@raspberrypi:~ $`. All commands below are typed there.

---

## Step 2: Run the install script (downloads and installs the software)

Copy this **entire block** and paste it into the terminal, then press Enter.

**Use `main` if your code is on the main branch, or replace `main` with your branch name (e.g. `test-preview`).**

```bash
curl -sL https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/main/scripts/player-agent/install-on-pi.sh | bash
```

- It will: install Chromium and Python, download the agent and kiosk scripts from GitHub, and install the services for the user you’re logged in as.
- If it says “command not found: curl”, run: `sudo apt update && sudo apt install -y curl` then run the line above again.

---

## Step 3: Add your Supabase URL and key

The script creates a config file. You must put your real Supabase URL and anon key in it.

1. Open the file in the nano editor:
   ```bash
   sudo nano /etc/facilityos-agent.env
   ```
2. You’ll see two lines. **Replace** the placeholders so the file looks exactly like this (with your real values):

   ```bash
   SUPABASE_URL=https://abcdefghijk.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your_long_key...
   ```

   - Get these from: Supabase dashboard → your project → **Settings** → **API** → **Project URL** and **anon public** key.

3. Save and exit: press `Ctrl+O`, Enter, then `Ctrl+X`.

---

## Step 4: Turn on the agent and reboot

Run:

```bash
sudo systemctl enable --now facilityos-agent
sudo reboot
```

The Pi will restart. After it boots, the **agent** is running (it provides the pairing code) and the **kiosk** will open Chromium to the unpaired page.

---

## Step 5: Pair the Pi to a player (in the web app)

1. On the Pi screen you should see the **pairing code** (e.g. `ABC-DEF-GHI`). If you see “Waiting for agent…”, wait a minute and refresh, or run: `sudo systemctl status facilityos-agent` to check the agent.
2. On your **computer**, open your Powerbase Kiosk web app → **Admin** → **Players**.
3. Create a player if you don’t have one: **Create player** → fill name → save.
4. For that player, open the **⋮** menu → **Pair device** (or similar). Enter the code from the Pi and confirm.
5. The kiosk will then connect to that player and show the correct URL.

---

## If something goes wrong

- **“Waiting for agent…” on the kiosk**  
  Check the agent: `sudo systemctl status facilityos-agent`  
  If it’s failed, look at logs: `sudo journalctl -u facilityos-agent -n 50`

- **Chromium doesn’t start / no browser**  
  Make sure you’re on Raspberry Pi OS **desktop** with **autologin** so the kiosk user has a display. Or see “Kiosk as systemd service” below.

- **Wrong branch**  
  If your code is on a different branch (e.g. `test-preview`), use it in the script URL:
  `https://raw.githubusercontent.com/GregHandsley/powerbase-kiosk/test-preview/scripts/player-agent/install-on-pi.sh`

---

## Optional: Kiosk as systemd service (no desktop)

If you run **Raspberry Pi OS Lite** (no desktop) and use a display that works without a full desktop (e.g. DRM/KMS), you can run the kiosk as a system service instead of autostart. The install script will have installed the `facilityos-kiosk` service; after the agent is working, run:

```bash
sudo systemctl enable --now facilityos-kiosk
```

If the kiosk service fails (e.g. no DISPLAY), use the desktop + autostart path from Step 4 instead.
