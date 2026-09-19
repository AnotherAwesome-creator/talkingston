-- Prototype identity and joining codes. Forward-only migration.

alter table public.profiles add column if not exists share_code text;
alter table public.groups add column if not exists join_code text;
alter table public.whot_rooms add column if not exists room_code text;

update public.profiles
set share_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where share_code is null;

update public.groups
set join_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
where join_code is null;

update public.whot_rooms
set room_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
where room_code is null;

create unique index if not exists profiles_share_code_unique
  on public.profiles(share_code)
  where share_code is not null;

create unique index if not exists groups_join_code_unique
  on public.groups(join_code)
  where join_code is not null;

create unique index if not exists whot_rooms_room_code_unique
  on public.whot_rooms(room_code)
  where room_code is not null;

create or replace function public.join_group_by_code(input_code text)
returns public.group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group public.groups;
  membership public.group_members;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into target_group
  from public.groups
  where join_code = upper(trim(input_code));

  if not found then
    raise exception 'Group code not found';
  end if;

  insert into public.group_members(group_id, user_id, role)
  values (target_group.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do update set role = public.group_members.role
  returning * into membership;

  return membership;
end;
$$;

revoke all on function public.join_group_by_code(text) from public, anon;
grant execute on function public.join_group_by_code(text) to authenticated;
