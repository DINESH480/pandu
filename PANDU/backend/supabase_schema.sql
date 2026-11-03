-- ═══════════════════════════════════════════════════════════════
-- PANDU Database Schema
-- Run this entire file in Supabase: Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════

-- ── Table 1: conversations ──
-- Stores every message exchange between user and PANDU
create table if not exists conversations (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  session_id text not null,
  user_message text not null,
  ai_response text not null,
  action_taken text,
  created_at timestamptz default now()
);

create index if not exists idx_conversations_user on conversations(user_id);
create index if not exists idx_conversations_session on conversations(session_id);

-- ── Table 2: reminders ──
-- Stores scheduled reminders PANDU needs to speak/notify
create table if not exists reminders (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  remind_at timestamptz not null,
  done boolean default false,
  created_at timestamptz default now()
);

create index if not exists idx_reminders_user on reminders(user_id);

-- ── Table 3: memory ──
-- Stores persistent facts PANDU learns about the user
create table if not exists memory (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  key text not null,
  value text not null,
  updated_at timestamptz default now(),
  unique(user_id, key)
);

create index if not exists idx_memory_user on memory(user_id);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- This ensures each user can ONLY see/edit their own data.
-- Without this, any logged-in user could read everyone else's chats!
-- ═══════════════════════════════════════════════════════════════

alter table conversations enable row level security;
alter table reminders enable row level security;
alter table memory enable row level security;

-- Conversations policies
create policy "Users can view own conversations"
  on conversations for select
  using (auth.uid() = user_id);

create policy "Users can insert own conversations"
  on conversations for insert
  with check (auth.uid() = user_id);

-- Reminders policies
create policy "Users can view own reminders"
  on reminders for select
  using (auth.uid() = user_id);

create policy "Users can insert own reminders"
  on reminders for insert
  with check (auth.uid() = user_id);

create policy "Users can update own reminders"
  on reminders for update
  using (auth.uid() = user_id);

-- Memory policies
create policy "Users can view own memory"
  on memory for select
  using (auth.uid() = user_id);

create policy "Users can insert own memory"
  on memory for insert
  with check (auth.uid() = user_id);

create policy "Users can update own memory"
  on memory for update
  using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- NOTE ON THE BACKEND SERVICE ROLE
-- Your FastAPI backend uses the "anon" key by default, which respects
-- RLS above. Since the backend runs trusted server-side code and acts
-- on behalf of whichever user_id is passed in the request, this is fine
-- for a final-year project. For production, you'd use the service_role
-- key in the backend and enforce user identity via verified JWT tokens
-- instead of trusting the user_id field directly.
-- ═══════════════════════════════════════════════════════════════
