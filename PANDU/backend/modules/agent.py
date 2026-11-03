"""
PANDU Windows Agent
This module handles all real-world actions PANDU can take on your Windows PC.
Every action has a whitelist/safety check before executing.

ACTIONS SUPPORTED:
- open_app      → opens a whitelisted application
- set_reminder  → saves a reminder to Supabase
- search_web    → opens browser with a search query
- get_system_info → CPU, RAM, disk usage
- list_files    → lists files in a safe directory
- create_file   → creates a text file in workspace
- answer        → plain text reply (no action taken)
"""

import subprocess
import os
import platform
import json
from datetime import datetime, timedelta
from typing import Dict, Any
from supabase import Client

# ──────────────────────────────────────────────────────────
# SAFE APPS WHITELIST
# Only apps in this list can be opened by PANDU.
# Add your own apps here. Never use user-provided paths.
# ──────────────────────────────────────────────────────────

WINDOWS_SAFE_APPS = {
    "vs code": r"C:\Users\%USERNAME%\AppData\Local\Programs\Microsoft VS Code\Code.exe",
    "vscode": r"C:\Users\%USERNAME%\AppData\Local\Programs\Microsoft VS Code\Code.exe",
    "notepad": "notepad.exe",
    "calculator": "calc.exe",
    "chrome": r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "firefox": r"C:\Program Files\Mozilla Firefox\firefox.exe",
    "explorer": "explorer.exe",
    "task manager": "taskmgr.exe",
    "cmd": "cmd.exe",
    "terminal": "wt.exe",   # Windows Terminal
    "paint": "mspaint.exe",
    "word": r"C:\Program Files\Microsoft Office\root\Office16\WINWORD.EXE",
    "excel": r"C:\Program Files\Microsoft Office\root\Office16\EXCEL.EXE",
    "spotify": r"C:\Users\%USERNAME%\AppData\Roaming\Spotify\Spotify.exe",
    "vlc": r"C:\Program Files\VideoLAN\VLC\vlc.exe",
    "obs": r"C:\Program Files\obs-studio\bin\64bit\obs64.exe",
}

# Where PANDU is allowed to read/write files (safe sandbox)
PANDU_WORKSPACE = os.path.expanduser("~/PANDU_Workspace")

# Actions that require user confirmation before running
DANGEROUS_ACTIONS = ["delete_file", "shutdown", "restart"]


async def execute_action(
    parsed: Dict[str, Any], db_client: Client | None = None
) -> str:
    """
    Main dispatcher — receives parsed action dict from AI and routes to the right function.
    Example: {"action": "open_app", "app": "vs code"} → calls open_app("vs code")
    """
    action = parsed.get("action", "answer")

    # Safety: refuse dangerous actions without explicit confirmation
    if action in DANGEROUS_ACTIONS:
        confirmed = parsed.get("confirmed", False)
        if not confirmed:
            return f"⚠️ This action ({action}) requires confirmation. Please confirm."

    try:
        if action == "open_app":
            return open_app(parsed.get("app", ""))

        elif action == "set_reminder":
            return await set_reminder_action(parsed, db_client)

        elif action == "search_web":
            return search_web(parsed.get("query", ""))

        elif action == "get_system_info":
            return get_system_info()

        elif action == "list_files":
            return list_files(parsed.get("path", PANDU_WORKSPACE))

        elif action == "create_file":
            return create_file(
                parsed.get("filename", "note.txt"),
                parsed.get("content", "")
            )

        elif action == "get_time":
            return f"Current time: {datetime.now().strftime('%I:%M %p, %A %B %d, %Y')}"

        elif action == "answer":
            return parsed.get("text", "")

        else:
            return f"Unknown action: {action}"

    except Exception as e:
        return f"Action failed: {str(e)}"


def open_app(app_name: str) -> str:
    """
    Opens a whitelisted application on Windows.
    Raises an error if the app is not in the safe list.
    """
    app_key = app_name.lower().strip()

    if app_key not in WINDOWS_SAFE_APPS:
        available = ", ".join(WINDOWS_SAFE_APPS.keys())
        return f"'{app_name}' is not in PANDU's safe app list. Available: {available}"

    app_path = os.path.expandvars(WINDOWS_SAFE_APPS[app_key])

    if platform.system() == "Windows":
        try:
            subprocess.Popen([app_path], shell=True)
            return f"✅ Opened {app_name}"
        except Exception as e:
            return f"Could not open {app_name}: {e}"
    else:
        # On non-Windows (for testing on Linux/Mac)
        return f"✅ [SIMULATED] Would open {app_name} on Windows (path: {app_path})"


async def set_reminder_action(parsed: Dict, db_client: Client | None = None) -> str:
    """
    Saves a reminder to Supabase.
    Time format: "19:00" or "tomorrow at 3pm" or ISO datetime
    """
    from modules.supabase_client import supabase

    text = parsed.get("text", "Reminder")
    time_str = parsed.get("time", "")
    user_id = parsed.get("user_id", "default")

    # Parse the time string into a datetime
    remind_at = parse_reminder_time(time_str)

    client = db_client or supabase
    if client is None:
        raise RuntimeError("Supabase is not configured.")
    client.table("reminders").insert({
        "user_id": user_id,
        "text": text,
        "remind_at": remind_at.isoformat(),
        "done": False
    }).execute()

    time_display = remind_at.strftime("%I:%M %p on %B %d")
    return f"✅ Reminder set: '{text}' at {time_display}"


def parse_reminder_time(time_str: str) -> datetime:
    """Simple time parser — handles 'HH:MM' and 'tomorrow at HH:MM'"""
    now = datetime.now()

    if not time_str:
        return now + timedelta(hours=1)

    # Handle "19:00" or "7:00 PM" format
    time_str_lower = time_str.lower().strip()

    if "tomorrow" in time_str_lower:
        base = now + timedelta(days=1)
    else:
        base = now

    # Try to extract time
    import re
    time_match = re.search(r'(\d{1,2}):?(\d{2})?\s*(am|pm)?', time_str_lower)
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2) or 0)
        period = time_match.group(3)

        if period == "pm" and hour != 12:
            hour += 12
        elif period == "am" and hour == 12:
            hour = 0

        return base.replace(hour=hour, minute=minute, second=0, microsecond=0)

    # Fallback: 1 hour from now
    return now + timedelta(hours=1)


def search_web(query: str) -> str:
    """Opens the default browser with a Google search"""
    if not query:
        return "No search query provided"

    import urllib.parse
    encoded = urllib.parse.quote(query)
    url = f"https://www.google.com/search?q={encoded}"

    if platform.system() == "Windows":
        os.startfile(url)
    else:
        subprocess.Popen(["xdg-open", url])

    return f"✅ Searching for '{query}' in browser"


def get_system_info() -> str:
    """Returns CPU, RAM, and disk usage"""
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=1)
        ram = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        return (
            f"💻 System Status:\n"
            f"CPU: {cpu}%\n"
            f"RAM: {ram.percent}% used ({ram.used // (1024**3)}GB / {ram.total // (1024**3)}GB)\n"
            f"Disk: {disk.percent}% used ({disk.used // (1024**3)}GB / {disk.total // (1024**3)}GB)"
        )
    except ImportError:
        return "Install psutil: pip install psutil"


def list_files(path: str) -> str:
    """
    Lists files in a directory.
    SAFETY: Only allows listing within PANDU_WORKSPACE or user's home directory.
    """
    # Resolve the path and check it's safe
    resolved = os.path.realpath(os.path.expanduser(path))
    home = os.path.realpath(os.path.expanduser("~"))
    workspace = os.path.realpath(PANDU_WORKSPACE)

    # Only allow access within home directory
    if not resolved.startswith(home):
        return f"❌ Safety check: PANDU can only access files within your home directory."

    if not os.path.exists(resolved):
        return f"Directory not found: {path}"

    try:
        items = os.listdir(resolved)
        files = [f for f in items if os.path.isfile(os.path.join(resolved, f))]
        dirs = [f for f in items if os.path.isdir(os.path.join(resolved, f))]

        result = f"📁 {resolved}\n"
        result += f"Folders: {', '.join(dirs[:10]) if dirs else 'none'}\n"
        result += f"Files: {', '.join(files[:20]) if files else 'none'}"
        return result
    except PermissionError:
        return f"❌ Permission denied: {path}"


def create_file(filename: str, content: str) -> str:
    """
    Creates a text file in PANDU_WORKSPACE.
    Safety: Only creates files within the workspace folder.
    """
    # Ensure workspace exists
    os.makedirs(PANDU_WORKSPACE, exist_ok=True)

    # Strip any path traversal attempts
    safe_filename = os.path.basename(filename)
    if not safe_filename.endswith(('.txt', '.md', '.py', '.js', '.json', '.csv')):
        safe_filename += '.txt'

    file_path = os.path.join(PANDU_WORKSPACE, safe_filename)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    return f"✅ Created file: {file_path}"
