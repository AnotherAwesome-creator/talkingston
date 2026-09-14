-- Talkingston Pass 7 productivity and privacy surfaces.
-- Forward-only migration. Apply after reviewing the existing remote schema.

alter table public.profiles add column if not exists profile_visibility text not null default 'public';
alter table public.profiles drop constraint if exists profiles_profile_visibility_check;
alter table public.profiles add constraint profiles_profile_visibility_check check (profile_visibility in ('public', 'friends', 'private'));

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 160),
  notes text,
  due_at timestamptz,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  scheduled_at timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('friend_request', 'friend_accepted', 'group_invite', 'direct_message', 'reminder')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  target_route text,
  target_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  friend_requests boolean not null default true,
  friend_accepted boolean not null default true,
  group_invites boolean not null default true,
  direct_messages boolean not null default true,
  reminders boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_owner_status_due on public.tasks(owner_id, status, due_at);
create index if not exists idx_reminders_owner_scheduled on public.reminders(owner_id, scheduled_at);
create index if not exists idx_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications(user_id, read_at);

alter table public.tasks enable row level security;
alter table public.reminders enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;

drop policy if exists tasks_owner_all on public.tasks;
create policy tasks_owner_all on public.tasks for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists reminders_owner_all on public.reminders;
create policy reminders_owner_all on public.reminders for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists notifications_owner_all on public.notifications;
create policy notifications_owner_all on public.notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notification_preferences_owner_all on public.notification_preferences;
create policy notification_preferences_owner_all on public.notification_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace view public.public_profiles as
select id, username, display_name, avatar_url, bio
from public.profiles p
where p.profile_visibility = 'public'
   or p.id = auth.uid()
   or (
     p.profile_visibility = 'friends'
     and exists (
       select 1 from public.friendships f
       where f.status = 'accepted'
         and ((f.user_id = auth.uid() and f.friend_id = p.id) or (f.friend_id = auth.uid() and f.user_id = p.id))
     )
   );

revoke all on table public.public_profiles from anon;
grant select on table public.public_profiles to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

create or replace function public.create_v1_notification(
  target_user_id uuid,
  target_type text,
  target_title text,
  target_body text,
  target_route text,
  target_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare enabled boolean;
begin
  if target_type = 'friend_request' then
    select coalesce(friend_requests, true) into enabled from public.notification_preferences where user_id = target_user_id;
  elsif target_type = 'friend_accepted' then
    select coalesce(friend_accepted, true) into enabled from public.notification_preferences where user_id = target_user_id;
  elsif target_type = 'group_invite' then
    select coalesce(group_invites, true) into enabled from public.notification_preferences where user_id = target_user_id;
  elsif target_type = 'direct_message' then
    select coalesce(direct_messages, true) into enabled from public.notification_preferences where user_id = target_user_id;
  elsif target_type = 'reminder' then
    select coalesce(reminders, true) into enabled from public.notification_preferences where user_id = target_user_id;
  else
    enabled := false;
  end if;
  enabled := coalesce(enabled, true);
  if enabled then
    insert into public.notifications(user_id, type, title, body, target_route, target_id)
    values (target_user_id, target_type, target_title, target_body, target_route, target_id);
  end if;
end;
$$;

revoke all on function public.create_v1_notification(uuid, text, text, text, text, uuid) from public;

create or replace function public.notify_friend_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.create_v1_notification(new.friend_id, 'friend_request', 'New friend request', 'Someone wants to connect with you.', '/friends', new.id);
  return new;
end;
$$;

drop trigger if exists friendships_notification_insert on public.friendships;
create trigger friendships_notification_insert after insert on public.friendships for each row when (new.status = 'pending') execute function public.notify_friend_request();

create or replace function public.notify_direct_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.create_v1_notification(new.recipient_id, 'direct_message', 'New message', 'You have a new direct message.', '/messages/' || new.sender_id::text, new.id);
  return new;
end;
$$;

drop trigger if exists direct_messages_notification_insert on public.direct_messages;
create trigger direct_messages_notification_insert after insert on public.direct_messages for each row execute function public.notify_direct_message();
