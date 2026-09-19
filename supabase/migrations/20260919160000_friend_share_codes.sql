-- Canonicalize friendship identity so a pair can exist only once in either direction.
create unique index if not exists friendships_canonical_pair_unique
  on public.friendships (least(user_id, friend_id), greatest(user_id, friend_id));
