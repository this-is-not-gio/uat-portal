-- Resets a running or stopped round back to not_started and erases everything recorded in it:
-- step and case statuses (incl. manual overrides and executors), remarks and org submissions.
-- The snapshot itself (participants, copied cases/steps, inclusion) is kept, so the round can be
-- started again as planned. Unlike cancel_iteration, the round isn't deleted.
--
-- Only the suite's latest round can be reset, and a stopped one only while no other round is
-- open (one open round per suite, see 0009's unique index).

create or replace function public.reset_iteration(p_iteration_id uuid)
returns public.test_iterations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iteration public.test_iterations;
begin
  perform public.assert_can('run_iteration');

  select * into v_iteration from public.test_iterations where id = p_iteration_id for update;
  if v_iteration.id is null then
    raise exception 'Iteration % not found', p_iteration_id;
  end if;
  if v_iteration.status not in ('in_progress', 'stopped') then
    raise exception 'Only a running or stopped iteration can be reset';
  end if;
  if exists (
    select 1 from public.test_iterations
    where testing_suite_id = v_iteration.testing_suite_id and iteration_number > v_iteration.iteration_number
  ) then
    raise exception 'Only the latest iteration can be reset';
  end if;
  if v_iteration.status = 'stopped' and exists (
    select 1 from public.test_iterations
    where testing_suite_id = v_iteration.testing_suite_id and id <> p_iteration_id and status in ('not_started', 'in_progress')
  ) then
    raise exception 'Another iteration is already planned or in progress for this suite';
  end if;

  -- guard_completed_iteration rejects result writes on stopped and not_started rounds, and on
  -- orgs that submitted, so reopen the round and clear submissions before erasing.
  update public.test_iterations set status = 'in_progress' where id = p_iteration_id;
  update public.iteration_participants set submitted_at = null where iteration_id = p_iteration_id;

  delete from public.test_remarks r
  using public.test_step_results sr, public.test_case_results cr
  where r.test_step_result_id = sr.id and sr.test_case_result_id = cr.id and cr.iteration_id = p_iteration_id;

  update public.test_step_results sr
  set status = 'Untested'
  from public.test_case_results cr
  where sr.test_case_result_id = cr.id and cr.iteration_id = p_iteration_id and sr.status <> 'Untested';

  -- After the steps: their derive trigger would otherwise re-set case statuses.
  update public.test_case_results
  set status = 'Untested', status_overridden = false, executed_by = null, completed_at = null
  where iteration_id = p_iteration_id;

  update public.test_iterations
  set status = 'not_started', completed_at = null
  where id = p_iteration_id
  returning * into v_iteration;

  -- begin_iteration moved the suite into testing; with no other round ever run, it's ready again.
  if not exists (
    select 1 from public.test_iterations
    where testing_suite_id = v_iteration.testing_suite_id and id <> p_iteration_id and status <> 'not_started'
  ) then
    update public.testing_suites set status = 'ready'
    where id = v_iteration.testing_suite_id and status = 'in_testing';
  end if;

  return v_iteration;
end;
$$;

revoke execute on function public.reset_iteration(uuid) from public, anon;
grant execute on function public.reset_iteration(uuid) to authenticated;
