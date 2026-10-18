-- Link published Testing Manual modules to a test suite (Manual tab). Display order = created_at.
-- Everyone signed in can read links (module visibility is still enforced by the manual RLS);
-- only an Admin can add or remove them, and only while the suite is not Signed off or Archived.
-- No update policy: links are only created or deleted.

create table if not exists public.suite_manual_modules (
  suite_id uuid not null references public.testing_suites(id) on delete cascade,
  module_id uuid not null references public.manual_modules(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (suite_id, module_id)
);

create index if not exists suite_manual_modules_module_idx on public.suite_manual_modules (module_id);

alter table public.suite_manual_modules enable row level security;

drop policy if exists "suite manual modules: read" on public.suite_manual_modules;
create policy "suite manual modules: read" on public.suite_manual_modules
  for select to authenticated
  using (true);

drop policy if exists "suite manual modules: admin insert" on public.suite_manual_modules;
create policy "suite manual modules: admin insert" on public.suite_manual_modules
  for insert to authenticated
  with check (
    (select public.is_admin())
    and exists (select 1 from public.testing_suites s where s.id = suite_id and s.status not in ('signed_off', 'archived'))
  );

drop policy if exists "suite manual modules: admin delete" on public.suite_manual_modules;
create policy "suite manual modules: admin delete" on public.suite_manual_modules
  for delete to authenticated
  using (
    (select public.is_admin())
    and exists (select 1 from public.testing_suites s where s.id = suite_id and s.status not in ('signed_off', 'archived'))
  );

-- Save the whole set at once: inserts the missing links and deletes the extra ones in one transaction.
-- New links must point at published modules; already-linked unpublished modules may stay.
create or replace function public.set_suite_manual_modules(p_suite_id uuid, p_module_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status public.suite_status;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can link manual modules.' using errcode = '42501';
  end if;
  select status into v_status from public.testing_suites where id = p_suite_id;
  if not found then
    raise exception 'Test suite not found.' using errcode = 'P0002';
  end if;
  if v_status in ('signed_off', 'archived') then
    raise exception 'Manual links are locked once a suite is signed off or archived.' using errcode = '42501';
  end if;
  if exists (
    select 1 from unnest(p_module_ids) as u(id)
    where not exists (select 1 from public.manual_modules m where m.id = u.id)
       or (
         not exists (select 1 from public.suite_manual_modules l where l.suite_id = p_suite_id and l.module_id = u.id)
         and not exists (select 1 from public.manual_modules m where m.id = u.id and m.is_published)
       )
  ) then
    raise exception 'Only published manual modules can be newly linked.' using errcode = '22023';
  end if;

  delete from public.suite_manual_modules
  where suite_id = p_suite_id and module_id <> all (p_module_ids);

  insert into public.suite_manual_modules (suite_id, module_id)
  select p_suite_id, u.id from (select distinct unnest(p_module_ids) as id) u
  on conflict do nothing;
end;
$$;

revoke all on function public.set_suite_manual_modules(uuid, uuid[]) from public, anon;
grant execute on function public.set_suite_manual_modules(uuid, uuid[]) to authenticated;
