"""
PANDU Memory System
Stores persistent facts about the user so PANDU can personalize responses.
Examples: preferred reminder time, name, location, work schedule, etc.
"""

from supabase import Client
from modules.supabase_client import supabase
from datetime import datetime


async def get_memory_context(user_id: str, db_client: Client | None = None) -> str:
    """
    Fetches all stored memories for a user and formats them as a readable context string.
    This gets injected into the AI system prompt so PANDU knows the user.
    """
    try:
        client = db_client or supabase
        if client is None:
            raise RuntimeError("Supabase is not configured.")
        result = client.table("memory") \
            .select("key, value") \
            .eq("user_id", user_id) \
            .execute()

        if not result.data:
            return "No memories yet. Learn about the user as the conversation progresses."

        memories = []
        for row in result.data:
            memories.append(f"- {row['key']}: {row['value']}")

        return "\n".join(memories)

    except Exception:
        raise


async def save_memory(
    user_id: str, key: str, value: str, db_client: Client | None = None
) -> bool:
    """
    Saves or updates a memory. Uses upsert so duplicates don't pile up.
    Example: save_memory(user_id, "preferred_reminder_time", "19:00")
    """
    try:
        # Check if this key already exists
        client = db_client or supabase
        if client is None:
            raise RuntimeError("Supabase is not configured.")
        existing = client.table("memory") \
            .select("id") \
            .eq("user_id", user_id) \
            .eq("key", key) \
            .execute()

        if existing.data:
            # Update existing memory
            client.table("memory") \
                .update({"value": value, "updated_at": datetime.utcnow().isoformat()}) \
                .eq("user_id", user_id) \
                .eq("key", key) \
                .execute()
        else:
            # Insert new memory
            client.table("memory").insert({
                "user_id": user_id,
                "key": key,
                "value": value,
                "updated_at": datetime.utcnow().isoformat()
            }).execute()

        return True
    except Exception:
        raise


async def auto_extract_memories(user_id: str, user_message: str, ai_response: str):
    """
    Automatically extract facts from conversation and save them.
    Called after each chat exchange.
    Example: if user says "my name is Priya", save memory key="user_name" value="Priya"
    """
    # Simple rule-based extraction (no extra AI call needed)
    msg_lower = user_message.lower()

    if "my name is " in msg_lower:
        name = user_message.split("my name is ", 1)[1].split()[0].strip(".,!")
        await save_memory(user_id, "user_name", name)

    if "remind me" in msg_lower and "at " in msg_lower:
        import re
        time_match = re.search(r'at (\d{1,2}(?::\d{2})?\s*(?:am|pm)?)', msg_lower)
        if time_match:
            await save_memory(user_id, "preferred_reminder_time", time_match.group(1))

    if "i'm from " in msg_lower or "i live in " in msg_lower:
        for phrase in ["i'm from ", "i live in "]:
            if phrase in msg_lower:
                location = msg_lower.split(phrase, 1)[1].split(".")[0].strip()
                await save_memory(user_id, "user_location", location)
