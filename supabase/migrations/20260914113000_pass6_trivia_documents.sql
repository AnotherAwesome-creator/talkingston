create table if not exists public.trivia_rooms (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby','active','finished')),
  questions jsonb not null, state jsonb not null default '{}', version integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.trivia_players (
  room_id uuid not null references public.trivia_rooms(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null default 0, streak integer not null default 0, primary key(room_id,user_id)
);
create table if not exists public.user_documents (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null, mime_type text not null, storage_path text not null unique, extracted_text text not null, created_at timestamptz not null default now()
);
create table if not exists public.document_quizzes (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid references public.user_documents(id) on delete cascade, questions jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.trivia_answers (
  room_id uuid not null references public.trivia_rooms(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
  question_id text not null, option_index integer not null check(option_index between 0 and 3), submitted_at_ms integer not null,
  primary key(room_id,user_id,question_id)
);
alter table public.trivia_rooms enable row level security;
alter table public.trivia_players enable row level security;
alter table public.user_documents enable row level security;
alter table public.document_quizzes enable row level security;
alter table public.trivia_answers enable row level security;
create or replace function public.is_trivia_member(target_room_id uuid, target_user_id uuid) returns boolean language sql security definer set search_path=public as $$ select exists(select 1 from public.trivia_players where room_id=target_room_id and user_id=target_user_id); $$;
grant execute on function public.is_trivia_member(uuid,uuid) to authenticated;
create policy trivia_rooms_member_select on public.trivia_rooms for select to authenticated using (public.is_trivia_member(id,auth.uid()) or owner_id=auth.uid());
create policy trivia_rooms_owner_insert on public.trivia_rooms for insert to authenticated with check(owner_id=auth.uid());
create policy trivia_rooms_owner_update on public.trivia_rooms for update to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy trivia_rooms_member_update on public.trivia_rooms for update to authenticated using(public.is_trivia_member(id,auth.uid())) with check(public.is_trivia_member(id,auth.uid()));
create policy trivia_players_member_select on public.trivia_players for select to authenticated using(public.is_trivia_member(room_id,auth.uid()) or user_id=auth.uid());
create policy trivia_players_self_insert on public.trivia_players for insert to authenticated with check(user_id=auth.uid());
create policy trivia_players_self_update on public.trivia_players for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy trivia_documents_owner on public.user_documents for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy trivia_quizzes_owner on public.document_quizzes for all to authenticated using(owner_id=auth.uid()) with check(owner_id=auth.uid());
create policy trivia_answers_member on public.trivia_answers for select to authenticated using(public.is_trivia_member(room_id,auth.uid()));
create policy trivia_answers_self_insert on public.trivia_answers for insert to authenticated with check(user_id=auth.uid() and public.is_trivia_member(room_id,auth.uid()));
create policy trivia_answers_self_select on public.trivia_answers for select to authenticated using(user_id=auth.uid());
do $$ begin alter publication supabase_realtime add table public.trivia_rooms; exception when duplicate_object then null; when undefined_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.trivia_answers; exception when duplicate_object then null; when undefined_object then null; end $$;
insert into storage.buckets (id, name, public) values ('private-documents', 'private-documents', false) on conflict (id) do nothing;
create policy private_documents_owner_insert on storage.objects for insert to authenticated with check(bucket_id='private-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy private_documents_owner_select on storage.objects for select to authenticated using(bucket_id='private-documents' and (storage.foldername(name))[1]=auth.uid()::text);
create policy private_documents_owner_delete on storage.objects for delete to authenticated using(bucket_id='private-documents' and (storage.foldername(name))[1]=auth.uid()::text);
