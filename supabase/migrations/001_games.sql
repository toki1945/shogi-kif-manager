create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(title) between 1 and 200),
  kif text not null check (octet_length(kif) <= 2000000),
  tags text[] not null default '{}',
  favorite boolean not null default false,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists games_user_created on public.games(user_id, created_at desc);
alter table public.games enable row level security;
create policy "Users read own games" on public.games for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own games" on public.games for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own games" on public.games for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own games" on public.games for delete to authenticated using ((select auth.uid()) = user_id);
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger games_updated_at before update on public.games for each row execute function public.set_updated_at();
revoke all on public.games from anon;
grant select, insert, update, delete on public.games to authenticated;
