-- Overview "Test Accounts": the Role is now the name of a test role created in /admin
-- (organization_roles, Internal + External), not the role_assignee_type enum.
-- Stored as the role's name (text): roles are per org and the same name repeats across orgs,
-- and a deleted/renamed role must not wipe the account row.

alter table public.suite_test_accounts
  alter column role type text using role::text;

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
         nullif(btrim(a.value->>'role'), ''),
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

revoke execute on function public.save_suite_test_accounts(uuid, jsonb) from public, anon;
grant execute on function public.save_suite_test_accounts(uuid, jsonb) to authenticated;
