create table if not exists public.ras_state (
  id text primary key,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.ras_state enable row level security;

revoke all on table public.ras_state from public;
grant select, insert, update on table public.ras_state to anon, authenticated;
grant all on table public.ras_state to service_role;

drop policy if exists "RAS shared state is readable" on public.ras_state;
create policy "RAS shared state is readable"
on public.ras_state for select
to anon, authenticated
using (id = 'default');

drop policy if exists "RAS shared state can be initialized" on public.ras_state;
create policy "RAS shared state can be initialized"
on public.ras_state for insert
to anon, authenticated
with check (id = 'default');

drop policy if exists "RAS shared state can be updated" on public.ras_state;
create policy "RAS shared state can be updated"
on public.ras_state for update
to anon, authenticated
using (id = 'default')
with check (id = 'default');

create or replace function public.touch_ras_state()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ras_state_touch on public.ras_state;
create trigger ras_state_touch
before update on public.ras_state
for each row execute function public.touch_ras_state();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'ras_state'
    ) then
    alter publication supabase_realtime add table public.ras_state;
  end if;
end;
$$;
