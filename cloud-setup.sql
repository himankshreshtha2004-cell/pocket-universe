-- Cloud save for The Impossible Path + Pocket Universe
-- Supabase → SQL Editor → New query → paste all of this → Run. (Safe to run again.)

create table if not exists public.saves (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  app        text    not null,            -- 'impossible-path' or 'pocket-universe'
  key        text    not null,            -- 'save' for the puzzle game, one row per world for Pocket Universe
  data       jsonb,
  updated_at bigint  not null default 0,  -- milliseconds; the newest copy wins
  deleted    boolean not null default false,
  primary key (user_id, app, key)
);

alter table public.saves enable row level security;

-- let signed-in players use the table through the Data API (needed if "Grant API access to new tables" was off)
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.saves to authenticated;

drop policy if exists "read own saves"   on public.saves;
drop policy if exists "add own saves"    on public.saves;
drop policy if exists "change own saves" on public.saves;
drop policy if exists "remove own saves" on public.saves;
create policy "read own saves"   on public.saves for select using (auth.uid() = user_id);
create policy "add own saves"    on public.saves for insert with check (auth.uid() = user_id);
create policy "change own saves" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "remove own saves" on public.saves for delete using (auth.uid() = user_id);
