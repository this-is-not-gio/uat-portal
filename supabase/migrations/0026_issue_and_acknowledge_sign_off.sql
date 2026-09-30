-- Two-step sign-off (replaces the one-step, client-only sign_off_suite):
--   in_testing --issue_sign_off (Admin)--> sign_off_issued --acknowledge_sign_off (Internal)--> signed_off
-- Issuing needs every round finished (none planned or running) and at least one completed round.
-- Untested cases are only a warning (UI), so the note is optional.
-- Starting a new round while a sign-off is issued or acknowledged revokes it (kept as history).

alter table public.suite_sign_offs
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references public.profiles (id);

-- issue_sign_off is the vendor's; 'sign_off' (the client's) now means acknowledging it.
create or replace function public.assert_can(p_action text)
returns void
language plpgsql
stable security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_role_();
  v_allowed boolean;
begin
  case p_action
    when 'author' then v_allowed := v_role = 'Admin';
    when 'archive' then v_allowed := v_role = 'Admin';
    when 'sync' then v_allowed := v_role = 'Admin'; -- its my own judgment and dont change it
    when 'run_iteration' then v_allowed := v_role in ('Admin', 'Internal');
    when 'issue_sign_off' then v_allowed := v_role = 'Admin';
    when 'sign_off' then v_allowed := v_role = 'Internal';
    when 'submit' then v_allowed := v_role in ('Internal', 'External');
    else v_allowed := false;
  end case;
  if not coalesce(v_allowed, false) then
    raise exception 'forbidden: %', p_action using errcode = '42501';
  end if;
end;
$$;

drop function if exists public.sign_off_suite(uuid, uuid, text);

create or replace function public.issue_sign_off(p_suite_id uuid, p_by uuid default null, p_note text default null)
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

  insert into public.suite_sign_offs (testing_suite_id, iteration_id, signed_off_by, note, exceptions)
  values (p_suite_id, v_iteration_id, p_by, nullif(btrim(p_note), ''), v_counts)
  returning * into v_sign_off;

  update public.testing_suites set status = 'sign_off_issued' where id = p_suite_id;
  return v_sign_off;
end;
$$;

create or replace function public.acknowledge_sign_off(p_suite_id uuid, p_by uuid default null)
returns public.suite_sign_offs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.suite_status;
  v_sign_off public.suite_sign_offs;
begin
  perform public.assert_can('sign_off');

  select status into v_status from public.testing_suites where id = p_suite_id for update;
  if v_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_status <> 'sign_off_issued' then
    raise exception 'There is no issued sign-off to acknowledge (current: %)', v_status;
  end if;
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status in ('not_started', 'in_progress')) then
    raise exception 'A new round has been planned since the sign-off was issued';
  end if;

  update public.suite_sign_offs
  set acknowledged_at = now(), acknowledged_by = p_by
  where testing_suite_id = p_suite_id and revoked_at is null and acknowledged_at is null
  returning * into v_sign_off;
  if v_sign_off.id is null then
    raise exception 'There is no issued sign-off to acknowledge';
  end if;

  update public.testing_suites set status = 'signed_off' where id = p_suite_id;
  return v_sign_off;
end;
$$;

revoke execute on function public.issue_sign_off(uuid, uuid, text) from public, anon;
revoke execute on function public.acknowledge_sign_off(uuid, uuid) from public, anon;
grant execute on function public.issue_sign_off(uuid, uuid, text) to authenticated;
grant execute on function public.acknowledge_sign_off(uuid, uuid) to authenticated;

-- An issued sign-off locks authoring like an acknowledged one.
create or replace function public.assert_suite_editable(p_suite_id uuid)
returns public.suite_status
language plpgsql
stable
set search_path = ''
as $$
declare
  v_status public.suite_status;
begin
  select status into v_status from public.testing_suites where id = p_suite_id;
  if v_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_status in ('sign_off_issued', 'signed_off', 'archived') then
    raise exception 'Testing suite is % and can no longer be edited', v_status;
  end if;
  return v_status;
end;
$$;

-- Starting a round from an issued or acknowledged sign-off moves the suite back into testing.
create or replace function public.begin_iteration(p_iteration_id uuid)
returns public.test_iterations
language plpgsql
security definer
set search_path = ''
as $$
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
  where id = v_iteration.testing_suite_id and status in ('ready', 'sign_off_issued', 'signed_off');

  return v_iteration;
end;
$$;

create or replace function public.start_iteration(p_suite_id uuid, p_created_by uuid default null, p_label text default null, p_planned_end_date date default null, p_test_case_ids uuid[] default null, p_org_ids uuid[] default null)
returns public.test_iterations
language plpgsql
security definer
set search_path = ''
as $$
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
  if v_suite_status not in ('ready', 'in_testing', 'sign_off_issued', 'signed_off') then
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

  -- Reopening an issued or signed-off suite revokes (but keeps) its sign-off. Planning a
  -- new round still invalidates that approval, even though creating the round no longer
  -- forces the suite into testing.
  if v_suite_status in ('sign_off_issued', 'signed_off') then
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
$$;

-- Internal sees suites from testing onward, including one waiting for its acknowledgement.
create or replace function public.get_sidebar_suites()
returns table(suite_id uuid, name text, slug text, code text, status public.suite_status, open_iteration_number integer, open_iteration_name text, open_iteration_status public.iteration_status, open_planned_end date, my_in_open_round boolean, my_submitted_at timestamptz, my_remaining integer, my_ever_participated boolean)
language sql
stable
set search_path = ''
as $$
  with open_round as (
    select i.id, i.testing_suite_id, i.iteration_number, i.name, i.status, i.planned_end_date
    from public.test_iterations i
    where i.status in ('not_started', 'in_progress')
  ),
  my_open as (
    select p.iteration_id, p.submitted_at
    from public.iteration_participants p
    where p.organization_id = public.current_org_id()
  ),
  my_remaining as (
    select cr.iteration_id, count(*)::int as remaining
    from public.test_case_results cr
    where cr.organization_id = public.current_org_id()
      and cr.status in ('Untested', 'In Progress')
    group by cr.iteration_id
  ),
  base as (
    select
      s.id as suite_id,
      s.name,
      s.slug,
      s.code,
      s.status,
      o.iteration_number as open_iteration_number,
      o.name as open_iteration_name,
      o.status as open_iteration_status,
      o.planned_end_date as open_planned_end,
      (mo.iteration_id is not null) as my_in_open_round,
      mo.submitted_at as my_submitted_at,
      coalesce(mr.remaining, 0) as my_remaining,
      exists (
        select 1
        from public.iteration_participants p
        join public.test_iterations i on i.id = p.iteration_id
        where i.testing_suite_id = s.id
          and p.organization_id = public.current_org_id()
      ) as my_ever_participated
    from public.testing_suites s
    left join open_round o on o.testing_suite_id = s.id
    left join my_open mo on mo.iteration_id = o.id
    left join my_remaining mr on mr.iteration_id = o.id
  )
  select *
  from base
  where case
    when public.current_role_() = 'Admin' then true
    when public.current_role_() = 'Internal' then status in ('in_testing', 'sign_off_issued', 'signed_off', 'archived')
    when public.current_role_() = 'External' then my_ever_participated
  end
  order by name;
$$;
