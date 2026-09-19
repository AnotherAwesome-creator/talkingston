alter table public.user_documents
  add column if not exists group_id uuid references public.groups(id) on delete cascade;

create index if not exists idx_user_documents_group
  on public.user_documents(group_id, created_at desc);

drop policy if exists trivia_documents_owner on public.user_documents;
create policy group_documents_select on public.user_documents
  for select to authenticated
  using (
    owner_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id, auth.uid()))
  );

create policy user_documents_owner_insert on public.user_documents
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (
      group_id is null
      or public.is_group_member(group_id, auth.uid())
    )
  );

create policy user_documents_owner_update on public.user_documents
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy user_documents_owner_delete on public.user_documents
  for delete to authenticated
  using (owner_id = auth.uid());
