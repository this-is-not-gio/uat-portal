-- Round roster and per-tester copies (#8). A round's participants are individual testers,
-- not organizations:
--   * Planning: the round's scope is one test_case_results "scope row" per case (tester_id and
--     organization_id null). Staff untick testers they don't want (iteration_excluded_testers);
--     everyone else holding an in-scope role in a client/external org is in by default.
--   * get_round_coverage / get_iteration_coverage list the roles the scope needs, the orgs and
--     users per role (ticked or not), cases with no role and roles nobody can test.
--   * Start (begin_iteration) is rejected while a role in scope has no ticked tester or a case
--     in scope has no role. It then fixes the roster (iteration_testers) and replaces each
--     included scope row with one copy per active tester of that case's role.
--   * Case-content sync applies to every copy of a case.
-- Submission stays per organization: submitting stamps every active tester row of the org.
-- Existing rounds and results are deleted, not migrated (cases, sections, suites, accounts stay).

-- ---------------------------------------------------------------------------
-- Wipe rounds (cascades results, step results, archives, participants, sign-offs)
-- ---------------------------------------------------------------------------

delete from public.test_iterations;
update public.testing_suites set status = 'ready'
where status in ('in_testing', 'for_sign_off', 'sign_off_issued', 'sign_off_rejected', 'signed_off');

-- ---------------------------------------------------------------------------
-- Retire the org-level participant model
-- ---------------------------------------------------------------------------

drop function public.add_iteration_participant(uuid, uuid, uuid[]);
drop function public.set_participant_roles(uuid, uuid, uuid[]);
drop function public.assign_participant_roles(uuid, uuid, uuid[]);
drop function public.remove_iteration_participant(uuid, uuid);
drop function public.participant_tests_case(uuid, uuid, uuid);
drop function public.iteration_scope_case_ids(uuid);
drop function public.sync_iteration(uuid, uuid[], uuid[]);
drop function public.submit_participation(uuid);
drop function public.withdraw_participation(uuid);

drop policy "iterations: staff or participating org" on public.test_iterations;
drop policy "test accounts: staff or participating org" on public.suite_test_accounts;
drop policy "overview sections: staff or participating org" on public.suite_overview_sections;
drop policy "endpoints: staff or participating org" on public.suite_endpoints;

alter table public.test_case_results drop constraint test_case_results_participant_fkey;
alter table public.test_case_results drop constraint test_case_results_iteration_case_org_key;
drop table public.iteration_participant_roles;
drop table public.iteration_participants;

-- ---------------------------------------------------------------------------
-- Roster
-- ---------------------------------------------------------------------------

-- Who tests the round, fixed at Start. One row per user; their role and org as of Start.
-- dropped: reserved for roster sync (#12), copies are kept.
create table public.iteration_testers (
  iteration_id uuid not null references public.test_iterations(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  test_role_id uuid not null references public.test_roles(id),
  organization_id uuid not null references public.organizations(id),
  status text not null default 'active' check (status in ('active', 'dropped')),
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (iteration_id, user_id)
);
create index iteration_testers_user_id_idx on public.iteration_testers (user_id);
create index iteration_testers_test_role_id_idx on public.iteration_testers (test_role_id);
create index iteration_testers_organization_id_idx on public.iteration_testers (organization_id);

alter table public.iteration_testers enable row level security;
create policy "testers: staff or own org" on public.iteration_testers
  for select using ((select public.can_see_all_results()) or organization_id = (select public.current_org_id()));

-- Users staff unticked while planning. Everyone else holding an in-scope role is ticked.
create table public.iteration_excluded_testers (
  iteration_id uuid not null references public.test_iterations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (iteration_id, user_id)
);
create index iteration_excluded_testers_user_id_idx on public.iteration_excluded_testers (user_id);

alter table public.iteration_excluded_testers enable row level security;
create policy "excluded testers: staff" on public.iteration_excluded_testers
  for select using ((select public.can_see_all_results()));

-- ---------------------------------------------------------------------------
-- Results: scope rows (no tester) before Start, one copy per tester after
-- ---------------------------------------------------------------------------

alter table public.test_case_results
  add column tester_id uuid,
  alter column organization_id drop not null,
  add constraint test_case_results_organization_id_fkey foreign key (organization_id) references public.organizations(id),
  add constraint test_case_results_tester_fkey foreign key (iteration_id, tester_id)
    references public.iteration_testers(iteration_id, user_id) on delete cascade,
  add constraint test_case_results_tester_org_check check ((tester_id is null) = (organization_id is null)),
  add constraint test_case_results_iteration_case_tester_key unique (iteration_id, test_case_id, tester_id);
create unique index test_case_results_scope_key on public.test_case_results (iteration_id, test_case_id) where tester_id is null;
create index test_case_results_tester_id_idx on public.test_case_results (tester_id);

-- Visibility by participation now reads the roster.
create policy "iterations: staff or participating org" on public.test_iterations
  for select using (
    (select public.can_see_all_results())
    or exists (select 1 from public.iteration_testers t
               where t.iteration_id = test_iterations.id and t.organization_id = (select public.current_org_id()))
  );
create policy "test accounts: staff or participating org" on public.suite_test_accounts
  for select using (
    (select public.can_see_all_results())
    or exists (select 1 from public.iteration_testers t join public.test_iterations ti on ti.id = t.iteration_id
               where ti.testing_suite_id = suite_test_accounts.testing_suite_id and t.organization_id = (select public.current_org_id()))
  );
create policy "overview sections: staff or participating org" on public.suite_overview_sections
  for select using (
    (select public.can_see_all_results())
    or exists (select 1 from public.iteration_testers t join public.test_iterations ti on ti.id = t.iteration_id
               where ti.testing_suite_id = suite_overview_sections.testing_suite_id and t.organization_id = (select public.current_org_id()))
  );
create policy "endpoints: staff or participating org" on public.suite_endpoints
  for select using (
    (select public.can_see_all_results())
    or exists (select 1 from public.iteration_testers t join public.test_iterations ti on ti.id = t.iteration_id
               where ti.testing_suite_id = suite_endpoints.testing_suite_id and t.organization_id = (select public.current_org_id()))
  );

-- ---------------------------------------------------------------------------
-- Coverage
-- ---------------------------------------------------------------------------

-- p_cases: [{id, code, title, test_role_id}]. Candidates are users of client/external orgs
-- holding a role the scope needs. Shape:
-- { roles: [{testRoleId, name, caseCount, availableCount, tickedCount,
--            orgs: [{organizationId, name, type, users: [{userId, fullName, ticked}]}]}],
--   casesWithoutRole: [{testCaseId, code, title}],
--   rolesWithoutUsers: [{testRoleId, name}],     -- nobody holds the role
--   rolesWithoutTesters: [{testRoleId, name}],   -- nobody ticked (includes the above)
--   canStart: boolean }
create function public.round_coverage(p_cases jsonb, p_excluded_user_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with scope as (
    select (c->>'id')::uuid as id, c->>'code' as code, c->>'title' as title, (c->>'test_role_id')::uuid as test_role_id
    from jsonb_array_elements(coalesce(p_cases, '[]'::jsonb)) c
  ),
  needed as (
    select s.test_role_id, tr.name, count(*)::int as case_count
    from scope s join public.test_roles tr on tr.id = s.test_role_id
    group by s.test_role_id, tr.name
  ),
  candidates as (
    select r.test_role_id, o.id as org_id, o.name as org_name, o.type as org_type, p.id as user_id, p.full_name,
           not (p.id = any(coalesce(p_excluded_user_ids, '{}'))) as ticked
    from public.profiles p
    join public.organization_roles r on r.id = p.org_role_id
    join public.organizations o on o.id = r.organization_id
    where o.type <> 'vendor' and r.test_role_id in (select test_role_id from needed)
  ),
  orgs as (
    select c.test_role_id, c.org_id, c.org_name,
      jsonb_build_object(
        'organizationId', c.org_id, 'name', c.org_name, 'type', c.org_type,
        'users', jsonb_agg(jsonb_build_object('userId', c.user_id, 'fullName', c.full_name, 'ticked', c.ticked) order by c.full_name)
      ) as org
    from candidates c
    group by c.test_role_id, c.org_id, c.org_name, c.org_type
  ),
  roles as (
    select n.test_role_id, n.name, n.case_count,
      (select count(*)::int from candidates c where c.test_role_id = n.test_role_id) as available,
      (select count(*)::int from candidates c where c.test_role_id = n.test_role_id and c.ticked) as ticked,
      coalesce((select jsonb_agg(o.org order by o.org_name) from orgs o where o.test_role_id = n.test_role_id), '[]'::jsonb) as orgs
    from needed n
  ),
  roleless as (
    select coalesce(jsonb_agg(jsonb_build_object('testCaseId', s.id, 'code', s.code, 'title', s.title) order by s.code, s.title), '[]'::jsonb) as list,
           count(*) as n
    from scope s where s.test_role_id is null or not exists (select 1 from public.test_roles tr where tr.id = s.test_role_id)
  )
  select jsonb_build_object(
    'roles', coalesce((select jsonb_agg(jsonb_build_object(
        'testRoleId', r.test_role_id, 'name', r.name, 'caseCount', r.case_count,
        'availableCount', r.available, 'tickedCount', r.ticked, 'orgs', r.orgs) order by r.name) from roles r), '[]'::jsonb),
    'casesWithoutRole', (select list from roleless),
    'rolesWithoutUsers', coalesce((select jsonb_agg(jsonb_build_object('testRoleId', r.test_role_id, 'name', r.name) order by r.name)
        from roles r where r.available = 0), '[]'::jsonb),
    'rolesWithoutTesters', coalesce((select jsonb_agg(jsonb_build_object('testRoleId', r.test_role_id, 'name', r.name) order by r.name)
        from roles r where r.ticked = 0), '[]'::jsonb),
    'canStart', exists (select 1 from scope)
      and (select n from roleless) = 0
      and not exists (select 1 from roles r where r.ticked = 0)
  );
$$;
revoke execute on function public.round_coverage(jsonb, uuid[]) from public, anon, authenticated;

-- Coverage for a candidate scope of live cases (the round wizard, #11).
create function public.get_round_coverage(p_suite_id uuid, p_test_case_ids uuid[], p_excluded_user_ids uuid[] default '{}')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_can('run_iteration');
  return public.round_coverage(
    (select coalesce(jsonb_agg(jsonb_build_object('id', tc.id, 'code', tc.code, 'title', tc.title, 'test_role_id', tc.test_role_id)), '[]'::jsonb)
     from public.test_cases tc join public.sections s on s.id = tc.section_id
     where s.test_suite_id = p_suite_id and tc.id = any(coalesce(p_test_case_ids, '{}'))),
    p_excluded_user_ids
  );
end;
$$;

-- The round's scope as it would run (its included scope rows, as snapshotted).
create function public.iteration_scope_cases(p_iteration_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', cr.test_case_id, 'code', cr.code, 'title', cr.title, 'test_role_id', cr.test_role_id)), '[]'::jsonb)
  from public.test_case_results cr
  where cr.iteration_id = p_iteration_id and cr.tester_id is null and cr.included_in_run and cr.test_case_id is not null;
$$;
revoke execute on function public.iteration_scope_cases(uuid) from public, anon, authenticated;

-- Coverage of a planned round: its scope and its unticked users.
create function public.get_iteration_coverage(p_iteration_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_can('run_iteration');
  return public.round_coverage(
    public.iteration_scope_cases(p_iteration_id),
    (select coalesce(array_agg(user_id), '{}') from public.iteration_excluded_testers where iteration_id = p_iteration_id)
  );
end;
$$;

-- Ticks / unticks users for a planned round.
create function public.set_iteration_testers_excluded(p_iteration_id uuid, p_user_ids uuid[], p_excluded boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can('run_iteration');
  perform 1 from public.test_iterations where id = p_iteration_id and status = 'not_started' for update;
  if not found then
    raise exception 'This round has already started, so its testers are fixed.' using errcode = 'P0001';
  end if;

  if p_excluded then
    insert into public.iteration_excluded_testers (iteration_id, user_id)
    select p_iteration_id, x.id from unnest(coalesce(p_user_ids, '{}')) as x(id)
    on conflict do nothing;
  else
    delete from public.iteration_excluded_testers
    where iteration_id = p_iteration_id and user_id = any(coalesce(p_user_ids, '{}'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scope: sync adds scope rows (planned rounds only; a running round's case set is locked)
-- ---------------------------------------------------------------------------

create function public.sync_iteration(p_iteration_id uuid, p_test_case_ids uuid[] default null)
returns setof uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suite_id uuid;
begin
  select testing_suite_id into v_suite_id
  from public.test_iterations
  where id = p_iteration_id and status = 'not_started';

  if v_suite_id is null then
    raise exception 'Iteration % is not planned', p_iteration_id;
  end if;

  return query
  with new_cases as (
    insert into public.test_case_results
      (iteration_id, test_case_id, code, title, section_name, section_slug, section_order, order_index, test_role_id, priority, preconditions, source_hash)
    select p_iteration_id, tc.id, tc.code, tc.title, s.name, s.slug, s.order_index, tc.order_index, tc.test_role_id, tc.priority,
      public.case_preconditions_json(tc.id), public.test_case_content_hash(tc.id)
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    where s.test_suite_id = v_suite_id
      and (p_test_case_ids is null or tc.id = any(p_test_case_ids))
      and not exists (select 1 from public.test_case_issues(tc.id))
    on conflict (iteration_id, test_case_id) where tester_id is null do nothing
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
$$;

-- The rows that are "the same case" in a round as this one: every tester's copy (or the
-- single scope row). A deleted case's copies have no test_case_id, so they match on code + title.
create function public.case_result_siblings(p_case_result_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select cr.id
  from public.test_case_results me
  join public.test_case_results cr on cr.iteration_id = me.iteration_id
    and (me.tester_id is null) = (cr.tester_id is null)
    and case when me.test_case_id is not null then cr.test_case_id = me.test_case_id
             else cr.test_case_id is null and cr.code is not distinct from me.code and cr.title = me.title end
  where me.id = p_case_result_id;
$$;
revoke execute on function public.case_result_siblings(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Start: gate on coverage, fix the roster, one copy per (tester, case of their role)
-- ---------------------------------------------------------------------------

create or replace function public.begin_iteration(p_iteration_id uuid)
returns public.test_iterations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iteration public.test_iterations;
  v_coverage jsonb;
  v_list text;
begin
  perform public.assert_can('run_iteration');

  select * into v_iteration from public.test_iterations where id = p_iteration_id for update;
  if v_iteration.id is null then
    raise exception 'Iteration % not found', p_iteration_id;
  end if;
  if v_iteration.status <> 'not_started' then
    raise exception 'Iteration % has already been started', p_iteration_id;
  end if;

  if not exists (select 1 from public.test_case_results where iteration_id = p_iteration_id and tester_id is null and included_in_run) then
    raise exception 'Add at least one section before starting this iteration' using errcode = 'P0001';
  end if;

  v_coverage := public.round_coverage(
    public.iteration_scope_cases(p_iteration_id),
    (select coalesce(array_agg(user_id), '{}') from public.iteration_excluded_testers where iteration_id = p_iteration_id)
  );
  select string_agg(concat_ws(' ', c->>'code', c->>'title'), ', ') into v_list from jsonb_array_elements(v_coverage->'casesWithoutRole') c;
  if v_list is not null then
    raise exception 'Every test case needs a test role before the round can start. No role: %', v_list using errcode = 'P0001';
  end if;
  select string_agg(r->>'name', ', ') into v_list from jsonb_array_elements(v_coverage->'rolesWithoutTesters') r;
  if v_list is not null then
    raise exception 'Every test role in scope needs at least one tester. No tester for: %', v_list using errcode = 'P0001';
  end if;

  -- The roster: every ticked user holding a role the scope needs.
  insert into public.iteration_testers (iteration_id, user_id, test_role_id, organization_id)
  select p_iteration_id, (u->>'userId')::uuid, (r->>'testRoleId')::uuid, (o->>'organizationId')::uuid
  from jsonb_array_elements(v_coverage->'roles') r
  cross join jsonb_array_elements(r->'orgs') o
  cross join jsonb_array_elements(o->'users') u
  where (u->>'ticked')::boolean;

  -- A copy of each included scope row for every tester of its role, steps included.
  with src as (
    select cr.* from public.test_case_results cr
    where cr.iteration_id = p_iteration_id and cr.tester_id is null and cr.included_in_run and cr.test_case_id is not null
  ),
  copies as (
    insert into public.test_case_results
      (iteration_id, organization_id, tester_id, test_case_id, code, title, section_name, section_slug, section_order, order_index, test_role_id, priority, preconditions, source_hash)
    select src.iteration_id, t.organization_id, t.user_id, src.test_case_id, src.code, src.title, src.section_name, src.section_slug, src.section_order,
      src.order_index, src.test_role_id, src.priority, src.preconditions, src.source_hash
    from src
    join public.iteration_testers t on t.iteration_id = src.iteration_id and t.test_role_id = src.test_role_id and t.status = 'active'
    returning id, test_case_id
  )
  insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
  select c.id, sr.test_step_id, sr.order_index, sr.step, sr.expected_results
  from copies c
  join src on src.test_case_id = c.test_case_id
  join public.test_step_results sr on sr.test_case_result_id = src.id;

  -- Excluded rows stay to show what's left out, except in sections that run nothing (0032).
  delete from public.test_case_results cr
  where cr.iteration_id = p_iteration_id and cr.tester_id is null
    and (cr.included_in_run or cr.test_case_id is null or cr.section_slug is null or not exists (
      select 1 from public.test_case_results kept
      where kept.iteration_id = p_iteration_id and kept.tester_id is null
        and kept.section_slug = cr.section_slug and kept.included_in_run
    ));

  update public.test_case_results
  set sync_kind = null, synced_at = null, synced_by = null
  where iteration_id = p_iteration_id and sync_kind is not null;

  update public.test_iterations
  set status = 'in_progress', started_at = now()
  where id = p_iteration_id
  returning * into v_iteration;

  update public.testing_suites
  set status = 'in_testing'
  where id = v_iteration.testing_suite_id and status in ('ready', 'sign_off_issued', 'signed_off');

  return v_iteration;
end;
$$;

-- Back to planned: each case's copies collapse into one scope row again and the roster is
-- released (unticked users stay unticked).
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

  update public.test_iterations set status = 'in_progress' where id = p_iteration_id;
  update public.iteration_testers set submitted_at = null where iteration_id = p_iteration_id;

  delete from public.test_remarks r
  using public.test_step_results sr, public.test_case_results cr
  where r.test_step_result_id = sr.id and sr.test_case_result_id = cr.id and cr.iteration_id = p_iteration_id;

  update public.test_step_results sr
  set status = 'Untested'
  from public.test_case_results cr
  where sr.test_case_result_id = cr.id and cr.iteration_id = p_iteration_id and sr.status <> 'Untested';

  update public.test_case_results
  set status = 'Untested', status_overridden = false, executed_by = null, completed_at = null
  where iteration_id = p_iteration_id;

  -- Copies of a deleted case can't be planned again.
  delete from public.test_case_results
  where iteration_id = p_iteration_id and tester_id is not null and test_case_id is null;

  -- Keep one copy per case as the scope row, drop the rest.
  with keep as (
    select distinct on (cr.test_case_id) cr.id
    from public.test_case_results cr
    where cr.iteration_id = p_iteration_id and cr.tester_id is not null
      and not exists (select 1 from public.test_case_results s where s.iteration_id = p_iteration_id and s.tester_id is null and s.test_case_id = cr.test_case_id)
    order by cr.test_case_id, cr.included_in_run desc, cr.id
  )
  update public.test_case_results cr
  set tester_id = null, organization_id = null
  from keep where cr.id = keep.id;

  delete from public.iteration_testers where iteration_id = p_iteration_id; -- cascades the other copies

  update public.test_iterations
  set status = 'not_started', completed_at = null
  where id = p_iteration_id
  returning * into v_iteration;

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

-- ---------------------------------------------------------------------------
-- Changes and sync: one row per case, applied to every copy
-- ---------------------------------------------------------------------------

-- organization_id / organization_name are kept for the signature and are always null now.
-- audience_changed (removed rows): the case still exists but its role is no longer the role
-- its testers were rostered for (running rounds only; a planned round just refreshes the role).
create or replace function public.get_iteration_changes(p_iteration_id uuid)
returns table(change text, test_case_id uuid, test_case_result_id uuid, code text, title text, has_results boolean, organization_id uuid, organization_name text, incomplete boolean, audience_changed boolean)
language sql
stable security definer
set search_path = ''
as $$
  with it as (
    select id, testing_suite_id, started_at, status from public.test_iterations where id = p_iteration_id
  ),
  me as (
    select public.can_see_all_results() as sees_all, public.current_org_id() as org_id
  ),
  live as (
    select tc.id, tc.code, tc.title, tc.created_at, tc.test_role_id
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    join it on it.testing_suite_id = s.test_suite_id
  ),
  active_rows as (
    select cr.*, public.case_result_has_results(cr.id) as has_results
    from public.test_case_results cr
    where cr.iteration_id = p_iteration_id
      and cr.sync_kind is distinct from 'removed' and cr.sync_kind is distinct from 'audience_changed'
  ),
  snap as (
    select
      coalesce(r.test_case_id::text, 'gone:' || coalesce(r.code, '') || ':' || r.title) as key,
      (array_agg(r.test_case_id))[1] as test_case_id,
      (array_agg(r.id order by r.id))[1] as rep_id,
      (array_agg(r.code))[1] as code,
      (array_agg(r.title))[1] as title,
      bool_or(r.has_results) as has_results,
      bool_or(r.source_hash is distinct from public.test_case_content_hash(r.test_case_id)) as stale,
      (array_agg(r.test_role_id))[1] as test_role_id,
      bool_or(r.organization_id = (select org_id from me)) as mine
    from active_rows r
    group by 1
  ),
  visible as (
    select snap.* from snap cross join me where me.sees_all or snap.mine
  )
  select 'added', l.id, null::uuid, l.code, l.title, false, null::uuid, null::text, false, false
  from live l cross join it cross join me
  where me.sees_all
    and not exists (select 1 from public.test_case_results cr where cr.iteration_id = p_iteration_id and cr.test_case_id = l.id)
    and l.created_at > it.started_at
    and not exists (select 1 from public.test_case_issues(l.id))
  union all
  select 'changed', v.test_case_id, v.rep_id, v.code, v.title, v.has_results, null, null,
    exists (select 1 from public.test_case_issues(v.test_case_id)), false
  from visible v
  join live l on l.id = v.test_case_id
  cross join it
  where v.stale
    and (it.status = 'not_started' or l.test_role_id is not distinct from v.test_role_id)
  union all
  select 'removed', v.test_case_id, v.rep_id, v.code, v.title, v.has_results, null, null, false, l.id is not null
  from visible v
  left join live l on l.id = v.test_case_id
  cross join it
  where l.id is null
    or (it.status <> 'not_started' and l.test_role_id is distinct from v.test_role_id)
$$;

-- p_refresh / p_remove take any one row of a case (get_iteration_changes' test_case_result_id)
-- and apply to all of that case's copies.
create or replace function public.apply_iteration_sync(p_iteration_id uuid, p_by uuid default null::uuid, p_add uuid[] default '{}'::uuid[], p_refresh uuid[] default '{}'::uuid[], p_remove uuid[] default '{}'::uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.iteration_status;
  v_new_ids uuid[];
  v_id uuid;
  v_sibling uuid;
  v_kind text;
  v_flagged integer;
begin
  perform public.assert_can('sync');

  select status into v_status from public.test_iterations where id = p_iteration_id;
  if v_status is null or v_status not in ('not_started', 'in_progress') then
    raise exception 'Iteration % is not open', p_iteration_id;
  end if;

  if v_status <> 'not_started' and cardinality(coalesce(p_add, '{}')) > 0 then
    raise exception 'This round has already started, so the test cases it runs are locked.' using errcode = 'P0001';
  end if;

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
    for v_sibling in
      select s.id from public.case_result_siblings(v_id) s(id)
      join public.test_case_results cr on cr.id = s.id
      where cr.sync_kind is distinct from 'removed' and cr.sync_kind is distinct from 'audience_changed'
        and not public.case_result_has_results(cr.id) -- tested copies need a force refresh
    loop
      perform public.refresh_case_result(v_sibling);
      update public.test_case_results
      set sync_kind = 'updated', synced_at = now(), synced_by = p_by
      where id = v_sibling;
    end loop;
  end loop;

  foreach v_id in array coalesce(p_remove, '{}') loop
    if not exists (select 1 from public.test_case_results where id = v_id and iteration_id = p_iteration_id) then
      raise exception 'Case result % does not belong to this iteration', v_id;
    end if;

    if v_status = 'not_started' then
      perform public.remove_case_result(v_id);
      continue;
    end if;

    v_flagged := 0;
    for v_sibling, v_kind in
      select cr.id, case
               when tc.id is null then 'removed'
               when tc.test_role_id is distinct from t.test_role_id then 'audience_changed'
             end
      from public.case_result_siblings(v_id) s(id)
      join public.test_case_results cr on cr.id = s.id
      left join public.test_cases tc on tc.id = cr.test_case_id
      left join public.iteration_testers t on t.iteration_id = cr.iteration_id and t.user_id = cr.tester_id
      where cr.included_in_run
        and cr.sync_kind is distinct from 'removed' and cr.sync_kind is distinct from 'audience_changed'
    loop
      continue when v_kind is null;
      update public.test_case_results
      set sync_kind = v_kind, synced_at = now(), synced_by = p_by, included_in_run = false
      where id = v_sibling;
      v_flagged := v_flagged + 1;
    end loop;

    if v_flagged = 0 then
      raise exception 'Case result % is not removed from this round', v_id;
    end if;
  end loop;
end;
$$;

-- Force refresh (0057) now archives and refreshes every tester's copy of the case.
create function public.force_refresh_case_result_one(p_case_result_id uuid, p_by uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iteration_id uuid;
  v_snapshot jsonb;
begin
  select cr.iteration_id,
         jsonb_build_object(
           'code', cr.code, 'title', cr.title, 'section_name', cr.section_name,
           'priority', cr.priority, 'test_role_id', cr.test_role_id,
           'role_assignee', (select t.name from public.test_roles t where t.id = cr.test_role_id),
           'tester_id', cr.tester_id,
           'preconditions', cr.preconditions, 'status', cr.status,
           'status_overridden', cr.status_overridden, 'executed_by', cr.executed_by,
           'completed_at', cr.completed_at, 'source_hash', cr.source_hash,
           'steps', coalesce((
             select jsonb_agg(jsonb_build_object(
               'step', sr.step, 'order_index', sr.order_index, 'status', sr.status,
               'expected_results', sr.expected_results,
               'remarks', coalesce((
                 select jsonb_agg(jsonb_build_object('remark', r.remark, 'created_by', r.created_by, 'created_at', r.created_at) order by r.created_at)
                 from public.test_remarks r where r.test_step_result_id = sr.id
               ), '[]'::jsonb)
             ) order by sr.order_index)
             from public.test_step_results sr where sr.test_case_result_id = cr.id
           ), '[]'::jsonb)
         )
  into v_iteration_id, v_snapshot
  from public.test_case_results cr
  join public.test_iterations i on i.id = cr.iteration_id
  where cr.id = p_case_result_id and i.status = 'in_progress';

  if v_iteration_id is null then
    raise exception 'Case result % is not in an in-progress iteration', p_case_result_id;
  end if;

  if public.case_result_has_results(p_case_result_id) then
    insert into public.test_case_result_archives (test_case_result_id, iteration_id, archived_by, reason, snapshot)
    values (p_case_result_id, v_iteration_id, p_by, btrim(p_reason), v_snapshot);
  end if;

  perform public.refresh_case_result_internal(p_case_result_id);

  update public.test_case_results
  set sync_kind = 'force_reset', synced_at = now(), synced_by = p_by
  where id = p_case_result_id;
end;
$$;
revoke execute on function public.force_refresh_case_result_one(uuid, uuid, text) from public, anon, authenticated;

create or replace function public.force_refresh_case_result(p_case_result_id uuid, p_by uuid default null, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sibling uuid;
begin
  perform public.assert_can('sync');

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required to force refresh a tested case';
  end if;

  for v_sibling in
    select s.id from public.case_result_siblings(p_case_result_id) s(id)
    join public.test_case_results cr on cr.id = s.id
    where cr.sync_kind is distinct from 'removed' and cr.sync_kind is distinct from 'audience_changed'
  loop
    perform public.force_refresh_case_result_one(v_sibling, p_by, p_reason);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Submission (still per organization, stored on its testers' roster rows)
-- ---------------------------------------------------------------------------

create function public.submit_participation(p_iteration_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_at timestamptz := now();
begin
  perform public.assert_can('submit');

  if not exists (select 1 from public.test_iterations where id = p_iteration_id and status = 'in_progress') then
    raise exception 'You can only submit while the round is in progress';
  end if;
  if not exists (
    select 1 from public.iteration_testers
    where iteration_id = p_iteration_id and organization_id = public.current_org_id() and status = 'active'
  ) then
    raise exception 'Your org is not a participant in this round';
  end if;

  update public.iteration_testers
  set submitted_at = v_at, withdrawn_at = null
  where iteration_id = p_iteration_id and organization_id = public.current_org_id()
    and status = 'active' and submitted_at is null;
  if not found then
    raise exception 'Your org has already submitted participation for this round';
  end if;

  return v_at;
end;
$$;

create or replace function public.can_withdraw_participation(p_iteration_id uuid)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select public.current_role_() in ('Internal', 'External')
    and exists (select 1 from public.test_iterations where id = p_iteration_id and status = 'in_progress')
    and exists (
      select 1 from public.iteration_testers
      where iteration_id = p_iteration_id and organization_id = public.current_org_id() and submitted_at is not null
    );
$$;

create function public.withdraw_participation(p_iteration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can('submit');

  if not public.can_withdraw_participation(p_iteration_id) then
    raise exception 'You can only withdraw a submission until the round is completed or stopped';
  end if;

  update public.iteration_testers
  set submitted_at = null, withdrawn_at = now()
  where iteration_id = p_iteration_id and organization_id = public.current_org_id() and submitted_at is not null;
end;
$$;

create or replace function public.complete_iteration(p_iteration_id uuid)
returns public.test_iterations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iteration public.test_iterations;
begin
  perform public.assert_can('run_iteration');

  if public.current_role_() = 'Internal' and exists (
    select 1 from public.iteration_testers
    where iteration_id = p_iteration_id and organization_id = public.current_org_id()
      and status = 'active' and submitted_at is null
  ) then
    raise exception 'Submit your organization''s results before completing the round';
  end if;

  update public.test_iterations
  set status = 'completed', completed_at = now()
  where id = p_iteration_id and status = 'in_progress'
  returning * into v_iteration;

  if v_iteration.id is null then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;
  return v_iteration;
end;
$$;

-- Same rules as before (0014, 0036); the submitted-org check reads the roster.
create or replace function public.guard_completed_iteration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.iteration_status;
  v_iteration_id uuid;
  v_org_id uuid;
  v_sync_kind text;
begin
  if tg_table_name = 'test_remarks' then
    if new.test_step_result_id is null then return new; end if;
    select i.status into v_status
    from public.test_step_results sr
    join public.test_case_results cr on cr.id = sr.test_case_result_id
    join public.test_iterations i on i.id = cr.iteration_id
    where sr.id = new.test_step_result_id;
    if v_status = 'not_started' then
      raise exception 'Start the iteration before recording results';
    end if;
    return new;
  end if;

  if tg_table_name = 'test_case_results' then
    select i.status, i.id, new.organization_id, old.sync_kind into v_status, v_iteration_id, v_org_id, v_sync_kind
    from public.test_iterations i where i.id = new.iteration_id;
  elsif tg_table_name = 'test_step_results' then
    select i.status, i.id, cr.organization_id, cr.sync_kind into v_status, v_iteration_id, v_org_id, v_sync_kind
    from public.test_case_results cr join public.test_iterations i on i.id = cr.iteration_id
    where cr.id = new.test_case_result_id;
  end if;

  if v_status in ('completed', 'stopped') then
    raise exception 'Cannot modify results of a % iteration', v_status;
  end if;

  if v_org_id = public.current_org_id() and exists (
    select 1 from public.iteration_testers t
    where t.iteration_id = v_iteration_id and t.organization_id = v_org_id and t.submitted_at is not null
  ) then
    raise exception 'Your organization already submitted this round. Withdraw the submission to make changes.';
  end if;

  if v_sync_kind in ('removed', 'audience_changed') then
    if tg_table_name = 'test_step_results' then
      if new.status is distinct from old.status then
        raise exception 'This test case was removed from the round, so its results are view only.' using errcode = 'P0001';
      end if;
    elsif new.status is distinct from old.status
      or new.status_overridden is distinct from old.status_overridden
      or new.executed_by is distinct from old.executed_by then
      raise exception 'This test case was removed from the round, so its results are view only.' using errcode = 'P0001';
    end if;
  end if;

  if v_status = 'not_started' then
    if tg_table_name = 'test_step_results' then
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
$$;

-- ---------------------------------------------------------------------------
-- Readers that joined the participant tables
-- ---------------------------------------------------------------------------

-- An org "is in" a round once one of its users is on the roster. my_submitted_at is set once
-- every active tester of the org has submitted.
create or replace function public.get_sidebar_suites()
returns table(suite_id uuid, name text, slug text, code text, status public.suite_status, open_iteration_number integer, open_iteration_name text, open_iteration_status public.iteration_status, open_planned_end date, my_in_open_round boolean, my_submitted_at timestamptz, my_remaining integer, my_ever_participated boolean)
language sql
stable security definer
set search_path = ''
as $$
  with open_round as (
    select i.id, i.testing_suite_id, i.iteration_number, i.name, i.status, i.planned_end_date
    from public.test_iterations i
    where i.status in ('not_started', 'in_progress')
  ),
  my_open as (
    select t.iteration_id,
           case when bool_and(t.submitted_at is not null) then max(t.submitted_at) end as submitted_at
    from public.iteration_testers t
    where t.organization_id = public.current_org_id() and t.status = 'active'
    group by t.iteration_id
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
        from public.iteration_testers t
        join public.test_iterations i on i.id = t.iteration_id
        where i.testing_suite_id = s.id
          and t.organization_id = public.current_org_id()
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
    when public.current_role_() = 'Internal' then status in ('in_testing', 'for_sign_off', 'sign_off_issued', 'sign_off_rejected', 'signed_off', 'archived')
    when public.current_role_() = 'External' then my_ever_participated
  end
  order by name;
$$;

-- Planned rounds' scope rows have no org: left join so they still mark cases "for testing".
create or replace function public.get_suite_case_states(p_suite_id uuid)
returns table(test_case_id uuid, status text, flags text[], result text, result_round_name text, open_round_name text, per_org jsonb)
language sql
stable security definer
set search_path = ''
as $$
  with me as (
    select public.can_see_all_results() as sees_all,
           public.current_org_id() as org_id
  ),
  open_round as (
    select i.id, i.name, i.status, i.started_at
    from public.test_iterations i
    where i.testing_suite_id = p_suite_id and i.status in ('not_started', 'in_progress')
  ),
  live as (
    select tc.id, tc.created_at, tc.section_id, s.slug as section_slug,
           public.test_case_content_hash(tc.id) as hash,
           exists (select 1 from public.test_case_issues(tc.id)) as incomplete
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    cross join me
    where s.test_suite_id = p_suite_id
      and (me.sees_all or public.org_has_case_role(me.org_id, tc.test_role_id))
  ),
  snap as (
    select cr.test_case_id, cr.organization_id, o.name as org_name, cr.status::text as res,
           cr.source_hash, cr.section_slug, i.id as iteration_id, i.name as round_name, i.status as round_status,
           row_number() over (
             partition by cr.test_case_id
             order by i.completed_at desc nulls last, i.iteration_number desc
           ) as completed_rank,
           (cr.status <> 'Untested' or exists (
             select 1 from public.test_step_results sr
             where sr.test_case_result_id = cr.id
               and (sr.status <> 'Untested' or exists (select 1 from public.test_remarks r where r.test_step_result_id = sr.id))
           )) as has_results
    from public.test_case_results cr
    join public.test_iterations i on i.id = cr.iteration_id
    left join public.organizations o on o.id = cr.organization_id
    cross join me
    where i.testing_suite_id = p_suite_id
      and cr.included_in_run
      and i.status in ('not_started', 'in_progress', 'completed')
      and (me.sees_all or cr.organization_id = me.org_id)
  ),
  tested_sections as (
    select distinct l.section_id
    from live l
    where exists (select 1 from snap s where s.section_slug = l.section_slug)
       or exists (select 1 from snap s join live l2 on l2.id = s.test_case_id where l2.section_id = l.section_id)
  ),
  last_completed as (
    select s.*
    from snap s
    where s.round_status = 'completed'
      and s.iteration_id = (
        select s2.iteration_id from snap s2
        where s2.test_case_id = s.test_case_id and s2.round_status = 'completed'
        order by s2.completed_rank limit 1
      )
  ),
  per_case as (
    select
      l.id,
      l.incomplete,
      l.hash,
      l.section_id,
      count(s.test_case_id) > 0 as in_any,
      bool_or(s.round_status = 'in_progress') filter (where s.round_status is not null) as in_running,
      bool_or(s.round_status = 'not_started') filter (where s.round_status is not null) as in_planned,
      bool_or(s.round_status = 'completed') filter (where s.round_status is not null) as in_completed,
      bool_or(s.round_status in ('in_progress', 'not_started') and s.source_hash is distinct from l.hash and not s.has_results) as open_update_pending,
      bool_or(s.round_status = 'in_progress' and s.source_hash is distinct from l.hash and s.has_results) as open_changed_after
    from live l
    left join snap s on s.test_case_id = l.id
    group by l.id, l.incomplete, l.hash, l.section_id
  ),
  with_last as (
    select pc.*,
      exists (
        select 1 from last_completed lc where lc.test_case_id = pc.id and lc.res not in ('Untested', 'In Progress')
      ) as last_tested
    from per_case pc
  ),
  classified as (
    select wl.*,
      case
        when coalesce(wl.in_running, false) then 'in_testing'
        when coalesce(wl.in_planned, false) then 'for_testing'
        when wl.incomplete then 'not_ready'
        when coalesce(wl.in_completed, false) and wl.last_tested then 'tested'
        else 'ready'
      end as status
    from with_last wl
  ),
  flagged as (
    select c.id, c.status,
      array_remove(array[
        case when c.status in ('in_testing', 'for_testing') and c.incomplete then 'incomplete' end,
        case when c.status = 'in_testing' and coalesce(c.open_changed_after, false) then 'changed_after_testing' end,
        case when c.status in ('in_testing', 'for_testing') and coalesce(c.open_update_pending, false) then 'update_pending' end,
        case when c.status = 'ready' and coalesce(c.in_completed, false) and not c.last_tested then 'skipped' end,
        case when c.status in ('tested', 'ready') and coalesce(c.in_completed, false) and exists (
          select 1 from last_completed lc where lc.test_case_id = c.id and lc.source_hash is distinct from c.hash
        ) then 'changed_since' end,
        case when not c.in_any and exists (select 1 from tested_sections ts where ts.section_id = c.section_id)
          then 'not_tested' end
      ], null) as flags
    from classified c
  ),
  result_rows as (
    select s.*
    from flagged f
    join snap s on s.test_case_id = f.id and s.round_status = 'in_progress'
    where f.status = 'in_testing'
    union all
    select lc.*
    from flagged f
    join last_completed lc on lc.test_case_id = f.id
    where f.status <> 'in_testing'
  ),
  results as (
    select rr.test_case_id,
      min(rr.round_name) as round_name,
      bool_or(rr.round_status = 'in_progress') as running,
      bool_or(rr.res = 'Failed') as any_failed,
      bool_or(rr.res = 'Blocked') as any_blocked,
      bool_or(rr.res in ('Untested', 'In Progress')) as any_untested,
      bool_and(rr.res in ('Untested', 'In Progress')) as all_untested,
      jsonb_agg(jsonb_build_object(
        'organizationId', rr.organization_id,
        'organizationName', rr.org_name,
        'result', rr.res,
        'hasResults', rr.has_results,
        'changed', rr.source_hash is distinct from (select l.hash from live l where l.id = rr.test_case_id)
      ) order by rr.org_name) as per_org
    from result_rows rr
    group by rr.test_case_id
  )
  select
    f.id,
    f.status,
    f.flags,
    case
      when r.test_case_id is null then null
      when r.any_failed then 'Failed'
      when r.any_blocked then 'Blocked'
      when r.running and r.any_untested then 'In progress'
      when r.all_untested then 'Untested'
      else 'Passed'
    end,
    r.round_name,
    (select o.name from open_round o limit 1),
    coalesce(r.per_org, '[]'::jsonb)
  from flagged f
  left join results r on r.test_case_id = f.id
$$;
