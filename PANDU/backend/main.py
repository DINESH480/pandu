"""
PANDU Backend - FastAPI Server
This is the central brain of PANDU. It receives messages from the frontend,
talks to Ollama (local AI), executes Windows agent actions, and stores
everything in Supabase.
"""

from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from pathlib import Path
from typing import Optional
import httpx
import json
import os
from datetime import datetime
from dotenv import load_dotenv
from starlette.concurrency import run_in_threadpool

# Import our modules
from modules.supabase_client import AuthenticatedUser, get_authenticated_user, supabase
from modules.agent import execute_action
from modules.memory import get_memory_context, save_memory
from modules.ai_router import ask_ai, parse_ai_response
from modules.transcription import transcribe_audio

load_dotenv()

app = FastAPI(title="PANDU API", version="1.0.0")

# ── CORS: allows React frontend (localhost:5173 or your deployed URL) to talk to this backend ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",         # React dev server
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", "*"),  # Your deployed frontend URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────
# REQUEST / RESPONSE MODELS
# ──────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    user_id: str
    session_id: Optional[str] = None
    use_voice: bool = False

class ChatResponse(BaseModel):
    response: str
    action_taken: Optional[str] = None
    action_result: Optional[str] = None
    session_id: str

class ReminderRequest(BaseModel):
    user_id: str
    text: str
    remind_at: str   # ISO datetime string e.g. "2024-01-15T19:00:00"

class MemoryRequest(BaseModel):
    user_id: str
    key: str
    value: str

# ──────────────────────────────────────────────────────────
# HEALTH CHECK
# ──────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "PANDU is running", "version": "1.0.0"}

@app.get("/health")
async def health():
    """Check if Ollama is running locally"""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get("http://localhost:11434/api/tags")
            ollama_ok = r.status_code == 200
    except:
        ollama_ok = False

    return {
        "backend": "ok",
        "ollama": "ok" if ollama_ok else "not running (start Ollama on your PC)",
        "supabase": "configured" if os.getenv("SUPABASE_URL") else "not configured"
    }


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    if file.content_type and not file.content_type.startswith("audio/"):
        raise HTTPException(status_code=415, detail="Upload an audio recording.")

    audio = await file.read(25 * 1024 * 1024 + 1)
    await file.close()
    if not audio:
        raise HTTPException(status_code=400, detail="The audio recording is empty.")
    if len(audio) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio recordings must be 25 MB or smaller.")

    try:
        text = await run_in_threadpool(
            transcribe_audio,
            audio,
            Path(file.filename or "").suffix.lower(),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Transcription failed. Check the backend logs and Whisper model setup.",
        ) from exc

    return {"text": text}

# ──────────────────────────────────────────────────────────
# MAIN CHAT ENDPOINT
# This is the core: receive message → get AI response → maybe execute action → save to DB
# ──────────────────────────────────────────────────────────

@app.post("/chat", response_model=ChatResponse)
async def chat(
    req: ChatRequest,
    current_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    try:
        ensure_user_access(req.user_id, current_user)
        db_client = current_user.client
        session_id = req.session_id or f"session_{int(datetime.now().timestamp() * 1000)}"

        # 1. Get recent conversation history + user memories (so AI has context)
        memory_context = await get_memory_context(req.user_id, db_client)

        response_style = (
            "Use brief, natural spoken language. Avoid markdown, lists, and symbols "
            "that sound awkward when read aloud."
            if req.use_voice
            else "Use clear, concise formatting suitable for a chat conversation."
        )

        # 2. Build the full prompt for the AI
        system_prompt = f"""You are PANDU, the user's dedicated private AI assistant.
Your personality is calm, friendly, helpful, and occasionally lightly witty. You run on the
user's computer and can take real actions.

IMPORTANT: When the user asks you to DO something (open an app, set a reminder, search the web,
manage files, get system info), you MUST respond with a JSON action block like this:

{{"action": "open_app", "app": "vs code"}}
{{"action": "set_reminder", "text": "study Python", "time": "19:00"}}
{{"action": "search_web", "query": "weather today"}}
{{"action": "get_system_info"}}
{{"action": "list_files", "path": "C:/Users/YourName/Desktop"}}
{{"action": "answer", "text": "Your conversational reply here"}}

Only use action JSON when taking an action. For normal conversation, use:
{{"action": "answer", "text": "Your reply here"}}

WHAT YOU KNOW ABOUT THIS USER:
{memory_context}

Be calm, friendly, concise, and clear. {response_style}
Never claim an action succeeded unless its result confirms it.
"""

        # 3. Fetch recent chat history from Supabase for context
        history = await get_recent_history(db_client, req.user_id, session_id, limit=10)

        # 4. Ask PANDU's configured local or self-hosted model.
        ai_raw = await ask_ai(
            user_message=req.message,
            system_prompt=system_prompt,
            history=history
        )

        # 5. Parse AI response — is it an action or a plain answer?
        parsed = parse_ai_response(ai_raw)
        action_taken = None
        action_result = None
        final_response = ""

        if parsed["action"] == "answer":
            final_response = parsed.get("text", ai_raw)

        else:
            # Execute the agent action (open app, reminder, etc.)
            action_taken = parsed["action"]
            parsed["user_id"] = req.user_id
            action_result = await execute_action(parsed, db_client)

            # Ask AI to give a natural language confirmation
            confirmation_prompt = f"""The user said: "{req.message}"
You took this action: {action_taken} with result: {action_result}
Now give a SHORT, friendly voice response confirming what you did. One or two sentences max.
Respond as plain text only, no JSON."""

            final_response = await ask_ai(
                user_message=confirmation_prompt,
                system_prompt="You are PANDU. Give a brief, warm confirmation of the action you just took.",
                history=[]
            )

        # 6. Save the conversation to Supabase
        await save_conversation(
            user_id=req.user_id,
            session_id=session_id,
            user_message=req.message,
            ai_response=final_response,
            action_taken=action_taken,
            db_client=db_client,
        )

        return ChatResponse(
            response=final_response,
            action_taken=action_taken,
            action_result=action_result,
            session_id=session_id
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────
# CONVERSATION HISTORY
# ──────────────────────────────────────────────────────────

@app.get("/conversations/{user_id}")
async def get_conversations(
    user_id: str,
    limit: int = 50,
    current_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """Get all past conversations for a user"""
    ensure_user_access(user_id, current_user)
    try:
        result = current_user.client.table("conversations") \
            .select("*") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
        return {"conversations": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sessions/{user_id}")
async def get_sessions(
    user_id: str,
    current_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    """Get all chat sessions for a user"""
    ensure_user_access(user_id, current_user)
    try:
        result = current_user.client.table("conversations") \
            .select("session_id, created_at") \
            .eq("user_id", user_id) \
            .order("created_at", desc=True) \
            .execute()

        # Deduplicate sessions
        seen = set()
        sessions = []
        for row in result.data:
            if row["session_id"] not in seen:
                seen.add(row["session_id"])
                sessions.append(row)
        return {"sessions": sessions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────
# REMINDERS
# ──────────────────────────────────────────────────────────

@app.post("/reminders")
async def create_reminder(
    req: ReminderRequest,
    current_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    ensure_user_access(req.user_id, current_user)
    try:
        result = current_user.client.table("reminders").insert({
            "user_id": req.user_id,
            "text": req.text,
            "remind_at": req.remind_at,
            "done": False
        }).execute()
        return {"reminder": result.data[0], "message": "Reminder saved!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/reminders/{user_id}")
async def get_reminders(
    user_id: str,
    current_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    ensure_user_access(user_id, current_user)
    try:
        result = current_user.client.table("reminders") \
            .select("*") \
            .eq("user_id", user_id) \
            .eq("done", False) \
            .order("remind_at") \
            .execute()
        return {"reminders": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/reminders/{reminder_id}/done")
async def mark_reminder_done(
    reminder_id: int,
    current_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    if supabase is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured.")
    try:
        current_user.client.table("reminders").update({"done": True}).eq("id", reminder_id).execute()
        return {"message": "Reminder marked as done"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────
# MEMORY (things PANDU remembers about you)
# ──────────────────────────────────────────────────────────

@app.post("/memory")
async def save_user_memory(
    req: MemoryRequest,
    current_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    ensure_user_access(req.user_id, current_user)
    try:
        await save_memory(req.user_id, req.key, req.value, current_user.client)
        return {"message": "Memory saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/memory/{user_id}")
async def get_user_memory(
    user_id: str,
    current_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    ensure_user_access(user_id, current_user)
    try:
        result = current_user.client.table("memory") \
            .select("*") \
            .eq("user_id", user_id) \
            .execute()
        return {"memory": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ──────────────────────────────────────────────────────────
# SYSTEM INFO (for PANDU to report PC status)
# ──────────────────────────────────────────────────────────

@app.get("/system/info")
async def get_system_info(
    current_user: AuthenticatedUser = Depends(get_authenticated_user),
):
    try:
        import psutil
        return {
            "cpu_percent": psutil.cpu_percent(interval=1),
            "ram_percent": psutil.virtual_memory().percent,
            "ram_total_gb": round(psutil.virtual_memory().total / (1024**3), 1),
            "ram_used_gb": round(psutil.virtual_memory().used / (1024**3), 1),
            "disk_percent": psutil.disk_usage('/').percent,
        }
    except ImportError:
        return {"error": "psutil not installed. Run: pip install psutil"}


# ──────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ──────────────────────────────────────────────────────────

async def get_recent_history(db_client, user_id: str, session_id: str, limit: int = 10):
    """Fetch recent messages from this session to give the AI conversation context"""
    try:
        result = db_client.table("conversations") \
            .select("user_message, ai_response") \
            .eq("user_id", user_id) \
            .eq("session_id", session_id) \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()

        history = []
        for row in reversed(result.data):
            history.append({"role": "user", "content": row["user_message"]})
            history.append({"role": "assistant", "content": row["ai_response"]})
        return history
    except Exception as error:
        raise HTTPException(status_code=500, detail="Could not load conversation history.") from error


async def save_conversation(
    user_id, session_id, user_message, ai_response, action_taken=None, db_client=None
):
    """Save a message exchange to Supabase"""
    try:
        if db_client is None:
            raise RuntimeError("An authenticated database client is required.")
        db_client.table("conversations").insert({
            "user_id": user_id,
            "session_id": session_id,
            "user_message": user_message,
            "ai_response": ai_response,
            "action_taken": action_taken,
            "created_at": datetime.utcnow().isoformat()
        }).execute()
    except Exception as error:
        raise HTTPException(status_code=500, detail="Could not save conversation.") from error


def ensure_user_access(user_id: str, current_user: AuthenticatedUser) -> None:
    if user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="You can only access your own account data.")
