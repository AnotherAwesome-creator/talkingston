-- Talkingston Pass 5 Whot persistence. Forward-only; do not reset a remote project.
create table if not exists public.whot_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'active', 'paused', 'finished')),
  state jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whot_players (
  room_id uuid not null references public.whot_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  seat integer not null check (seat between 0 and 3),
  ready boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

create table if not exists public.whot_events (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.whot_rooms(id) on delete cascade,
  sequence integer not null,
  event_type text not null,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique (room_id, sequence)
);

create index if not exists idx_whot_players_user on public.whot_players(user_id);
create index if not exists idx_whot_events_room_sequence on public.whot_events(room_id, sequence);

alter table public.whot_rooms enable row level security;
alter table public.whot_players enable row level security;
alter table public.whot_events enable row level security;

create or replace function public.is_whot_member(target_room_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from public.whot_players where room_id = target_room_id and user_id = target_user_id);
$$;
revoke all on function public.is_whot_member(uuid, uuid) from public;
grant execute on function public.is_whot_member(uuid, uuid) to authenticated;

create policy whot_rooms_member_select on public.whot_rooms for select to authenticated
using (public.is_whot_member(id, auth.uid()));
create policy whot_rooms_owner_insert on public.whot_rooms for insert to authenticated
with check (owner_id = auth.uid());
create policy whot_rooms_owner_update on public.whot_rooms for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists whot_rooms_member_update on public.whot_rooms;
create policy whot_rooms_member_update on public.whot_rooms for update to authenticated
using (public.is_whot_member(id, auth.uid()))
with check (public.is_whot_member(id, auth.uid()));

create policy whot_players_member_select on public.whot_players for select to authenticated
using (public.is_whot_member(room_id, auth.uid()));
create policy whot_players_owner_insert on public.whot_players for insert to authenticated
with check (user_id = auth.uid() or exists (select 1 from public.whot_rooms r where r.id = room_id and r.owner_id = auth.uid()));
create policy whot_players_self_update on public.whot_players for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy whot_events_member_select on public.whot_events for select to authenticated
using (public.is_whot_member(room_id, auth.uid()));
create policy whot_events_member_insert on public.whot_events for insert to authenticated
with check (actor_id = auth.uid() and public.is_whot_member(room_id, auth.uid()));

do $$
begin
  alter publication supabase_realtime add table public.whot_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
