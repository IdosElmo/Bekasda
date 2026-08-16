-- Upgrade: push notifications (run once in the Supabase SQL Editor).
-- Adds the per-device Web Push subscription table used by the notify-turn
-- Edge Function. (Fresh installs get this from schema.sql and can skip it.)

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  player_id text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_player_idx on public.push_subscriptions (player_id);

alter table public.push_subscriptions enable row level security;

create policy "push anon select" on public.push_subscriptions for select using (true);
create policy "push anon insert" on public.push_subscriptions for insert with check (true);
create policy "push anon update" on public.push_subscriptions for update using (true) with check (true);
create policy "push anon delete" on public.push_subscriptions for delete using (true);
