-- A planned round can hold sections whose cases are all unticked ("0 out of N included").
-- They have nothing to test, so begin_iteration now withdraws them as the round starts:
-- a section's rows are deleted when no participant has an included case in it.
-- not_started rounds can't record results, but rows with results are skipped anyway
-- (same rule as remove_case_result).

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

  -- Sections with nothing ticked leave the round instead of starting empty.
  delete from public.test_case_results cr
  where cr.iteration_id = p_iteration_id
    and cr.section_slug is not null
    and not exists (
      select 1 from public.test_case_results kept
      where kept.iteration_id = p_iteration_id
        and kept.section_slug = cr.section_slug
        and kept.included_in_run
    )
    and not public.case_result_has_results(cr.id);

  -- Anything synced while the round was only planned is its starting scope, not a mid-round change.
  update public.test_case_results
  set sync_kind = null, synced_at = null, synced_by = null
  where iteration_id = p_iteration_id and sync_kind is not null;

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
