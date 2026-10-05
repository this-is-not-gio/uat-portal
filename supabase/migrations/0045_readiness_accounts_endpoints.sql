-- Mark as Ready also needs at least one test account and one endpoint on the suite's Overview.
-- suite_readiness_issues stays the single rule (assert_suite_readiness runs it on draft -> ready).
-- The saves below keep a Ready suite from dropping its last account or endpoint, with a plain
-- message instead of the raw readiness error.

create or replace function public.suite_readiness_issues(p_suite_id uuid)
returns table(test_case_id uuid, code text, title text, issue text)
language sql
stable
set search_path = ''
as $$
  select null::uuid, null::text, null::text, 'no_complete_test_cases'
  where not exists (
    select 1 from public.test_cases tc join public.sections s on s.id = tc.section_id
    where s.test_suite_id = p_suite_id
      and not exists (select 1 from public.test_case_issues(tc.id))
  )
  union all
  select null::uuid, null::text, null::text, 'no_test_accounts'
  where not exists (select 1 from public.suite_test_accounts where testing_suite_id = p_suite_id)
  union all
  select null::uuid, null::text, null::text, 'no_endpoints'
  where not exists (select 1 from public.suite_endpoints where testing_suite_id = p_suite_id)
$$;

create or replace function public.save_suite_test_accounts(p_suite_id uuid, p_accounts jsonb)
returns setof public.suite_test_accounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.suite_status;
begin
  perform public.assert_can('author');
  v_status := public.assert_suite_editable(p_suite_id);

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

  -- A Ready suite must keep at least one test account.
  if v_status = 'ready' and not exists (select 1 from public.suite_test_accounts where testing_suite_id = p_suite_id) then
    raise exception 'A Ready suite needs at least one test account. Move it back to Draft to remove the last one.';
  end if;

  return query
    select * from public.suite_test_accounts where testing_suite_id = p_suite_id order by sort_order;
end;
$$;

create or replace function public.save_suite_endpoints(p_suite_id uuid, p_endpoints jsonb)
returns setof public.suite_endpoints
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.suite_status;
begin
  perform public.assert_can('author');
  v_status := public.assert_suite_editable(p_suite_id);

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_endpoints, '[]'::jsonb)) e
    where coalesce(btrim(e->>'name'), '') = '' or coalesce(btrim(e->>'url'), '') = ''
  ) then
    raise exception 'Every endpoint needs a name and a URL';
  end if;

  delete from public.suite_endpoints where testing_suite_id = p_suite_id;

  insert into public.suite_endpoints (testing_suite_id, name, url, sort_order)
  select p_suite_id,
         btrim(e.value->>'name'),
         btrim(e.value->>'url'),
         e.ordinality::integer
  from jsonb_array_elements(coalesce(p_endpoints, '[]'::jsonb)) with ordinality e;

  -- A Ready suite must keep at least one endpoint.
  if v_status = 'ready' and not exists (select 1 from public.suite_endpoints where testing_suite_id = p_suite_id) then
    raise exception 'A Ready suite needs at least one endpoint. Move it back to Draft to remove the last one.';
  end if;

  return query
    select * from public.suite_endpoints where testing_suite_id = p_suite_id order by sort_order;
end;
$$;
