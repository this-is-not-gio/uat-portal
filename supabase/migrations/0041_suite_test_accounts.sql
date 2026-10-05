-- Overview "Test Accounts": shared login accounts testers use for a suite, one row per account.
-- Staff can read every suite's accounts; other testers only for suites their org takes part in.
-- Written only through save_suite_test_accounts (Admin, suite not locked), which replaces the whole list.

create table if not exists public.suite_test_accounts (
  id uuid primary key default gen_random_uuid(),
  testing_suite_id uuid not null references public.testing_suites(id) on delete cascade,
  role public.role_assignee_type,
  username text not null,
  password text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists suite_test_accounts_suite_idx on public.suite_test_accounts (testing_suite_id, sort_order);

alter table public.suite_test_accounts enable row level security;

drop policy if exists "test accounts: staff or participating org" on public.suite_test_accounts;
create policy "test accounts: staff or participating org" on public.suite_test_accounts
  for select to authenticated
  using (
    (select public.can_see_all_results())
    or exists (
      select 1
      from public.iteration_participants ip
      join public.test_iterations ti on ti.id = ip.iteration_id
      where ti.testing_suite_id = suite_test_accounts.testing_suite_id
        and ip.organization_id = (select public.current_org_id())
    )
  );

-- p_accounts: [{ "role": "Action-Officer" | null, "username": "...", "password": "..." }, ...] in display order.
create or replace function public.save_suite_test_accounts(p_suite_id uuid, p_accounts jsonb)
returns setof public.suite_test_accounts
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can('author');
  perform public.assert_suite_editable(p_suite_id);

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) a
    where coalesce(btrim(a->>'username'), '') = '' or coalesce(a->>'password', '') = ''
  ) then
    raise exception 'Every test account needs a username and a password';
  end if;

  delete from public.suite_test_accounts where testing_suite_id = p_suite_id;

  insert into public.suite_test_accounts (testing_suite_id, role, username, password, sort_order)
  select p_suite_id,
         nullif(a.value->>'role', '')::public.role_assignee_type,
         btrim(a.value->>'username'),
         a.value->>'password',
         a.ordinality::integer
  from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) with ordinality a;

  return query
    select * from public.suite_test_accounts where testing_suite_id = p_suite_id order by sort_order;
end;
$$;

revoke execute on function public.save_suite_test_accounts(uuid, jsonb) from public, anon;
grant execute on function public.save_suite_test_accounts(uuid, jsonb) to authenticated;
