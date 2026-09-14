drop policy if exists whot_rooms_lobby_select on public.whot_rooms;
create policy whot_rooms_lobby_select on public.whot_rooms for select to authenticated
using (status = 'lobby');

drop policy if exists whot_players_lobby_select on public.whot_players;
create policy whot_players_lobby_select on public.whot_players for select to authenticated
using (exists (select 1 from public.whot_rooms r where r.id = room_id and r.status = 'lobby') or public.is_whot_member(room_id, auth.uid()));
