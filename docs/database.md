# Talkingston V1 — Database Schema & Data Models

The forward-only Pass 6 migration adds `trivia_rooms`, `trivia_players`, `trivia_answers`, `user_documents`, and `document_quizzes`. Ownership and room membership are protected by RLS; no database reset or blind push is part of this change.

> **Implementation Status (Stage 2A)**:
> The client/server connection layer (`lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/middleware.ts`) is established and verified.
> The tables, extensions, indexes, and RLS policies detailed below represent the authoritative target schema. Pass 4 adds a forward-only social migration under `supabase/migrations/`.

This document specifies the PostgreSQL database schema, data models, extensions, indexes, and Row Level Security (RLS) policies for Talkingston V1 on Supabase.

---

## 1. PostgreSQL Extensions

The following extensions are required:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";      -- For pgvector semantic memory search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- For fast full-text trigram search
```

---

## 2. Table Specifications

### 2.1 Profiles (`profiles`)
Represents registered users in the application.
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  interests TEXT[] DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 Companion Settings (`companion_settings`)
Stores personalized Talkingston configuration per user.
```sql
CREATE TYPE companion_personality AS ENUM (
  'Quiet',
  'Balanced',
  'Friendly',
  'Witty',
  'Very Playful'
);

CREATE TYPE companion_proactivity AS ENUM (
  'Off',
  'Low',
  'Normal',
  'High'
);

CREATE TABLE public.companion_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_name TEXT DEFAULT 'Talkingston' NOT NULL,
  avatar_url TEXT,
  personality companion_personality DEFAULT 'Balanced' NOT NULL,
  proactivity companion_proactivity DEFAULT 'Normal' NOT NULL,
  custom_instructions TEXT,
  voice_tone TEXT DEFAULT 'conversational',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 User Memories (`user_memories`)
Stores semantic facts and preferences extracted by the AI Context Engine.
```sql
CREATE TABLE public.user_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general', -- 'preference', 'fact', 'goal', 'relationship'
  importance INTEGER DEFAULT 1,    -- 1 to 5
  embedding vector(768),           -- pgvector semantic embedding
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_memories_user_id ON public.user_memories(user_id);
CREATE INDEX idx_user_memories_embedding ON public.user_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 2.4 Conversations & Messages (`conversations`, `messages`)
Manages companion chats and project-linked discussions.
```sql
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  role_mode TEXT DEFAULT 'Companion' NOT NULL, -- 'Companion', 'Tutor', 'Referee', 'Quizmaster'
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  memory_extracted BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
```

### 2.5 Social: Friendships & Direct Messages
```sql
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dm_participants ON public.direct_messages(sender_id, recipient_id);
CREATE INDEX idx_friendships_participant_status ON public.friendships(user_id, status);
CREATE INDEX idx_friendships_recipient_status ON public.friendships(friend_id, status);
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_group_messages_group_created ON public.group_messages(group_id, created_at DESC);
```

### 2.6 Social: Private Groups & Group Messages
```sql
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.group_members (
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' NOT NULL, -- 'owner', 'admin', 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.7 Authoritative Whot Sessions & Turns
```sql
CREATE TABLE public.whot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL, -- 'single_ai' or 'multiplayer'
  status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting', 'active', 'finished', 'abandoned'
  current_turn_user_id UUID,
  active_card JSONB NOT NULL,
  called_suit TEXT,
  card_draw_pile_count INTEGER NOT NULL,
  winner_id UUID,
  game_state JSONB NOT NULL, -- full deterministic snapshot
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.whot_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.whot_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'PLAY_CARD', 'DRAW_CARD', 'DEFEND', 'CALL_SUIT'
  card_played JSONB,
  penalty_accumulated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.8 Trivia & Document Quiz Tables
```sql
CREATE TABLE public.trivia_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  source_type TEXT DEFAULT 'bank' NOT NULL, -- 'bank' or 'document'
  source_document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.trivia_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.trivia_quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- array of strings
  correct_option_index INTEGER NOT NULL,
  explanation TEXT,
  difficulty TEXT DEFAULT 'medium'
);

CREATE TABLE public.quiz_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.trivia_quizzes(id) ON DELETE CASCADE,
  room_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby', -- 'lobby', 'in_progress', 'completed'
  current_question_index INTEGER DEFAULT 0,
  round_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.quiz_participants (
  room_id UUID NOT NULL REFERENCES public.quiz_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INTEGER DEFAULT 0 NOT NULL,
  streak INTEGER DEFAULT 0 NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);
```

### 2.9 Projects, Tasks & Productivity
```sql
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color_code TEXT DEFAULT '#3B82F6',
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium' NOT NULL, -- 'low', 'medium', 'high'
  status TEXT DEFAULT 'todo' NOT NULL,    -- 'todo', 'in_progress', 'done'
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'friend_request', 'game_invite', 'quiz_invite', 'reminder'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Row Level Security (RLS) Strategy

Every table must have Row Level Security enabled:
```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whot_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
```

### Policy Examples:
- **Profiles**: Public read for authenticated users; write restricted to `auth.uid() = id`.
- **Companion Settings**: Read and write restricted strictly to `auth.uid() = user_id`.
- **User Memories**: Read, insert, delete restricted strictly to `auth.uid() = user_id`.
- **Direct Messages**: Read restricted to `auth.uid() IN (sender_id, recipient_id)`.
- **Whot Sessions**: Read restricted to participants in the session; write updates guarded by game engine server validation.

## 4. Pass 2 Persistence Usage

Pass 2 uses the existing target tables without introducing duplicates:

- `conversations` stores the authenticated owner, title, role mode, pin state, and timestamps.
- `messages` stores short-term conversation context with `sender` and `content`.
- `user_memories` stores only extracted persistent candidates and is always queried/deleted with the authenticated `user_id`.
- `profiles` and `companion_settings` remain the source of stable profile, personality, and proactivity context.

The repository includes a forward-only Pass 4 social migration; deployment still requires applying the documented schema and RLS policies to Supabase.

## 5. Pass 4 Social Persistence Usage

Pass 4 uses the documented social tables without duplicate persistence:

- `profiles` is queried only for public discovery fields.
- `friendships` stores directed pending requests and accepted/blocked relationship state.
- `direct_messages` stores participant-scoped one-to-one messages and read state.
- `groups` and `group_members` define private group ownership, roles, and access.
- `group_messages` stores member-authored group messages.

The application performs server-side authentication and membership checks before every social read/write. Supabase RLS remains the authoritative database boundary. The migration and its Realtime publication settings must be applied before production use.

## 6. Pass 4 migration

`supabase/migrations/20260913210000_pass4_social.sql` creates or extends the social tables, adds self/role/status/content constraints, adds participant and membership indexes, enables RLS, installs participant/member/owner policies, exposes only the five approved fields through `public_profiles`, protects immutable DM/group ownership fields with triggers, and adds `direct_messages` and `group_messages` to `supabase_realtime`. The migration is forward-only and does not reset or drop existing data.

## Pass 5 Whot migration

`supabase/migrations/20260914100000_pass5_whot.sql` adds forward-only `whot_rooms`, `whot_players`, and `whot_events` tables. Room state is versioned JSON for reconnects; RLS restricts room, player, and event access to members, and only authenticated room members can append events. `whot_events` is included in `supabase_realtime`. The migration has not been applied remotely by this coding session.

## 5. Pass 3 Persistence Usage

Pass 3 uses the documented `projects` table as the ownership boundary for project metadata and associates conversations through `conversations.project_id`. Conversation history uses bounded pages and search queries are scoped by the authenticated owner before returning title/snippet results. The `is_archived` conversation flag supports archive without deleting history.
