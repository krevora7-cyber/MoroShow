-- Run once in the Supabase project's SQL Editor. No service-role key is needed.
create table if not exists public.moro_account_state (
  account_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.moro_account_state enable row level security;
revoke all on public.moro_account_state from anon, authenticated;
grant select on public.moro_account_state to authenticated;
drop policy if exists "Read own MoroShow state" on public.moro_account_state;
create policy "Read own MoroShow state" on public.moro_account_state for select to authenticated using ((select auth.uid()) = account_id);

-- A transaction + revision check prevents concurrent devices overwriting each other.
create or replace function public.moro_save_state(expected_revision bigint, new_state jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); current_revision bigint;
begin
  if uid is null then raise exception 'Sign in required' using errcode = '28000'; end if;
  if jsonb_typeof(new_state->'profiles') is distinct from 'array'
     or jsonb_array_length(new_state->'profiles') < 1
     or octet_length(new_state::text) > 2000000 then
    raise exception 'Invalid account state' using errcode = '22023';
  end if;
  insert into public.moro_account_state(account_id, revision, state)
    values (uid, 0, new_state) on conflict (account_id) do nothing;
  select revision into current_revision from public.moro_account_state where account_id = uid for update;
  if current_revision <> expected_revision then
    raise exception 'Account changed on another device. Retry.' using errcode = '40001';
  end if;
  update public.moro_account_state set state = new_state, revision = current_revision + 1, updated_at = now() where account_id = uid;
  return current_revision + 1;
end;
$$;
revoke all on function public.moro_save_state(bigint,jsonb) from public,anon;
grant execute on function public.moro_save_state(bigint,jsonb) to authenticated;
