# PANDU — Personal AI Assistant

A local-first personal AI assistant with a web chat interface, persistent memory, and the ability to take real actions on your PC.

## Architecture (local-first)

```
┌─────────────────┐      ┌──────────────────┐      ┌──────────────┐
│  React Frontend  │ ───▶ │  FastAPI Backend  │ ───▶ │   Supabase   │
│  (local browser) │ ◀─── │  (localhost)      │ ◀─── │ (DB + Auth)  │
└─────────────────┘      └──────────────────┘      └──────────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  Local Ollama AI  │
                          │  localhost:11434  │
                          └──────────────────┘
```

Chat and model inference run locally through Ollama by default. Supabase remains the
optional hosted authentication and database service for the existing UI and persistence.
An optional endpoint that you control can be enabled with `AI_MODE=remote`; if that
endpoint is unavailable, PANDU falls back to local Ollama.

---

## Part 1 — Set up Supabase (your database)

1. Go to [supabase.com](https://supabase.com) → sign up free → **New project**.
2. Pick a name (e.g. `pandu`), a database password (save it somewhere), and a region close to you.
3. Wait ~2 minutes for the project to finish provisioning.
4. Open **SQL Editor** (left sidebar) → **New query**.
5. Open `backend/supabase_schema.sql` from this project, copy all of it, paste into the editor, click **Run**.
   This creates three tables — `conversations`, `reminders`, `memory` — with row-level security so each user only sees their own data.
6. Go to **Settings → API**. Copy two values, you'll need them twice (frontend and backend):
   - **Project URL** → looks like `https://xxxxx.supabase.co`
   - **anon public** key → a long string

That's your entire database, done — no server to manage.

---

## Part 2 — Install and run local Ollama

Install Ollama for Windows, then pull a model and start its local server:

```powershell
ollama pull gemma3
ollama serve
```

Ollama normally listens at `http://localhost:11434`.

---

## Part 3 — Run the backend locally

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt

copy .env.example .env       # Windows
# cp .env.example .env       # Mac/Linux
```

Edit `.env`:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
AI_MODE=local
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:latest
WHISPER_MODEL_SIZE=base
FRONTEND_URL=http://localhost:5173
```

The first microphone recording downloads the configured Whisper model if it is not already cached. Transcription runs locally on the backend; recordings are removed after processing. Microphone access requires localhost or a secure (HTTPS) frontend.

Run it:
```bash
uvicorn main:app --reload
```

Visit `http://localhost:8000/health` — you should see `{"backend": "ok", ...}`.

---

## Part 4 — Run the frontend locally

```bash
cd frontend
npm install
copy .env.example .env.local   # Windows
# cp .env.example .env.local   # Mac/Linux
```

Edit `.env.local`:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:8000
```

Run it:
```bash
npm run dev
```

Visit `http://localhost:5173` — sign up with an email + password, and start chatting with PANDU. Try: *"What's my system status?"* or *"Remind me to study at 7 PM"*.

---

## Optional self-hosted model endpoint

To prefer a model endpoint that you control, configure these in `backend/.env`:

```env
AI_MODE=remote
SELF_HOSTED_API_URL=http://your-controlled-server:port/v1/chat/completions
SELF_HOSTED_MODEL=your-model-name
SELF_HOSTED_API_KEY=
```

The endpoint must accept chat-completions-compatible requests. Connection errors,
timeouts, and server errors silently fall back to local Ollama. Local Ollama remains
the default and is used directly when `AI_MODE=local`.

---

## Chat and voice modes

PANDU supports text chat and an optional Voice mode. In Voice mode, use the microphone
button to record a message; the backend transcribes it with local Whisper, sends it to the
same chat assistant, and the browser reads PANDU's reply aloud using its available speech
voices. In Chat mode, microphone recordings are transcribed into the text box so you can
review or edit them before sending. Microphone access requires localhost or a secure
(HTTPS) frontend. Speech output uses the browser/operating-system voice and is not Piper.

---

## Project structure

```
PANDU/
├── backend/
│   ├── main.py                  FastAPI app + all routes
│   ├── modules/
│   │   ├── ai_router.py         Local Ollama / optional self-hosted endpoint
│   │   ├── agent.py             Windows actions (open app, files, etc.)
│   │   ├── memory.py            Persistent user memory
│   │   └── supabase_client.py   Database connection
│   ├── supabase_schema.sql      Run this in Supabase SQL editor
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/                LoginPage, ChatPage
│   │   ├── components/           MessageList, ChatInput, Sidebar
│   │   ├── utils/                supabase.js, api.js
│   │   └── index.css
│   ├── package.json
│   └── .env.example
└── README.md
```

## What's already working in this codebase

- Email/password auth via Supabase
- Chat interface with conversation history persisted per user
- AI uses Ollama locally by default, with an optional self-hosted endpoint
- PANDU can take actions: open whitelisted apps, set reminders, check system info, search the web, list/create files — all with safety whitelisting
- Persistent memory — PANDU remembers facts about you across sessions
- Local Whisper speech-to-text and browser-based spoken responses in Voice mode
- Responsive, mobile-friendly UI

## What to build next (from your original 33-step plan)

- Piper for a female TTS voice (Step 14)
- "Hey PANDU" wake-word detection (Step 21)
- Playwright browser automation (Step 17)
- Tauri desktop packaging → `PANDU.exe` (Steps 24–25)
