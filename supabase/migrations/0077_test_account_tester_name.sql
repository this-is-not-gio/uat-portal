-- Test Accounts get an optional "tester name": who the shared login is for. Same as 0057 otherwise.

alter table public.suite_test_accounts add column tester_name text not null default '';

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

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) a
    where nullif(a->>'test_role_id', '') is not null
      and not exists (select 1 from public.test_roles t where t.id = (a->>'test_role_id')::uuid)
  ) then
    raise exception 'A test account''s role is no longer in the role catalog' using errcode = 'P0001';
  end if;

  delete from public.suite_test_accounts where testing_suite_id = p_suite_id;

  insert into public.suite_test_accounts (testing_suite_id, test_role_id, tester_name, username, password, sort_order)
  select p_suite_id,
         nullif(a.value->>'test_role_id', '')::uuid,
         coalesce(btrim(a.value->>'tester_name'), ''),
         btrim(a.value->>'username'),
         a.value->>'password',
         a.ordinality::integer
  from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) with ordinality a;

  if v_status = 'ready' and not exists (select 1 from public.suite_test_accounts where testing_suite_id = p_suite_id) then
    raise exception 'A Ready suite needs at least one test account. Move it back to Draft to remove the last one.';
  end if;

  return query
    select * from public.suite_test_accounts where testing_suite_id = p_suite_id order by sort_order;
end;
$$;
