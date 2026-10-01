-- Planning a round no longer picks its scope up front: start_iteration creates an empty
-- not_started round (optional name, else Untitled_Iteration_{n}), and participants/sections
-- are added on the round's page afterwards. The "has something to test" checks move to
-- begin_iteration, so a round can only start once every participant has cases.
--
-- scope_test_case_ids is '{}' (not null) so add_iteration_participant copies only the cases
-- already in the round instead of falling back to every case in the suite.
-- The slug comes from the number, since custom names can repeat (slug is unique per suite).

drop function public.start_iteration(uuid, uuid, text, date, uuid[], uuid[]);

create function public.start_iteration(p_suite_id uuid, p_created_by uuid default null, p_name text default null, p_planned_end_date date default null)
returns public.test_iterations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suite_status public.suite_status;
  v_number int;
  v_iteration public.test_iterations;
begin
  perform public.assert_can('run_iteration');

  select status into v_suite_status from public.testing_suites where id = p_suite_id for update;
  if v_suite_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_suite_status not in ('ready', 'in_testing', 'sign_off_issued', 'signed_off') then
    raise exception 'Cannot start an iteration while the suite is %', v_suite_status;
  end if;
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status in ('not_started', 'in_progress')) then
    raise exception 'An iteration is already planned or in progress for this suite';
  end if;

  -- Reopening an issued or signed-off suite revokes (but keeps) its sign-off.
  if v_suite_status in ('sign_off_issued', 'signed_off') then
    update public.suite_sign_offs
    set revoked_at = now(), revoked_by = p_created_by
    where testing_suite_id = p_suite_id and revoked_at is null;
  end if;

  select coalesce(max(iteration_number), 0) + 1 into v_number
  from public.test_iterations
  where testing_suite_id = p_suite_id;

  insert into public.test_iterations (testing_suite_id, iteration_number, name, slug, planned_end_date, created_by, scope_test_case_ids, status)
  values (p_suite_id, v_number,
          coalesce(nullif(btrim(p_name), ''), 'Untitled_Iteration_' || v_number),
          'iteration-' || lpad(v_number::text, 2, '0'),
          p_planned_end_date, p_created_by, '{}', 'not_started')
  returning * into v_iteration;

  return v_iteration;
end;
$$;

revoke execute on function public.start_iteration(uuid, uuid, text, date) from public, anon;
grant execute on function public.start_iteration(uuid, uuid, text, date) to authenticated;

-- not_started -> in_progress, now also the gate for "is there anything to test".
create or replace function public.begin_iteration(p_iteration_id uuid)
returns public.test_iterations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iteration public.test_iterations;
  v_empty_orgs text;
begin
  perform public.assert_can('run_iteration');

  select * into v_iteration from public.test_iterations where id = p_iteration_id for update;
  if v_iteration.id is null then
    raise exception 'Iteration % not found', p_iteration_id;
  end if;
  if v_iteration.status <> 'not_started' then
    raise exception 'Iteration % has already been started', p_iteration_id;
  end if;

  if not exists (select 1 from public.iteration_participants where iteration_id = p_iteration_id) then
    raise exception 'Add at least one participating organization before starting this iteration';
  end if;
  if not exists (select 1 from public.test_case_results where iteration_id = p_iteration_id and included_in_run) then
    raise exception 'Add at least one section before starting this iteration';
  end if;

  select string_agg(o.name, ', ' order by o.name) into v_empty_orgs
  from public.iteration_participants p
  join public.organizations o on o.id = p.organization_id
  where p.iteration_id = p_iteration_id
    and not exists (
      select 1 from public.test_case_results cr
      where cr.iteration_id = p_iteration_id and cr.organization_id = p.organization_id and cr.included_in_run
    );
  if v_empty_orgs is not null then
    raise exception 'No test cases in this iteration are meant for: %', v_empty_orgs;
  end if;

  update public.test_iterations
  set status = 'in_progress', started_at = now()
  where id = p_iteration_id
  returning * into v_iteration;

  -- Starting a round from an issued or acknowledged sign-off moves the suite back into testing.
  update public.testing_suites
  set status = 'in_testing'
  where id = v_iteration.testing_suite_id and status in ('ready', 'sign_off_issued', 'signed_off');

  return v_iteration;
end;
$$;
