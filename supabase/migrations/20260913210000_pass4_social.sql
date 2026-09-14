-- Talkingston Pass 4 social foundation.
-- Forward-only migration. Apply with `supabase db push`; do not reset a remote project.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  avatar_url text,
  bio text,
  interests text[] not null default '{}',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists bio text;

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_not_self check (user_id <> friend_id),
  constraint friendships_unique_pair unique (user_id, friend_id)
);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 4000),
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint direct_messages_not_self check (sender_id <> recipient_id)
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists idx_friendships_user_status on public.friendships(user_id, status);
create index if not exists idx_friendships_friend_status on public.friendships(friend_id, status);
create index if not exists idx_direct_messages_participants_created on public.direct_messages(sender_id, recipient_id, created_at desc);
create index if not exists idx_direct_messages_recipient_unread on public.direct_messages(recipient_id, is_read, created_at desc);
create index if not exists idx_group_members_user on public.group_members(user_id);
create index if not exists idx_group_messages_group_created on public.group_messages(group_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.direct_messages enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

create or replace view public.public_profiles as
select id, username, display_name, avatar_url, bio
from public.profiles;

revoke all on table public.public_profiles from anon;
grant select on table public.public_profiles to authenticated;

create or replace function public.is_group_member(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group_id and user_id = target_user_id
  );
$$;

create or replace function public.is_group_manager(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group_id and user_id = target_user_id and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_group_owner(target_group_id uuid, target_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups
    where id = target_group_id and owner_id = target_user_id
  );
$$;

revoke all on function public.is_group_member(uuid, uuid) from public;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;
revoke all on function public.is_group_manager(uuid, uuid) from public;
grant execute on function public.is_group_manager(uuid, uuid) to authenticated;
revoke all on function public.is_group_owner(uuid, uuid) from public;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated;

drop policy if exists profiles_public_select on public.profiles;
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists friendships_participant_select on public.friendships;
create policy friendships_participant_select on public.friendships for select to authenticated using (auth.uid() in (user_id, friend_id));
drop policy if exists friendships_self_insert on public.friendships;
create policy friendships_self_insert on public.friendships for insert to authenticated with check (auth.uid() = user_id and user_id <> friend_id);
drop policy if exists friendships_participant_update on public.friendships;
create policy friendships_recipient_accept on public.friendships for update to authenticated using (auth.uid() = friend_id and status = 'pending') with check (auth.uid() = friend_id and status = 'accepted');
drop policy if exists friendships_participant_delete on public.friendships;
create policy friendships_participant_delete on public.friendships for delete to authenticated using (auth.uid() in (user_id, friend_id));

drop policy if exists direct_messages_participant_select on public.direct_messages;
create policy direct_messages_participant_select on public.direct_messages for select to authenticated using (auth.uid() in (sender_id, recipient_id));
drop policy if exists direct_messages_sender_insert on public.direct_messages;
create policy direct_messages_sender_insert on public.direct_messages for insert to authenticated with check (auth.uid() = sender_id and sender_id <> recipient_id);
drop policy if exists direct_messages_recipient_read on public.direct_messages;
create policy direct_messages_recipient_read on public.direct_messages for update to authenticated using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
drop policy if exists direct_messages_sender_delete on public.direct_messages;
create policy direct_messages_sender_delete on public.direct_messages for delete to authenticated using (auth.uid() = sender_id);

create or replace function public.prevent_direct_message_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.sender_id <> new.sender_id
    or old.recipient_id <> new.recipient_id
    or old.content <> new.content
    or old.created_at <> new.created_at then
    raise exception 'direct message content and participants cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists direct_messages_immutable_fields on public.direct_messages;
create trigger direct_messages_immutable_fields
before update on public.direct_messages
for each row execute function public.prevent_direct_message_mutation();

drop policy if exists groups_member_select on public.groups;
create policy groups_member_select on public.groups for select to authenticated using (public.is_group_member(id, auth.uid()));
drop policy if exists groups_owner_insert on public.groups;
create policy groups_owner_insert on public.groups for insert to authenticated with check (auth.uid() = owner_id);
drop policy if exists groups_manager_update on public.groups;
create policy groups_manager_update on public.groups for update to authenticated using (public.is_group_manager(id, auth.uid())) with check (public.is_group_manager(id, auth.uid()));
drop policy if exists groups_owner_delete on public.groups;
create policy groups_owner_delete on public.groups for delete to authenticated using (auth.uid() = owner_id);

create or replace function public.prevent_group_owner_id_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.owner_id <> new.owner_id then
    raise exception 'group ownership cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists groups_owner_id_guard on public.groups;
create trigger groups_owner_id_guard
before update on public.groups
for each row execute function public.prevent_group_owner_id_change();

drop policy if exists group_members_member_select on public.group_members;
create policy group_members_member_select on public.group_members for select to authenticated using (public.is_group_member(group_id, auth.uid()));
drop policy if exists group_members_owner_insert on public.group_members;
create policy group_members_owner_insert on public.group_members for insert to authenticated with check (
  (user_id = auth.uid() and role = 'owner' and public.is_group_owner(group_id, auth.uid()))
  or public.is_group_manager(group_id, auth.uid())
);
drop policy if exists group_members_manager_delete on public.group_members;
create policy group_members_manager_delete on public.group_members for delete to authenticated using (
  user_id = auth.uid()
  or public.is_group_manager(group_id, auth.uid())
);
drop policy if exists group_members_owner_update on public.group_members;
create policy group_members_owner_update on public.group_members for update to authenticated using (
  exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid())
) with check (role in ('owner', 'admin', 'member'));

create or replace function public.prevent_group_owner_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (old.role = 'owner' and new.role <> 'owner') or (old.role <> 'owner' and new.role = 'owner') then
    raise exception 'group owner role cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists group_members_owner_role_guard on public.group_members;
create trigger group_members_owner_role_guard
before update on public.group_members
for each row execute function public.prevent_group_owner_change();

drop policy if exists group_messages_member_select on public.group_messages;
create policy group_messages_member_select on public.group_messages for select to authenticated using (public.is_group_member(group_id, auth.uid()));
drop policy if exists group_messages_member_insert on public.group_messages;
create policy group_messages_member_insert on public.group_messages for insert to authenticated with check (
  auth.uid() = sender_id and public.is_group_member(group_id, auth.uid())
);

do $$
begin
  alter publication supabase_realtime add table public.direct_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.group_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
