-- בקסדה — Supabase schema.
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).

create table if not exists public.rooms (
  code text primary key,
  letter text not null,
  player1_name text,
  player2_name text,
  current_turn int not null default 1 check (current_turn in (1, 2)),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  winner int check (winner in (1, 2)),
  win_reason text check (win_reason in ('pass', 'concede')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.turns (
  id bigint generated always as identity primary key,
  room_code text not null references public.rooms(code) on delete cascade,
  player int not null check (player in (1, 2)),
  action text not null default 'words' check (action in ('words', 'pass', 'concede')),
  words text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists turns_room_code_idx on public.turns (room_code, id);

-- Casual anonymous game: anyone with the room code may read and write.
alter table public.rooms enable row level security;
alter table public.turns enable row level security;

create policy "rooms anon select" on public.rooms for select using (true);
create policy "rooms anon insert" on public.rooms for insert with check (true);
create policy "rooms anon update" on public.rooms for update using (true) with check (true);

create policy "turns anon select" on public.turns for select using (true);
create policy "turns anon insert" on public.turns for insert with check (true);

-- Realtime: push room/turn changes to connected clients.
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.turns;
