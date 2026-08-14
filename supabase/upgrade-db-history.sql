-- Upgrade: server-side game history (run once in the Supabase SQL Editor).
-- Adds anonymous player ids and final scores to rooms. Finished rooms are now
-- KEPT in the database as each player's history instead of being deleted.
-- (Fresh installs get all of this from schema.sql and can skip this file.)

alter table public.rooms add column if not exists player1_id text;
alter table public.rooms add column if not exists player2_id text;
alter table public.rooms add column if not exists score1 int;
alter table public.rooms add column if not exists score2 int;

create index if not exists rooms_player1_id_idx on public.rooms (player1_id);
create index if not exists rooms_player2_id_idx on public.rooms (player2_id);
