#!/usr/bin/env python3
import argparse
import json
import os
import random
import socket
import string
import sys
import threading
import time
import subprocess
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
try:
    from zoneinfo import ZoneInfo
except ImportError:
    ZoneInfo = None
import uuid
import urllib.request
import urllib.parse
import urllib.error
import shutil

STATE_PATH = os.path.expanduser("~/.facilityos/player-agent.json")
KIOSK_CONFIG_PATH = os.path.expanduser("~/.facilityos/kiosk.conf")
DEFAULT_KIOSK_URL = "https://facilityos.co.uk/kiosk/unpaired"
BLANK_SCREEN_PATH = "/kiosk/blank"
PAIRING_POLL_INTERVAL = 5
PAIRING_STATUS_PORT = 38473
SCHEDULE_TOLERANCE_SECONDS = 120
COMMAND_POLL_SECONDS = 1
CEC_DEVICE = os.environ.get("CEC_DEVICE", "/dev/cec0")
_LAST_CPU_SAMPLE = None


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


def ensure_device_secret(state):
    secret = state.get("device_secret")
    if secret:
        return secret
    alphabet = string.ascii_letters + string.digits
    secret = "".join(random.choice(alphabet) for _ in range(32))
    state["device_secret"] = secret
    save_state(state)
    return secret


def generate_pairing_code():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(alphabet) for _ in range(8))


def format_pairing_code(code):
    return f"{code[:3]}-{code[3:6]}-{code[6:]}"


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


def _read_uptime_seconds():
    try:
        with open("/proc/uptime", "r", encoding="utf-8") as handle:
            value = handle.read().strip().split()[0]
        return float(value)
    except Exception:
        return None


def _read_cpu_percent():
    global _LAST_CPU_SAMPLE
    try:
        with open("/proc/stat", "r", encoding="utf-8") as handle:
            first_line = handle.readline().strip()
        parts = first_line.split()
        if len(parts) < 8 or parts[0] != "cpu":
            return None
        fields = [int(value) for value in parts[1:]]
        idle = fields[3] + fields[4]
        total = sum(fields)
        if _LAST_CPU_SAMPLE is None:
            _LAST_CPU_SAMPLE = (total, idle)
            return None
        previous_total, previous_idle = _LAST_CPU_SAMPLE
        total_delta = total - previous_total
        idle_delta = idle - previous_idle
        _LAST_CPU_SAMPLE = (total, idle)
        if total_delta <= 0:
            return None
        used_delta = total_delta - idle_delta
        return round(max(0.0, min(100.0, (used_delta / total_delta) * 100.0)), 1)
    except Exception:
        return None


def _read_temperature_c():
    try:
        if shutil.which("vcgencmd"):
            result = subprocess.run(
                ["vcgencmd", "measure_temp"],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode == 0 and result.stdout:
                # Example: temp=52.8'C
                temp_value = result.stdout.strip().split("=")[1].split("'")[0]
                return round(float(temp_value), 1)
    except Exception:
        pass

    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r", encoding="utf-8") as handle:
            raw_value = handle.read().strip()
        return round(float(raw_value) / 1000.0, 1)
    except Exception:
        return None


def _read_memory_stats():
    try:
        values = {}
        with open("/proc/meminfo", "r", encoding="utf-8") as handle:
            for line in handle:
                if ":" not in line:
                    continue
                key, raw = line.split(":", 1)
                number = raw.strip().split()[0]
                values[key] = int(number)  # kB
        total_kb = values.get("MemTotal")
        available_kb = values.get("MemAvailable")
        if not total_kb or available_kb is None:
            return None, None, None
        used_kb = total_kb - available_kb
        used_mb = round(used_kb / 1024.0, 1)
        total_mb = round(total_kb / 1024.0, 1)
        percent = round((used_kb / total_kb) * 100.0, 1) if total_kb > 0 else None
        return used_mb, total_mb, percent
    except Exception:
        return None, None, None


def _read_chromium_status():
    try:
        result = subprocess.run(
            ["pgrep", "-f", "chromium"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            pids = [line.strip() for line in result.stdout.splitlines() if line.strip()]
            return True, len(pids)
        return False, 0
    except Exception:
        return False, 0


def collect_device_metrics():
    used_mb, total_mb, memory_percent = _read_memory_stats()
    chromium_running, chromium_pid_count = _read_chromium_status()
    metrics = {
        "hostname": socket.gethostname(),
        "uptime_seconds": _read_uptime_seconds(),
        "cpu_percent": _read_cpu_percent(),
        "temp_c": _read_temperature_c(),
        "memory_used_mb": used_mb,
        "memory_total_mb": total_mb,
        "memory_percent": memory_percent,
        "chromium_running": chromium_running,
        "chromium_pid_count": chromium_pid_count,
    }
    return {key: value for key, value in metrics.items() if value is not None}


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
        "meta": collect_device_metrics(),
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


def ack_command(supabase_url, supabase_key, command_id, status, error_text=None):
    state = load_state()
    device_id = state.get("device_id")
    device_token = state.get("device_token")
    payload = {
        "command_id": command_id,
        "device_id": device_id,
        "device_token": device_token,
        "status": status,
        "error": error_text,
    }

    endpoint = f"{supabase_url}/functions/v1/player-command-ack"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(request) as response:
        body = response.read().decode("utf-8")
        return json.loads(body)


def log_message(supabase_url, supabase_key, level, message, meta=None):
    state = load_state()
    device_id = state.get("device_id")
    device_token = state.get("device_token")
    payload = {
        "device_id": device_id,
        "device_token": device_token,
        "level": level,
        "message": message,
        "meta": meta or {},
    }

    endpoint = f"{supabase_url}/functions/v1/player-logs"
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(request):
        return


def _normalize_url(url):
    """Normalize URL for comparison (strip quotes, whitespace)."""
    if not url or not isinstance(url, str):
        return ""
    return url.strip().strip('"\'')


def update_kiosk_config(desired_url):
    os.makedirs(os.path.dirname(KIOSK_CONFIG_PATH), exist_ok=True)
    target_url = _normalize_url(desired_url or DEFAULT_KIOSK_URL)
    existing_url = ""
    if os.path.exists(KIOSK_CONFIG_PATH):
        with open(KIOSK_CONFIG_PATH, "r", encoding="utf-8") as handle:
            for line in handle.readlines():
                if line.startswith("KIOSK_URL="):
                    existing_url = _normalize_url(line.split("=", 1)[1])
                    break

    if existing_url == target_url:
        return False

    url_value = desired_url or DEFAULT_KIOSK_URL
    with open(KIOSK_CONFIG_PATH, "w", encoding="utf-8") as handle:
        handle.write(f'KIOSK_URL="{url_value}"\n')
    return True


def restart_kiosk():
    os.system("pkill -f chromium >/dev/null 2>&1 || true")


def execute_cec_command(power_state):
    if not shutil.which("cec-client"):
        raise RuntimeError("cec-client not installed")

    if power_state not in {"on", "off"}:
        raise RuntimeError(f"Unknown power state: {power_state}")

    command = "on 0" if power_state == "on" else "standby 0"
    result = subprocess.run(
        ["cec-client", "-s", CEC_DEVICE],
        input=f"{command}\n",
        text=True,
        capture_output=True,
        check=False,
    )
    output = {
        "returncode": result.returncode,
        "stdout": result.stdout.strip(),
        "stderr": result.stderr.strip(),
    }
    if result.returncode != 0:
        raise RuntimeError(f"cec-client failed: {output}")
    return output



def derive_blank_url(desired_url, schedule):
    if isinstance(schedule, dict):
        schedule_blank = schedule.get("blank_url")
        if isinstance(schedule_blank, str) and schedule_blank.strip():
            return schedule_blank.strip()
    if desired_url:
        parsed = urllib.parse.urlparse(desired_url)
        if parsed.scheme and parsed.netloc:
            return urllib.parse.urlunparse(
                (parsed.scheme, parsed.netloc, BLANK_SCREEN_PATH, "", "", "")
            )
    return "about:blank"


def parse_time_to_minutes(value):
    if not isinstance(value, str):
        return None
    parts = value.strip().split(":")
    if len(parts) < 2:
        return None
    try:
        hours = int(parts[0])
        minutes = int(parts[1])
    except ValueError:
        return None
    if hours < 0 or hours > 23 or minutes < 0 or minutes > 59:
        return None
    return hours * 60 + minutes


def normalize_day(value):
    if isinstance(value, int):
        if 0 <= value <= 6:
            return value
        return None
    if not isinstance(value, str):
        return None
    lookup = {
        "mon": 0,
        "monday": 0,
        "tue": 1,
        "tues": 1,
        "tuesday": 1,
        "wed": 2,
        "wednesday": 2,
        "thu": 3,
        "thurs": 3,
        "thursday": 3,
        "fri": 4,
        "friday": 4,
        "sat": 5,
        "saturday": 5,
        "sun": 6,
        "sunday": 6,
    }
    return lookup.get(value.strip().lower())


def parse_excluded_dates(value):
    if isinstance(value, list):
        return [str(item) for item in value]
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except json.JSONDecodeError:
            return []
    return []


def normalize_time_str(value):
    if not isinstance(value, str):
        return None
    parts = value.split(":")
    if len(parts) < 2:
        return None
    return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}"


def compare_times(time1, time2):
    t1 = normalize_time_str(time1)
    t2 = normalize_time_str(time2)
    if t1 is None or t2 is None:
        return None
    if t1 < t2:
        return -1
    if t1 > t2:
        return 1
    return 0


def does_capacity_schedule_apply(schedule, day_of_week, date_str, time_str):
    start_time = parse_time_to_minutes(schedule.get("start_time"))
    end_time = parse_time_to_minutes(schedule.get("end_time"))
    now_min = parse_time_to_minutes(time_str)
    if start_time is None or end_time is None or now_min is None:
        return False

    tolerance_min = max(0, int(SCHEDULE_TOLERANCE_SECONDS / 60))
    if not within_window(now_min, start_time, end_time, tolerance_min):
        return False

    excluded = parse_excluded_dates(schedule.get("excluded_dates"))
    if date_str in excluded:
        return False

    recurrence_type = schedule.get("recurrence_type")
    schedule_day = schedule.get("day_of_week")
    start_date = schedule.get("start_date")
    end_date = schedule.get("end_date")

    if isinstance(end_date, str) and date_str > end_date:
        return False

    if recurrence_type == "single":
        return schedule_day == day_of_week and start_date == date_str
    if recurrence_type == "weekday":
        return (
            schedule_day == day_of_week
            and 1 <= day_of_week <= 5
            and isinstance(start_date, str)
            and start_date <= date_str
        )
    if recurrence_type == "weekend":
        return (
            schedule_day == day_of_week
            and (day_of_week == 0 or day_of_week == 6)
            and isinstance(start_date, str)
            and start_date <= date_str
        )
    if recurrence_type in {"weekly", "all_future"}:
        return (
            schedule_day == day_of_week
            and isinstance(start_date, str)
            and start_date <= date_str
        )
    return False


def apply_capacity_schedule(capacity_schedules, config, supabase_url, supabase_key):
    now_dt = datetime.now()
    day_of_week = (now_dt.weekday() + 1) % 7
    date_str = now_dt.strftime("%Y-%m-%d")
    time_str = now_dt.strftime("%H:%M")

    applicable = [
        schedule
        for schedule in capacity_schedules
        if isinstance(schedule, dict)
        and does_capacity_schedule_apply(schedule, day_of_week, date_str, time_str)
    ]
    if not applicable:
        return None

    target_state = (
        "off"
        if any(schedule.get("period_type") == "Closed" for schedule in applicable)
        else "on"
    )
    state = load_state()
    if (
        state.get("scheduled_power_state") == target_state
        and state.get("scheduled_source") == "capacity"
    ):
        return target_state

    apply_power_state(
        target_state,
        config.get("desired_url"),
        {},
        supabase_url,
        supabase_key,
        "capacity",
    )
    state["scheduled_power_state"] = target_state
    state["scheduled_source"] = "capacity"
    save_state(state)
    log_message(
        supabase_url,
        supabase_key,
        "info",
        "Capacity schedule applied",
        {"state": target_state},
    )
    return target_state


def parse_power_schedule(schedule):
    if not isinstance(schedule, dict):
        return None, "Schedule must be a JSON object."
    periods = schedule.get("periods")
    if periods is None:
        return None, "Missing 'periods' array."
    if not isinstance(periods, list):
        return None, "'periods' must be an array."

    parsed_periods = []
    for index, period in enumerate(periods):
        if not isinstance(period, dict):
            return None, f"Period {index + 1} must be an object."
        days_value = period.get("days", [])
        if not isinstance(days_value, list) or not days_value:
            return None, f"Period {index + 1} must include 'days' array."
        days = set()
        for day in days_value:
            normalized = normalize_day(day)
            if normalized is None:
                return None, f"Period {index + 1} has invalid day: {day}"
            days.add(normalized)
        start = parse_time_to_minutes(period.get("start"))
        end = parse_time_to_minutes(period.get("end"))
        if start is None or end is None:
            return None, f"Period {index + 1} must include valid start/end times."
        state = period.get("state", "on")
        if state not in {"on", "off"}:
            return None, f"Period {index + 1} has invalid state: {state}"
        parsed_periods.append(
            {
                "days": days,
                "start": start,
                "end": end,
                "state": state,
            }
        )

    default_state = schedule.get("default_state", "off")
    if default_state not in {"on", "off"}:
        return None, f"Invalid default_state: {default_state}"
    return (
        {
            "timezone": schedule.get("timezone"),
            "default_state": default_state,
            "periods": parsed_periods,
        },
        None,
    )


def resolve_schedule_now(timezone_name):
    if timezone_name and ZoneInfo is not None:
        try:
            return datetime.now(tz=ZoneInfo(timezone_name))
        except Exception:
            return datetime.now()
    return datetime.now()


def within_window(now_min, start_min, end_min, tolerance_min):
    if start_min == end_min:
        return True
    start_adj = (start_min - tolerance_min) % 1440
    end_adj = (end_min + tolerance_min) % 1440
    if start_adj <= end_adj:
        return start_adj <= now_min <= end_adj
    return now_min >= start_adj or now_min <= end_adj


def period_matches(now_dt, period, tolerance_min):
    now_min = now_dt.hour * 60 + now_dt.minute
    start = period["start"]
    end = period["end"]
    days = period["days"]
    if end > start:
        if now_dt.weekday() not in days:
            return False
        return within_window(now_min, start, end, tolerance_min)
    if now_min >= start:
        if now_dt.weekday() not in days:
            return False
        return within_window(now_min, start, end, tolerance_min)
    previous_day = (now_dt.weekday() - 1) % 7
    if previous_day not in days:
        return False
    return within_window(now_min, start, end, tolerance_min)


def get_scheduled_power_state(schedule):
    now_dt = resolve_schedule_now(schedule.get("timezone"))
    tolerance_min = max(0, int(SCHEDULE_TOLERANCE_SECONDS / 60))
    for period in schedule["periods"]:
        if period_matches(now_dt, period, tolerance_min):
            return period["state"]
    return schedule["default_state"]


def apply_power_state(
    target_state, desired_url, schedule, supabase_url, supabase_key, source="schedule"
):
    changed = False
    if target_state == "off":
        try:
            execute_cec_command("off")
            log_message(
                supabase_url,
                supabase_key,
                "info",
                "Display powered off via CEC",
                {"source": source},
            )
            return False
        except Exception as exc:
            blank_url = derive_blank_url(desired_url, schedule)
            changed = update_kiosk_config(blank_url)
            if changed:
                restart_kiosk()
            log_message(
                supabase_url,
                supabase_key,
                "warn",
                "CEC unavailable; fallback to blank screen",
                {"source": source, "error": str(exc), "blank_url": blank_url},
            )
            return changed

    try:
        execute_cec_command("on")
    except Exception as exc:
        log_message(
            supabase_url,
            supabase_key,
            "warn",
            "CEC unavailable; ensuring kiosk content is visible",
            {"source": source, "error": str(exc)},
        )

    changed = update_kiosk_config(desired_url)
    if changed:
        restart_kiosk()
    return changed


def execute_command(command, supabase_url=None, supabase_key=None, desired_url=None):
    command_type = command.get("type")
    payload = command.get("payload") or {}
    if command_type == "set_url":
        url = payload.get("url")
        if not url:
            raise RuntimeError("Missing url in payload")
        update_kiosk_config(url)
        restart_kiosk()
        return
    if command_type in {"reload", "restart_kiosk"}:
        restart_kiosk()
        return
    if command_type == "reboot":
        os.system("sudo reboot")
        return
    if command_type == "display_on":
        cec_error = None
        try:
            cec_output = execute_cec_command("on")
            if supabase_url and supabase_key:
                log_message(
                    supabase_url,
                    supabase_key,
                    "info",
                    "CEC display on command sent",
                    {"source": "command", "cec": cec_output},
                )
        except Exception as exc:
            cec_error = exc
            if supabase_url and supabase_key:
                log_message(
                    supabase_url,
                    supabase_key,
                    "warn",
                    "CEC unavailable; attempting to show kiosk content",
                    {"source": "command", "error": str(exc)},
                )
        if desired_url:
            if update_kiosk_config(desired_url):
                restart_kiosk()
        if cec_error:
            raise cec_error
        return
    if command_type == "display_off":
        try:
            cec_output = execute_cec_command("off")
            if supabase_url and supabase_key:
                log_message(
                    supabase_url,
                    supabase_key,
                    "info",
                    "CEC display off command sent",
                    {"source": "command", "cec": cec_output},
                )
            return
        except Exception as exc:
            if supabase_url and supabase_key:
                blank_url = derive_blank_url(desired_url, {})
                if update_kiosk_config(blank_url):
                    restart_kiosk()
                log_message(
                    supabase_url,
                    supabase_key,
                    "warn",
                    "CEC unavailable; fallback to blank screen",
                    {"source": "command", "error": str(exc), "blank_url": blank_url},
                )
                return
            raise
        return
    raise RuntimeError(f"Unknown command type: {command_type}")


def build_unpaired_url(device_id, code):
    base = os.environ.get("KIOSK_APP_BASE", "https://facilityos.co.uk")
    params = urllib.parse.urlencode({"device_id": device_id, "code": code})
    return f"{base.rstrip('/')}/kiosk/unpaired?{params}"


def register_pairing_code(device_id, device_secret, code, supabase_url, supabase_key):
    endpoint = f"{supabase_url}/functions/v1/device-pairing-request"
    payload = {
        "device_id": device_id,
        "device_secret": device_secret,
        "code": code,
    }
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data.get("code", code)


def poll_pairing_complete(device_id, device_secret, supabase_url, supabase_key):
    params = urllib.parse.urlencode({
        "device_id": device_id,
        "device_secret": device_secret,
    })
    endpoint = f"{supabase_url}/functions/v1/pairing-complete?{params}"
    req = urllib.request.Request(endpoint, headers={"Authorization": f"Bearer {supabase_key}"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data


def run_unpaired_mode(supabase_url, supabase_key):
    """Show pairing code on kiosk, poll for admin pairing. Blocks until paired."""
    state = load_state()
    device_id = ensure_device_id(state)
    device_secret = ensure_device_secret(state)
    code = generate_pairing_code()
    formatted = format_pairing_code(code)

    try:
        register_pairing_code(device_id, device_secret, code, supabase_url, supabase_key)
    except Exception as exc:
        print(f"Failed to register pairing code: {exc}", file=sys.stderr)
        formatted = code  # fallback to unformatted

    # Shared state for status server
    pairing_info = {"device_id": device_id, "code": formatted}

    class StatusHandler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def do_GET(self):
            if self.path == "/status":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps(pairing_info).encode())
            else:
                self.send_response(404)
                self.end_headers()

    def run_server():
        server = HTTPServer(("127.0.0.1", PAIRING_STATUS_PORT), StatusHandler)
        server.serve_forever()

    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    unpaired_url = build_unpaired_url(device_id, formatted)
    update_kiosk_config(unpaired_url)
    restart_kiosk()

    while True:
        time.sleep(PAIRING_POLL_INTERVAL)
        try:
            result = poll_pairing_complete(device_id, device_secret, supabase_url, supabase_key)
        except Exception:
            continue
        if result.get("paired") and result.get("device_token") and result.get("player_id"):
            state = load_state()
            state["device_token"] = result["device_token"]
            state["player_id"] = result["player_id"]
            save_state(state)
            return


def apply_schedule(config, supabase_url, supabase_key):
    capacity_schedules = config.get("capacity_schedules")
    if not isinstance(capacity_schedules, list) or not capacity_schedules:
        log_message(
            supabase_url,
            supabase_key,
            "warn",
            "No capacity schedules returned for player",
            {},
        )
        return None
    return apply_capacity_schedule(capacity_schedules, config, supabase_url, supabase_key)


def heartbeat_loop(supabase_url, supabase_key, interval_seconds):
    next_heartbeat = 0
    last_config = {}
    while True:
        now = time.time()
        if now >= next_heartbeat:
            send_heartbeat(supabase_url, supabase_key)
            last_config = fetch_player_config(supabase_url, supabase_key)
            schedule_state = apply_schedule(last_config, supabase_url, supabase_key)
            changed = False
            if schedule_state != "off":
                changed = update_kiosk_config(last_config.get("desired_url"))
            if changed:
                restart_kiosk()
                print("Kiosk URL updated; Chromium restarting.")
            else:
                print("Heartbeat sent.")
            next_heartbeat = now + interval_seconds

        commands = fetch_commands(supabase_url, supabase_key)
        if commands:
            for command in commands:
                command_id = command.get("id")
                try:
                    execute_command(
                        command,
                        supabase_url,
                        supabase_key,
                        last_config.get("desired_url"),
                    )
                    ack_command(supabase_url, supabase_key, command_id, "success")
                    log_message(
                        supabase_url,
                        supabase_key,
                        "info",
                        f"Command {command.get('type')} executed",
                        {"command_id": command_id},
                    )
                except Exception as exc:
                    error_text = str(exc)
                    ack_command(
                        supabase_url, supabase_key, command_id, "fail", error_text
                    )
                    log_message(
                        supabase_url,
                        supabase_key,
                        "error",
                        f"Command {command.get('type')} failed",
                        {"command_id": command_id, "error": error_text},
                    )

        time.sleep(COMMAND_POLL_SECONDS)


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

    run_parser = subparsers.add_parser(
        "run",
        help="Main loop: unpaired mode or heartbeat. Handles 401/revoked by switching to pairing.",
    )
    run_parser.add_argument(
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
        elif args.command == "run":
            url = resolve_supabase_url(None)
            key = resolve_supabase_key(None)
            interval = getattr(args, "interval", 25)
            while True:
                state = load_state()
                if not state.get("device_token"):
                    run_unpaired_mode(url, key)
                    continue
                try:
                    heartbeat_loop(url, key, interval)
                except urllib.error.HTTPError as e:
                    # 401: device revoked/not found; 404: player deleted
                    if e.code in (401, 404):
                        state = load_state()
                        state.pop("device_token", None)
                        state.pop("player_id", None)
                        save_state(state)
                        run_unpaired_mode(url, key)
                        continue
                    raise
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
