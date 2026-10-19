-- Roster opt-in. A planned round's roster used to be opt-out (0058): everyone holding an in-scope
-- role was ticked unless staff unticked them, so adding a section (a new role in scope) or a new
-- user put people on the roster before staff had vetted them. Now nobody is ticked until staff
-- tick them (iteration_ticked_testers); the roster is still fixed from the ticks at Start.
--   * At Start, in-scope users who weren't ticked are recorded in iteration_excluded_testers, so
--     the running round's Sync (0061 round_roster_drift) only offers users who appear afterwards
--     as tester_joined, not everyone who was passed over.
--   * Planned rounds that exist now start with nobody ticked: re-tick them in Add participants.

create table public.iteration_ticked_testers (
  iteration_id uuid not null references public.test_iterations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (iteration_id, user_id)
);
create index iteration_ticked_testers_user_id_idx on public.iteration_ticked_testers (user_id);

alter table public.iteration_ticked_testers enable row level security;
create policy "ticked testers: staff" on public.iteration_ticked_testers
  for select using ((select public.can_see_all_results()));

-- ---------------------------------------------------------------------------
-- Coverage: p_ticked_user_ids replaces p_excluded_user_ids
-- ---------------------------------------------------------------------------

drop function public.get_round_coverage(uuid, uuid[], uuid[]);
drop function public.round_coverage(jsonb, uuid[]);

create function public.round_coverage(p_cases jsonb, p_ticked_user_ids uuid[])
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
           p.id = any(coalesce(p_ticked_user_ids, '{}')) as ticked
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

create function public.get_round_coverage(p_suite_id uuid, p_test_case_ids uuid[], p_ticked_user_ids uuid[] default '{}')
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
    p_ticked_user_ids
  );
end;
$$;

create or replace function public.get_iteration_coverage(p_iteration_id uuid)
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
    (select coalesce(array_agg(user_id), '{}') from public.iteration_ticked_testers where iteration_id = p_iteration_id)
  );
end;
$$;

-- Ticks / unticks users for a planned round. Ticking also clears any "passed over" mark a
-- previous Start left (the round was reset to planned).
drop function public.set_iteration_testers_excluded(uuid, uuid[], boolean);
create function public.set_iteration_testers_ticked(p_iteration_id uuid, p_user_ids uuid[], p_ticked boolean)
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

  if p_ticked then
    insert into public.iteration_ticked_testers (iteration_id, user_id)
    select p_iteration_id, x.id from unnest(coalesce(p_user_ids, '{}')) as x(id)
    on conflict do nothing;
    delete from public.iteration_excluded_testers
    where iteration_id = p_iteration_id and user_id = any(coalesce(p_user_ids, '{}'));
  else
    delete from public.iteration_ticked_testers
    where iteration_id = p_iteration_id and user_id = any(coalesce(p_user_ids, '{}'));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Start: same as 0058, but the roster is the ticked users and the rest are recorded as passed over
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
    (select coalesce(array_agg(user_id), '{}') from public.iteration_ticked_testers where iteration_id = p_iteration_id)
  );
  select string_agg(concat_ws(' ', c->>'code', c->>'title'), ', ') into v_list from jsonb_array_elements(v_coverage->'casesWithoutRole') c;
  if v_list is not null then
    raise exception 'Every test case needs a test role before the round can start. No role: %', v_list using errcode = 'P0001';
  end if;
  select string_agg(r->>'name', ', ') into v_list from jsonb_array_elements(v_coverage->'rolesWithoutTesters') r;
  if v_list is not null then
    raise exception 'Every test role in scope needs at least one tester. Tick a tester for: %', v_list using errcode = 'P0001';
  end if;

  -- The roster: every ticked user holding a role the scope needs.
  insert into public.iteration_testers (iteration_id, user_id, test_role_id, organization_id)
  select p_iteration_id, (u->>'userId')::uuid, (r->>'testRoleId')::uuid, (o->>'organizationId')::uuid
  from jsonb_array_elements(v_coverage->'roles') r
  cross join jsonb_array_elements(r->'orgs') o
  cross join jsonb_array_elements(o->'users') u
  where (u->>'ticked')::boolean;

  -- Everyone else holding an in-scope role was passed over on purpose: Sync only offers users who
  -- show up after this.
  delete from public.iteration_excluded_testers where iteration_id = p_iteration_id;
  insert into public.iteration_excluded_testers (iteration_id, user_id)
  select distinct p_iteration_id, (u->>'userId')::uuid
  from jsonb_array_elements(v_coverage->'roles') r
  cross join jsonb_array_elements(r->'orgs') o
  cross join jsonb_array_elements(o->'users') u
  where not (u->>'ticked')::boolean;

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
