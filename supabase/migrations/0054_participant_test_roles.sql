-- Test cases are bound by role, not audience (2026-10-10). Each org taking part in a
-- round picks which of its test roles (organization_roles, /admin) test the suite; the
-- org gets the cases whose Role Assignee matches one of those roles. The vendor (not
-- offered as a participant) still gets every case. Audience is no longer consulted.

-- Same comparison as sameRoleName (lib/auth/test-role.ts): letters and digits only,
-- case-insensitive. Empty → null so a case without a role matches nothing.
create or replace function public.norm_role_name(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]', '', 'g'), '');
$$;

create table public.iteration_participant_roles (
  iteration_id uuid not null,
  organization_id uuid not null,
  role_id uuid not null references public.organization_roles(id) on delete cascade,
  primary key (iteration_id, organization_id, role_id),
  foreign key (iteration_id, organization_id)
    references public.iteration_participants(iteration_id, organization_id) on delete cascade
);

alter table public.iteration_participant_roles enable row level security;

-- Same visibility as iteration_participants; writes only through the RPCs below.
create policy "participant roles: staff or own org" on public.iteration_participant_roles
  for select using ((select public.can_see_all_results()) or organization_id = (select public.current_org_id()));

-- Does this org test this case's role in this round?
create or replace function public.participant_tests_case(p_iteration_id uuid, p_org_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.organizations o where o.id = p_org_id and o.type = 'vendor')
    or exists (
      select 1
      from public.iteration_participant_roles pr
      join public.organization_roles r on r.id = pr.role_id
      where pr.iteration_id = p_iteration_id and pr.organization_id = p_org_id
        and public.norm_role_name(r.name) = public.norm_role_name(p_role)
    );
$$;

-- Does this org have a test role matching the case's role (any round)?
create or replace function public.org_has_case_role(p_org_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_roles r
    where r.organization_id = p_org_id
      and public.norm_role_name(r.name) = public.norm_role_name(p_role)
  );
$$;

-- Replaces the participant's roles; every id must be a role of that org, at least one.
create or replace function public.assign_participant_roles(p_iteration_id uuid, p_org_id uuid, p_role_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if cardinality(coalesce(p_role_ids, '{}')) = 0 then
    raise exception 'Pick at least one test role for this organization.' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(p_role_ids) as x(id)
    where not exists (select 1 from public.organization_roles r where r.id = x.id and r.organization_id = p_org_id)
  ) then
    raise exception 'A picked test role does not belong to this organization.' using errcode = 'P0001';
  end if;

  delete from public.iteration_participant_roles
  where iteration_id = p_iteration_id and organization_id = p_org_id and not (role_id = any(p_role_ids));
  insert into public.iteration_participant_roles (iteration_id, organization_id, role_id)
  select p_iteration_id, p_org_id, x.id from unnest(p_role_ids) as x(id)
  on conflict do nothing;
end;
$$;

-- The cases a newly added / re-scoped participant should get: the round's scope.
create or replace function public.iteration_scope_case_ids(p_iteration_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(tc.id), '{}')
  from public.test_iterations i
  join public.sections s on s.test_suite_id = i.testing_suite_id
  join public.test_cases tc on tc.section_id = s.id
  where i.id = p_iteration_id
    and (
      (i.scope_test_case_ids is null and tc.created_at <= i.started_at)
      or tc.id = any(coalesce(i.scope_test_case_ids, '{}'))
      or exists (select 1 from public.test_case_results cr where cr.iteration_id = p_iteration_id and cr.test_case_id = tc.id)
    );
$$;

drop function public.add_iteration_participant(uuid, uuid);

create function public.add_iteration_participant(p_iteration_id uuid, p_org_id uuid, p_role_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suite_id uuid;
  v_count integer;
begin
  perform public.assert_can('run_iteration');

  select testing_suite_id into v_suite_id
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

  perform public.assign_participant_roles(p_iteration_id, p_org_id, p_role_ids);

  select count(*) into v_count
  from public.sync_iteration(p_iteration_id, public.iteration_scope_case_ids(p_iteration_id), array[p_org_id]);
  return v_count;
end;
$$;

-- Changes which roles an org tests in an open round. Newly covered cases are added
-- right away. Cases no longer covered: removed now in a planned round (when untouched);
-- in a running round they show up in Sync as removed ("Role changed").
create or replace function public.set_participant_roles(p_iteration_id uuid, p_org_id uuid, p_role_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.iteration_status;
  v_count integer;
  v_id uuid;
begin
  perform public.assert_can('run_iteration');

  select status into v_status
  from public.test_iterations
  where id = p_iteration_id and status in ('not_started', 'in_progress')
  for update;
  if v_status is null then
    raise exception 'Iteration % is not open', p_iteration_id;
  end if;
  if not exists (select 1 from public.iteration_participants where iteration_id = p_iteration_id and organization_id = p_org_id) then
    raise exception 'This organization is not taking part in the iteration';
  end if;

  perform public.assign_participant_roles(p_iteration_id, p_org_id, p_role_ids);

  if v_status = 'not_started' then
    for v_id in
      select cr.id
      from public.test_case_results cr
      left join public.test_cases tc on tc.id = cr.test_case_id
      where cr.iteration_id = p_iteration_id and cr.organization_id = p_org_id
        and not public.participant_tests_case(p_iteration_id, p_org_id, tc.role_assignee)
        and not public.case_result_has_results(cr.id)
    loop
      perform public.remove_case_result(v_id);
    end loop;
  end if;

  select count(*) into v_count
  from public.sync_iteration(p_iteration_id, public.iteration_scope_case_ids(p_iteration_id), array[p_org_id]);
  return v_count;
end;
$$;

-- sync_iteration: audience → participant roles.
create or replace function public.sync_iteration(p_iteration_id uuid, p_test_case_ids uuid[] default null::uuid[], p_org_ids uuid[] default null::uuid[])
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
    cross join public.test_cases tc
    join public.sections s on s.id = tc.section_id
    where p.iteration_id = p_iteration_id
      and (p_org_ids is null or p.organization_id = any(p_org_ids))
      and s.test_suite_id = v_suite_id
      and (p_test_case_ids is null or tc.id = any(p_test_case_ids))
      and public.participant_tests_case(p_iteration_id, p.organization_id, tc.role_assignee)
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
$$;

-- get_iteration_changes: audience → participant roles. The audience_changed output
-- column keeps its name; it now means "the org no longer tests this case's role".
create or replace function public.get_iteration_changes(p_iteration_id uuid)
returns table(change text, test_case_id uuid, test_case_result_id uuid, code text, title text, has_results boolean, organization_id uuid, organization_name text, incomplete boolean, audience_changed boolean)
language sql
stable security definer
set search_path = ''
as $$
  with it as (
    select id, testing_suite_id, started_at from public.test_iterations where id = p_iteration_id
  ),
  parts as (
    select p.organization_id, o.name
    from public.iteration_participants p join public.organizations o on o.id = p.organization_id
    where p.iteration_id = p_iteration_id
      and (public.can_see_all_results() or p.organization_id = public.current_org_id())
  ),
  live as (
    select tc.id, tc.code, tc.title, tc.created_at, tc.role_assignee
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    join it on it.testing_suite_id = s.test_suite_id
  ),
  snap as (
    select cr.*,
      (cr.status <> 'Untested' or exists (
        select 1 from public.test_step_results sr
        where sr.test_case_result_id = cr.id
          and (sr.status <> 'Untested' or exists (select 1 from public.test_remarks r where r.test_step_result_id = sr.id))
      )) as has_results
    from public.test_case_results cr join it on it.id = cr.iteration_id
    where cr.sync_kind is distinct from 'removed' and cr.sync_kind is distinct from 'audience_changed'
  ),
  flagged as (
    select cr.test_case_id, cr.organization_id
    from public.test_case_results cr
    where cr.iteration_id = p_iteration_id and cr.sync_kind in ('removed', 'audience_changed')
  )
  select 'added', l.id, null::uuid, l.code, l.title, false, parts.organization_id, parts.name, false, false
  from live l cross join parts cross join it
  where public.participant_tests_case(p_iteration_id, parts.organization_id, l.role_assignee)
    and not exists (select 1 from snap where snap.test_case_id = l.id and snap.organization_id = parts.organization_id)
    and not exists (select 1 from flagged f where f.test_case_id = l.id and f.organization_id = parts.organization_id)
    and (l.created_at > it.started_at or exists (select 1 from snap where snap.test_case_id = l.id))
    and not exists (select 1 from public.test_case_issues(l.id))
  union all
  select 'changed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results, parts.organization_id, parts.name,
    exists (select 1 from public.test_case_issues(snap.test_case_id)), false
  from snap
  join parts on parts.organization_id = snap.organization_id
  join live l on l.id = snap.test_case_id
  where public.participant_tests_case(p_iteration_id, parts.organization_id, l.role_assignee)
    and snap.source_hash is distinct from public.test_case_content_hash(snap.test_case_id)
  union all
  select 'removed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results, parts.organization_id, parts.name, false, l.id is not null
  from snap
  join parts on parts.organization_id = snap.organization_id
  left join live l on l.id = snap.test_case_id
  where l.id is null or not public.participant_tests_case(p_iteration_id, parts.organization_id, l.role_assignee)
$$;

-- apply_iteration_sync: the mid-round flag is decided by participant roles.
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
  v_kind text;
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
    perform public.refresh_case_result(v_id);
    update public.test_case_results
    set sync_kind = 'updated', synced_at = now(), synced_by = p_by
    where id = v_id;
  end loop;

  foreach v_id in array coalesce(p_remove, '{}') loop
    if not exists (select 1 from public.test_case_results where id = v_id and iteration_id = p_iteration_id) then
      raise exception 'Case result % does not belong to this iteration', v_id;
    end if;

    if v_status = 'not_started' then
      perform public.remove_case_result(v_id);
      continue;
    end if;

    select case
             when tc.id is null then 'removed'
             when not public.participant_tests_case(p_iteration_id, cr.organization_id, tc.role_assignee) then 'audience_changed'
           end
    into v_kind
    from public.test_case_results cr
    left join public.test_cases tc on tc.id = cr.test_case_id
    where cr.id = v_id and cr.included_in_run
      and cr.sync_kind is distinct from 'removed' and cr.sync_kind is distinct from 'audience_changed';

    if v_kind is null then
      raise exception 'Case result % is not removed from this round', v_id;
    end if;

    update public.test_case_results
    set sync_kind = v_kind, synced_at = now(), synced_by = p_by, included_in_run = false
    where id = v_id;
  end loop;
end;
$$;

-- Testers read the cases of their org's test roles (was: by audience).
drop policy "cases: read by audience" on public.test_cases;
create policy "cases: read by role" on public.test_cases
  for select using (
    (select public.can_see_all_results())
    or public.org_has_case_role((select public.current_org_id()), role_assignee)
  );

-- get_suite_case_states: a tester org sees the cases of its test roles (was: by audience).
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
      and (me.sees_all or public.org_has_case_role(me.org_id, tc.role_assignee))
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
    join public.organizations o on o.id = cr.organization_id
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
