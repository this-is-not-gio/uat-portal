-- Sign-off report: per-suite exit criteria and a frozen report stored with the sign-off.
-- Exit criteria can only change while the suite is draft or ready, so the bar can't move mid-testing.

alter table public.testing_suites
  add column if not exists exit_criteria jsonb not null
    default '{"minPassRate":95,"maxHighFailed":0,"maxBlocked":0,"requireAllOrgsSubmitted":true}';

create or replace function public.lock_exit_criteria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.exit_criteria is distinct from old.exit_criteria
     and old.status not in ('draft', 'ready') then
    raise exception 'Exit criteria can only be changed while the suite is draft or ready (current: %)', old.status;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_exit_criteria on public.testing_suites;
create trigger lock_exit_criteria
  before update on public.testing_suites
  for each row execute function public.lock_exit_criteria();

alter table public.suite_sign_offs
  add column if not exists report jsonb;

-- Drop the 3-argument version so issue_sign_off isn't overloaded.
drop function if exists public.issue_sign_off(uuid, uuid, text);

-- Same as 0026, plus p_report stored on the sign-off. exceptions is still written for older readers.
create or replace function public.issue_sign_off(p_suite_id uuid, p_by uuid default null, p_note text default null, p_report jsonb default null)
returns public.suite_sign_offs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.suite_status;
  v_iteration_id uuid;
  v_counts jsonb;
  v_sign_off public.suite_sign_offs;
begin
  perform public.assert_can('issue_sign_off');

  select status into v_status from public.testing_suites where id = p_suite_id for update;
  if v_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_status <> 'in_testing' then
    raise exception 'Only a suite in testing can be issued for sign-off (current: %)', v_status;
  end if;
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status in ('not_started', 'in_progress')) then
    raise exception 'Every test iteration must be finished before issuing the sign-off';
  end if;

  select id into v_iteration_id
  from public.test_iterations
  where testing_suite_id = p_suite_id and status = 'completed'
  order by iteration_number desc
  limit 1;
  if v_iteration_id is null then
    raise exception 'At least one completed iteration is required to issue the sign-off';
  end if;

  select jsonb_build_object(
           'total', count(*),
           'passed', count(*) filter (where status = 'Passed'),
           'failed', count(*) filter (where status = 'Failed'),
           'blocked', count(*) filter (where status = 'Blocked'),
           'in_progress', count(*) filter (where status = 'In Progress'),
           'untested', count(*) filter (where status = 'Untested')
         )
  into v_counts
  from public.test_case_results where iteration_id = v_iteration_id;

  insert into public.suite_sign_offs (testing_suite_id, iteration_id, signed_off_by, note, exceptions, report)
  values (p_suite_id, v_iteration_id, p_by, nullif(btrim(p_note), ''), v_counts, p_report)
  returning * into v_sign_off;

  update public.testing_suites set status = 'sign_off_issued' where id = p_suite_id;
  return v_sign_off;
end;
$$;

revoke execute on function public.issue_sign_off(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.issue_sign_off(uuid, uuid, text, jsonb) to authenticated;
