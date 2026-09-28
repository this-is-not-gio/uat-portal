-- Iteration lifecycle, part 2 (values added in 0008):
--   start_iteration  creates a round as not_started (planning: snapshot + scope, nothing recordable yet)
--   begin_iteration  not_started -> in_progress (testing starts; a ready/signed-off suite moves to in_testing)
--   complete_iteration in_progress -> completed (unchanged; the only state sign-off counts)
--   stop_iteration   in_progress -> stopped (ended early; results frozen like completed)
-- A suite has at most one open (not_started or in_progress) round.

alter table public.test_iterations alter column status set default 'not_started';

drop index public.test_iterations_one_active_per_suite;
create unique index test_iterations_one_active_per_suite on public.test_iterations (testing_suite_id)
  where status in ('not_started', 'in_progress');

-- Frozen rounds (completed/stopped) reject all result edits. A not_started round
-- still takes snapshot writes (sync, scope toggles) but not recorded results.
create or replace function public.guard_completed_iteration()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare
  v_status public.iteration_status;
begin
  if tg_table_name = 'test_case_results' then
    select i.status into v_status from public.test_iterations i where i.id = new.iteration_id;
  elsif tg_table_name = 'test_step_results' then
    select i.status into v_status
    from public.test_case_results cr join public.test_iterations i on i.id = cr.iteration_id
    where cr.id = new.test_case_result_id;
  elsif tg_table_name = 'test_remarks' then
    if new.test_step_result_id is null then return new; end if;
    select i.status into v_status
    from public.test_step_results sr
    join public.test_case_results cr on cr.id = sr.test_case_result_id
    join public.test_iterations i on i.id = cr.iteration_id
    where sr.id = new.test_step_result_id;
  end if;

  if v_status in ('completed', 'stopped') then
    raise exception 'Cannot modify results of a % iteration', v_status;
  end if;

  -- Separate ifs: SQL doesn't short-circuit OR, and each table has different columns.
  if v_status = 'not_started' then
    if tg_table_name = 'test_remarks' then
      raise exception 'Start the iteration before recording results';
    elsif tg_table_name = 'test_step_results' then
      if new.status is distinct from old.status then
        raise exception 'Start the iteration before recording results';
      end if;
    elsif tg_table_name = 'test_case_results' then
      if new.status is distinct from old.status
        or new.status_overridden is distinct from old.status_overridden
        or new.executed_by is distinct from old.executed_by then
        raise exception 'Start the iteration before recording results';
      end if;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.start_iteration(p_suite_id uuid, p_created_by uuid default null, p_label text default null, p_planned_end_date date default null, p_test_case_ids uuid[] default null, p_org_ids uuid[] default null)
 returns public.test_iterations
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_status public.suite_status;
  v_number int;
  v_name text;
  v_iteration public.test_iterations;
  v_issues text;
  v_org_ids uuid[];
  v_empty_orgs text;
begin
  perform public.assert_can('run_iteration');

  select status into v_suite_status from public.testing_suites where id = p_suite_id for update;
  if v_suite_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_suite_status not in ('ready', 'in_testing', 'signed_off') then
    raise exception 'Cannot start an iteration while the suite is %', v_suite_status;
  end if;
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status in ('not_started', 'in_progress')) then
    raise exception 'An iteration is already planned or in progress for this suite';
  end if;

  if p_test_case_ids is not null then
    if cardinality(p_test_case_ids) = 0 then
      raise exception 'Pick at least one test case for this iteration';
    end if;
    if exists (
      select 1 from unnest(p_test_case_ids) x
      where not exists (
        select 1 from public.test_cases tc join public.sections s on s.id = tc.section_id
        where tc.id = x and s.test_suite_id = p_suite_id
      )
    ) then
      raise exception 'Every picked test case must belong to this suite';
    end if;
    select string_agg(coalesce(tc.code, tc.title) || ': ' || i.issue, ', ' order by tc.code)
    into v_issues
    from public.test_cases tc
    cross join lateral public.test_case_issues(tc.id) as i(issue)
    where tc.id = any(p_test_case_ids);
    if v_issues is not null then
      raise exception 'Only complete test cases can be tested: %', v_issues;
    end if;
  end if;

  if p_org_ids is null then
    select array_agg(id) into v_org_ids from public.organizations where type = 'client';
  else
    select array_agg(distinct x) into v_org_ids from unnest(p_org_ids) x;
  end if;
  if coalesce(cardinality(v_org_ids), 0) = 0 then
    raise exception 'Pick at least one participating organization';
  end if;
  if exists (select 1 from unnest(v_org_ids) x where not exists (select 1 from public.organizations where id = x)) then
    raise exception 'Every participating organization must exist';
  end if;

  -- Reopening a signed-off suite revokes (but keeps) its sign-off. Planning a
  -- new round against a signed-off suite still invalidates that approval,
  -- even though creating the round no longer forces the suite into testing.
  if v_suite_status = 'signed_off' then
    update public.suite_sign_offs
    set revoked_at = now(), revoked_by = p_created_by
    where testing_suite_id = p_suite_id and revoked_at is null;
  end if;

  select coalesce(max(iteration_number), 0) + 1 into v_number
  from public.test_iterations
  where testing_suite_id = p_suite_id;

  v_name := 'User Acceptance Test ' || lpad(v_number::text, 2, '0');

  insert into public.test_iterations (testing_suite_id, iteration_number, name, slug, label, planned_end_date, created_by, scope_test_case_ids, status)
  values (p_suite_id, v_number, v_name, public.slugify(v_name),
          nullif(btrim(p_label), ''), p_planned_end_date, p_created_by, p_test_case_ids, 'not_started')
  returning * into v_iteration;

  insert into public.iteration_participants (iteration_id, organization_id)
  select v_iteration.id, x from unnest(v_org_ids) x;

  perform public.sync_iteration(v_iteration.id, p_test_case_ids);

  if not exists (select 1 from public.test_case_results where iteration_id = v_iteration.id) then
    raise exception 'No complete test cases to copy into the iteration';
  end if;

  -- An org whose audience matches none of the picked cases would have nothing to test.
  select string_agg(o.name, ', ' order by o.name) into v_empty_orgs
  from public.iteration_participants p
  join public.organizations o on o.id = p.organization_id
  where p.iteration_id = v_iteration.id
    and not exists (select 1 from public.test_case_results cr where cr.iteration_id = v_iteration.id and cr.organization_id = p.organization_id);
  if v_empty_orgs is not null then
    raise exception 'No picked test cases are meant for: %', v_empty_orgs;
  end if;

  -- Iteration creation is planning, not execution: the round is not_started
  -- and the suite stays where it was until begin_iteration starts testing.
  return v_iteration;
end;
$function$;

-- The execution step: testing starts now, so started_at is reset to this moment.
create function public.begin_iteration(p_iteration_id uuid)
 returns public.test_iterations
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_iteration public.test_iterations;
begin
  perform public.assert_can('run_iteration');

  update public.test_iterations
  set status = 'in_progress', started_at = now()
  where id = p_iteration_id and status = 'not_started'
  returning * into v_iteration;

  if v_iteration.id is null then
    raise exception 'Iteration % has already been started', p_iteration_id;
  end if;

  update public.testing_suites
  set status = 'in_testing'
  where id = v_iteration.testing_suite_id and status in ('ready', 'signed_off');

  return v_iteration;
end;
$function$;

-- Ends a running round early. Its results stay as recorded but it isn't a
-- completed round, so sign-off never uses it.
create function public.stop_iteration(p_iteration_id uuid)
 returns public.test_iterations
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_iteration public.test_iterations;
begin
  perform public.assert_can('run_iteration');

  update public.test_iterations
  set status = 'stopped', completed_at = now()
  where id = p_iteration_id and status = 'in_progress'
  returning * into v_iteration;

  if v_iteration.id is null then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;
  return v_iteration;
end;
$function$;

revoke execute on function public.begin_iteration(uuid) from public, anon;
revoke execute on function public.stop_iteration(uuid) from public, anon;
grant execute on function public.begin_iteration(uuid) to authenticated;
grant execute on function public.stop_iteration(uuid) to authenticated;

create or replace function public.cancel_iteration(p_iteration_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
begin
  perform public.assert_can('run_iteration');

  select testing_suite_id into v_suite_id
  from public.test_iterations
  where id = p_iteration_id and status in ('not_started', 'in_progress')
  for update;

  if v_suite_id is null then
    raise exception 'Only a planned or running iteration can be cancelled';
  end if;

  if exists (
    select 1 from public.test_case_results cr
    where cr.iteration_id = p_iteration_id and public.case_result_has_results(cr.id)
  ) then
    raise exception 'Iteration already has recorded results; complete or stop it instead';
  end if;

  delete from public.test_iterations where id = p_iteration_id; -- cascades snapshot rows

  if not exists (select 1 from public.test_iterations where testing_suite_id = v_suite_id) then
    update public.testing_suites set status = 'ready' where id = v_suite_id;
  end if;
end;
$function$;

-- Snapshot maintenance (sync, scope, participants) works on any open round.
create or replace function public.sync_iteration(p_iteration_id uuid, p_test_case_ids uuid[] default null, p_org_ids uuid[] default null)
 returns setof uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
begin
  select testing_suite_id into v_suite_id
  from public.test_iterations
  where id = p_iteration_id and status in ('not_started', 'in_progress');

  if v_suite_id is null then
    raise exception 'Iteration % is not open', p_iteration_id;
  end if;

  return query
  with new_cases as (
    insert into public.test_case_results
      (iteration_id, organization_id, test_case_id, code, title, section_name, section_slug, section_order, order_index, role_assignee, priority, preconditions, source_hash)
    select p_iteration_id, p.organization_id, tc.id, tc.code, tc.title, s.name, s.slug, s.order_index, tc.order_index, tc.role_assignee, tc.priority,
      public.case_preconditions_json(tc.id), public.test_case_content_hash(tc.id)
    from public.iteration_participants p
    join public.organizations o on o.id = p.organization_id
    cross join public.test_cases tc
    join public.sections s on s.id = tc.section_id
    where p.iteration_id = p_iteration_id
      and (p_org_ids is null or p.organization_id = any(p_org_ids))
      and s.test_suite_id = v_suite_id
      and (p_test_case_ids is null or tc.id = any(p_test_case_ids))
      and public.org_sees_audience(o.type, tc.audience)
      and not exists (select 1 from public.test_case_issues(tc.id))
    on conflict (iteration_id, test_case_id, organization_id) do nothing
    returning id, test_case_id
  ),
  new_steps as (
    insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
    select nc.id, ts.id, ts.order_index, ts.step, public.step_expected_results_json(ts.id)
    from new_cases nc
    join public.test_steps ts on ts.test_case_id = nc.test_case_id
  )
  select nc.id from new_cases nc;
end;
$function$;

create or replace function public.apply_iteration_sync(p_iteration_id uuid, p_by uuid default null, p_add uuid[] default '{}'::uuid[], p_refresh uuid[] default '{}'::uuid[], p_remove uuid[] default '{}'::uuid[])
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_new_ids uuid[];
  v_id uuid;
begin
  perform public.assert_can('sync');

  if not exists (select 1 from public.test_iterations where id = p_iteration_id and status in ('not_started', 'in_progress')) then
    raise exception 'Iteration % is not open', p_iteration_id;
  end if;

  -- Collect the new ids first: an UPDATE in the same statement wouldn't see rows the function inserts.
  if cardinality(coalesce(p_add, '{}')) > 0 then
    select coalesce(array_agg(x), '{}') into v_new_ids from public.sync_iteration(p_iteration_id, p_add) x;
    update public.test_case_results
    set sync_kind = 'added', synced_at = now(), synced_by = p_by
    where id = any(v_new_ids);
  end if;

  foreach v_id in array coalesce(p_refresh, '{}') loop
    if not exists (select 1 from public.test_case_results where id = v_id and iteration_id = p_iteration_id) then
      raise exception 'Case result % does not belong to this iteration', v_id;
    end if;
    perform public.refresh_case_result(v_id); -- rejects rows with results
    update public.test_case_results
    set sync_kind = 'updated', synced_at = now(), synced_by = p_by
    where id = v_id;
  end loop;

  foreach v_id in array coalesce(p_remove, '{}') loop
    if not exists (select 1 from public.test_case_results where id = v_id and iteration_id = p_iteration_id) then
      raise exception 'Case result % does not belong to this iteration', v_id;
    end if;
    perform public.remove_case_result(v_id); -- rejects rows with results
  end loop;
end;
$function$;

create or replace function public.refresh_case_result_internal(p_case_result_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_test_case_id uuid;
begin
  select cr.test_case_id into v_test_case_id
  from public.test_case_results cr
  join public.test_iterations i on i.id = cr.iteration_id
  where cr.id = p_case_result_id and i.status in ('not_started', 'in_progress');

  if not found then
    raise exception 'Case result % is not in an open iteration', p_case_result_id;
  end if;
  if v_test_case_id is null then
    raise exception 'Test case for result % no longer exists', p_case_result_id;
  end if;

  delete from public.test_step_results where test_case_result_id = p_case_result_id; -- cascades remarks

  update public.test_case_results cr
  set code = tc.code, title = tc.title, section_name = s.name, section_slug = s.slug, section_order = s.order_index,
      order_index = tc.order_index, role_assignee = tc.role_assignee, priority = tc.priority,
      preconditions = public.case_preconditions_json(tc.id), source_hash = public.test_case_content_hash(tc.id),
      status = 'Untested', status_overridden = false, executed_by = null, completed_at = null
  from public.test_cases tc join public.sections s on s.id = tc.section_id
  where cr.id = p_case_result_id and tc.id = v_test_case_id;

  insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
  select p_case_result_id, ts.id, ts.order_index, ts.step, public.step_expected_results_json(ts.id)
  from public.test_steps ts where ts.test_case_id = v_test_case_id;
end;
$function$;

create or replace function public.remove_case_result(p_case_result_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if public.case_result_has_results(p_case_result_id) then
    raise exception 'Case result % already has results and stays in this iteration', p_case_result_id;
  end if;

  delete from public.test_case_results cr
  using public.test_iterations i
  where cr.id = p_case_result_id and i.id = cr.iteration_id and i.status in ('not_started', 'in_progress');

  if not found then
    raise exception 'Case result % is not in an open iteration', p_case_result_id;
  end if;
end;
$function$;

create or replace function public.add_iteration_participant(p_iteration_id uuid, p_org_id uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
  v_started_at timestamptz;
  v_scope uuid[];
  v_case_ids uuid[];
  v_count integer;
begin
  perform public.assert_can('run_iteration');

  select testing_suite_id, started_at, scope_test_case_ids into v_suite_id, v_started_at, v_scope
  from public.test_iterations
  where id = p_iteration_id and status in ('not_started', 'in_progress')
  for update;
  if v_suite_id is null then
    raise exception 'Iteration % is not open', p_iteration_id;
  end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'Organization % not found', p_org_id;
  end if;

  insert into public.iteration_participants (iteration_id, organization_id)
  values (p_iteration_id, p_org_id)
  on conflict do nothing;
  if not found then
    raise exception 'This organization is already taking part in the iteration';
  end if;

  select coalesce(array_agg(tc.id), '{}') into v_case_ids
  from public.test_cases tc
  join public.sections s on s.id = tc.section_id
  where s.test_suite_id = v_suite_id
    and (
      (v_scope is null and tc.created_at <= v_started_at)
      or tc.id = any(coalesce(v_scope, '{}'))
      or exists (select 1 from public.test_case_results cr where cr.iteration_id = p_iteration_id and cr.test_case_id = tc.id)
    );

  select count(*) into v_count from public.sync_iteration(p_iteration_id, v_case_ids, array[p_org_id]);
  return v_count;
end;
$function$;

create or replace function public.sign_off_suite(p_suite_id uuid, p_by uuid default null, p_note text default null)
 returns public.suite_sign_offs
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_status public.suite_status;
  v_iteration_id uuid;
  v_counts jsonb;
  v_total int;
  v_passed int;
  v_sign_off public.suite_sign_offs;
begin
  perform public.assert_can('sign_off');

  select status into v_status from public.testing_suites where id = p_suite_id for update;
  if v_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_status <> 'in_testing' then
    raise exception 'Only a suite in testing can be signed off (current: %)', v_status;
  end if;
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status in ('not_started', 'in_progress')) then
    raise exception 'Complete or cancel the open iteration before signing off';
  end if;

  select id into v_iteration_id
  from public.test_iterations
  where testing_suite_id = p_suite_id and status = 'completed'
  order by iteration_number desc
  limit 1;

  if v_iteration_id is null then
    raise exception 'At least one completed iteration is required to sign off';
  end if;

  select count(*), count(*) filter (where status = 'Passed'),
         jsonb_build_object(
           'total', count(*),
           'passed', count(*) filter (where status = 'Passed'),
           'failed', count(*) filter (where status = 'Failed'),
           'blocked', count(*) filter (where status = 'Blocked'),
           'in_progress', count(*) filter (where status = 'In Progress'),
           'untested', count(*) filter (where status = 'Untested')
         )
  into v_total, v_passed, v_counts
  from public.test_case_results where iteration_id = v_iteration_id;

  if v_passed < v_total and coalesce(btrim(p_note), '') = '' then
    raise exception 'A note is required to sign off with exceptions (% of % passed)', v_passed, v_total;
  end if;

  insert into public.suite_sign_offs (testing_suite_id, iteration_id, signed_off_by, note, exceptions)
  values (p_suite_id, v_iteration_id, p_by, nullif(btrim(p_note), ''), v_counts)
  returning * into v_sign_off;

  update public.testing_suites set status = 'signed_off' where id = p_suite_id;
  return v_sign_off;
end;
$function$;
