-- Recovery migration for existing Pass 1-3 application surfaces.
-- Forward-only; do not reset or replace the remote schema.

create table if not exists public.companion_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  companion_name text not null default 'Talkingston',
  avatar_url text,
  personality text not null default 'Balanced' check (personality in ('Quiet', 'Balanced', 'Friendly', 'Witty', 'Very Playful')),
  proactivity text not null default 'Normal' check (proactivity in ('Off', 'Low', 'Normal', 'High')),
  custom_instructions text,
  voice_tone text not null default 'conversational',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text,
  color_code text not null default '#6366f1' check (color_code ~ '^#[0-9a-fA-F]{6}$'),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null default 'New conversation',
  role_mode text not null default 'Companion',
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender text not null check (sender in ('user', 'assistant')),
  content text not null check (char_length(trim(content)) between 1 and 4000),
  memory_extracted boolean not null default false,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.user_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  category text not null default 'general',
  importance integer not null default 1 check (importance between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, content)
);

create index if not exists idx_projects_user_updated on public.projects(user_id, updated_at desc);
create index if not exists idx_conversations_user_updated on public.conversations(user_id, updated_at desc);
create index if not exists idx_messages_conversation_created on public.messages(conversation_id, created_at);
create index if not exists idx_user_memories_user_importance on public.user_memories(user_id, importance desc);

alter table public.companion_settings enable row level security;
alter table public.projects enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.user_memories enable row level security;

drop policy if exists companion_settings_owner_all on public.companion_settings;
create policy companion_settings_owner_all on public.companion_settings for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists projects_owner_all on public.projects;
create policy projects_owner_all on public.projects for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists conversations_owner_all on public.conversations;
create policy conversations_owner_all on public.conversations for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists messages_owner_select on public.messages;
create policy messages_owner_select on public.messages for select to authenticated
using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));

drop policy if exists messages_owner_insert on public.messages;
create policy messages_owner_insert on public.messages for insert to authenticated
with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));

drop policy if exists messages_owner_delete on public.messages;
create policy messages_owner_delete on public.messages for delete to authenticated
using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));

drop policy if exists user_memories_owner_all on public.user_memories;
create policy user_memories_owner_all on public.user_memories for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
