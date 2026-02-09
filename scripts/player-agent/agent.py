#!/usr/bin/env python3
import argparse
import json
import os
import socket
import sys
import time
import uuid
import urllib.request
import urllib.parse

STATE_PATH = os.path.expanduser("~/.facilityos/player-agent.json")
KIOSK_CONFIG_PATH = os.path.expanduser("~/.facilityos/kiosk.conf")
DEFAULT_KIOSK_URL = "https://facilityos.co.uk/kiosk/unpaired"


def load_state():
    if not os.path.exists(STATE_PATH):
        return {}
    with open(STATE_PATH, "r", encoding="utf-8") as handle:
        return json.load(handle)


def save_state(state):
    os.makedirs(os.path.dirname(STATE_PATH), exist_ok=True)
    with open(STATE_PATH, "w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2, sort_keys=True)


def ensure_device_id(state):
    device_id = state.get("device_id")
    if device_id:
        return device_id
    device_id = str(uuid.uuid4())
    state["device_id"] = device_id
    save_state(state)
    return device_id


def resolve_supabase_url(arg_value):
    url = arg_value or os.environ.get("SUPABASE_URL")
    if not url:
        raise ValueError("SUPABASE_URL is required (env or --url).")
    return url.rstrip("/")


def resolve_supabase_key(arg_value):
    key = arg_value or os.environ.get("SUPABASE_ANON_KEY")
    if not key:
        raise ValueError("SUPABASE_ANON_KEY is required (env or --key).")
    return key


def pair_device(code, supabase_url, supabase_key):
    state = load_state()
    device_id = ensure_device_id(state)

    payload = {
        "code": code,
        "device_id": device_id,
        "meta": {
            "hostname": socket.gethostname(),
        },
    }

    endpoint = f"{supabase_url}/functions/v1/player-pair"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request) as response:
            body = response.read().decode("utf-8")
            data = json.loads(body)
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8") if error.fp else ""
        raise RuntimeError(
            f"Pairing failed (HTTP {error.code}): {error_body or error.reason}"
        ) from error

    device_token = data.get("device_token")
    player_id = data.get("player_id")
    if not device_token or not player_id:
        raise RuntimeError("Pairing response missing device_token or player_id.")

    state.update(
        {
            "player_id": player_id,
            "device_token": device_token,
        }
    )
    save_state(state)
    return state


def send_heartbeat(supabase_url, supabase_key):
    state = load_state()
    device_id = state.get("device_id")
    device_token = state.get("device_token")
    if not device_id or not device_token:
        raise RuntimeError("Device not paired. Run 'pair' first.")

    payload = {
        "device_id": device_id,
        "device_token": device_token,
        "meta": {
            "hostname": socket.gethostname(),
        },
    }

    endpoint = f"{supabase_url}/functions/v1/player-heartbeat"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request) as response:
            body = response.read().decode("utf-8")
            data = json.loads(body)
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8") if error.fp else ""
        raise RuntimeError(
            f"Heartbeat failed (HTTP {error.code}): {error_body or error.reason}"
        ) from error

    if not data.get("ok"):
        raise RuntimeError("Heartbeat response missing ok=true.")

    return data


def fetch_player_config(supabase_url, supabase_key):
    state = load_state()
    device_id = state.get("device_id")
    device_token = state.get("device_token")
    if not device_id or not device_token:
        raise RuntimeError("Device not paired. Run 'pair' first.")

    payload = {
        "device_id": device_id,
        "device_token": device_token,
    }

    endpoint = f"{supabase_url}/functions/v1/player-config"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request) as response:
            body = response.read().decode("utf-8")
            data = json.loads(body)
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8") if error.fp else ""
        raise RuntimeError(
            f"Config fetch failed (HTTP {error.code}): {error_body or error.reason}"
        ) from error

    if not data.get("ok"):
        raise RuntimeError("Config response missing ok=true.")

    return data


def fetch_commands(supabase_url, supabase_key):
    state = load_state()
    device_id = state.get("device_id")
    device_token = state.get("device_token")
    if not device_id or not device_token:
        raise RuntimeError("Device not paired. Run 'pair' first.")

    query = urllib.parse.urlencode(
        {
            "device_id": device_id,
            "device_token": device_token,
        }
    )
    endpoint = f"{supabase_url}/functions/v1/player-commands?{query}"
    request = urllib.request.Request(
        endpoint,
        headers={
            "Authorization": f"Bearer {supabase_key}",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(request) as response:
            body = response.read().decode("utf-8")
            data = json.loads(body)
    except urllib.error.HTTPError as error:
        error_body = error.read().decode("utf-8") if error.fp else ""
        raise RuntimeError(
            f"Command poll failed (HTTP {error.code}): {error_body or error.reason}"
        ) from error

    commands = data.get("commands", [])
    if not isinstance(commands, list):
        return []
    return commands


def update_kiosk_config(desired_url):
    os.makedirs(os.path.dirname(KIOSK_CONFIG_PATH), exist_ok=True)
    target_url = desired_url or DEFAULT_KIOSK_URL
    existing_url = None
    if os.path.exists(KIOSK_CONFIG_PATH):
        with open(KIOSK_CONFIG_PATH, "r", encoding="utf-8") as handle:
            for line in handle.readlines():
                if line.startswith("KIOSK_URL="):
                    existing_url = line.split("=", 1)[1].strip()
                    break

    if existing_url == target_url:
        return False

    with open(KIOSK_CONFIG_PATH, "w", encoding="utf-8") as handle:
        handle.write(f"KIOSK_URL={target_url}\n")
    return True


def restart_kiosk():
    os.system("pkill -f chromium >/dev/null 2>&1 || true")


def heartbeat_loop(supabase_url, supabase_key, interval_seconds):
    while True:
        send_heartbeat(supabase_url, supabase_key)
        config = fetch_player_config(supabase_url, supabase_key)
        changed = update_kiosk_config(config.get("desired_url"))
        commands = fetch_commands(supabase_url, supabase_key)
        if changed:
            restart_kiosk()
            print("Kiosk URL updated; Chromium restarting.")
        if commands:
            command_ids = [command.get("id") for command in commands]
            print(f"Received commands: {command_ids}")
        else:
            print("Heartbeat sent.")
        time.sleep(interval_seconds)


def show_state():
    state = load_state()
    if not state:
        print("No state found. Run 'init' or 'pair' first.")
        return
    print(json.dumps(state, indent=2, sort_keys=True))


def init_device():
    state = load_state()
    device_id = ensure_device_id(state)
    print(f"device_id: {device_id}")


def main():
    parser = argparse.ArgumentParser(description="FacilityOS Player Agent")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("init", help="Generate and persist device_id")
    subparsers.add_parser("show", help="Show current device state")
    subparsers.add_parser("heartbeat", help="Send a heartbeat")
    subparsers.add_parser("sync-url", help="Fetch and apply desired URL")
    loop_parser = subparsers.add_parser("heartbeat-loop", help="Send heartbeats on an interval")
    loop_parser.add_argument(
        "--interval",
        type=int,
        default=25,
        help="Heartbeat interval in seconds (default: 25)",
    )

    pair_parser = subparsers.add_parser("pair", help="Pair device with a code")
    pair_parser.add_argument("code", help="Pairing code from admin UI")
    pair_parser.add_argument("--url", help="Supabase URL (defaults to SUPABASE_URL)")
    pair_parser.add_argument("--key", help="Supabase anon key (defaults to SUPABASE_ANON_KEY)")

    args = parser.parse_args()

    try:
        if args.command == "init":
            init_device()
        elif args.command == "show":
            show_state()
        elif args.command == "heartbeat":
            url = resolve_supabase_url(None)
            key = resolve_supabase_key(None)
            send_heartbeat(url, key)
            print("Heartbeat sent.")
        elif args.command == "sync-url":
            url = resolve_supabase_url(None)
            key = resolve_supabase_key(None)
            config = fetch_player_config(url, key)
            changed = update_kiosk_config(config.get("desired_url"))
            if changed:
                restart_kiosk()
                print("Kiosk URL updated; Chromium restarting.")
            else:
                print("Kiosk URL already up to date.")
        elif args.command == "heartbeat-loop":
            url = resolve_supabase_url(None)
            key = resolve_supabase_key(None)
            heartbeat_loop(url, key, args.interval)
        elif args.command == "pair":
            url = resolve_supabase_url(args.url)
            key = resolve_supabase_key(args.key)
            state = pair_device(args.code, url, key)
            print("Paired successfully.")
            print(f"player_id: {state.get('player_id')}")
        else:
            parser.print_help()
            return 1
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
