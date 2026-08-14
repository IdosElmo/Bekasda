-- Upgrade for existing projects that already ran schema.sql before the
-- "active games + history" feature. Run once in the Supabase SQL Editor.
-- (Fresh installs get all of this from schema.sql and can skip this file.)

alter table public.rooms add column if not exists p1_seen_result boolean not null default false;
alter table public.rooms add column if not exists p2_seen_result boolean not null default false;

create policy "rooms anon delete" on public.rooms for delete using (true);
