-- Test cases, round case snapshots and suite test accounts point at the role catalog
-- (spec #2, ticket #6) instead of holding a role name, so renames and typos can't break
-- matching any more. The reference is nullable: a draft case can have no role yet, and a
-- test account can be for "any role". Matching (org visibility, round sync) is now by ID.

-- ---------------------------------------------------------------------------
-- Columns + data
-- ---------------------------------------------------------------------------

-- test_case_content_hash() switches from the role name to the role ID below, which would
-- make every open round's snapshots look changed. Note the ones in sync now (with the old
-- hash, before its columns go) and re-hash them once the new function exists (as in 0039).
-- Completed rounds are locked by guard_completed_iteration and keep their old hash.
create temp table _in_sync_snapshots as
  select cr.id, cr.test_case_id
  from public.test_case_results cr
  join public.test_iterations ti on ti.id = cr.iteration_id
  where ti.status <> 'completed'
    and cr.test_case_id is not null
    and cr.source_hash = public.test_case_content_hash(cr.test_case_id);

alter table public.test_cases
  add column test_role_id uuid references public.test_roles(id) on delete set null;
alter table public.test_case_results
  add column test_role_id uuid references public.test_roles(id) on delete set null;
alter table public.suite_test_accounts
  add column test_role_id uuid references public.test_roles(id) on delete set null;

create index test_cases_test_role_id_idx on public.test_cases (test_role_id);
create index test_case_results_test_role_id_idx on public.test_case_results (test_role_id);
create index suite_test_accounts_test_role_id_idx on public.suite_test_accounts (test_role_id);

update public.test_cases c set test_role_id = t.id
from public.test_roles t
where public.norm_role_name(t.name) = public.norm_role_name(c.role_assignee);

update public.test_case_results c set test_role_id = t.id
from public.test_roles t
where public.norm_role_name(t.name) = public.norm_role_name(c.role_assignee);

update public.suite_test_accounts a set test_role_id = t.id
from public.test_roles t
where public.norm_role_name(t.name) = public.norm_role_name(a.role);

-- A name with no catalog match is reported, never silently dropped: add the role to the
-- catalog (Admin → Roles) or fix the name, then re-run.
do $$
declare
  v_unmatched text;
begin
  select string_agg(distinct format('%s "%s"', src, name), ', ')
  into v_unmatched
  from (
    select 'test case' as src, role_assignee as name from public.test_cases where role_assignee is not null and test_role_id is null
    union all
    select 'round case', role_assignee from public.test_case_results where role_assignee is not null and test_role_id is null
    union all
    select 'test account', role from public.suite_test_accounts where role is not null and test_role_id is null
  ) u;
  if v_unmatched is not null then
    raise exception 'These role names have no match in the role catalog: %', v_unmatched;
  end if;
end $$;

-- The name-based helpers and the policy that uses them go before the columns do.
drop policy "cases: read by role" on public.test_cases;
drop function public.org_has_case_role(uuid, text);
drop function public.participant_tests_case(uuid, uuid, text);

alter table public.test_cases drop column role_assignee;
alter table public.test_case_results drop column role_assignee;
alter table public.suite_test_accounts drop column role;

-- Unused since 0052/0053 turned the columns into text.
drop type if exists public.role_assignee_type;

-- ---------------------------------------------------------------------------
-- Matching by catalog ID
-- ---------------------------------------------------------------------------

create function public.org_has_case_role(p_org_id uuid, p_test_role_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_roles r
    where r.organization_id = p_org_id and r.test_role_id = p_test_role_id
  );
$$;

create function public.participant_tests_case(p_iteration_id uuid, p_org_id uuid, p_test_role_id uuid)
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
        and r.test_role_id = p_test_role_id
    );
$$;

revoke execute on function public.org_has_case_role(uuid, uuid) from public, anon;
revoke execute on function public.participant_tests_case(uuid, uuid, uuid) from public, anon;
grant execute on function public.org_has_case_role(uuid, uuid) to authenticated;
grant execute on function public.participant_tests_case(uuid, uuid, uuid) to authenticated;

create policy "cases: read by role" on public.test_cases
  for select using (
    (select public.can_see_all_results())
    or public.org_has_case_role((select public.current_org_id()), test_role_id)
  );

-- ---------------------------------------------------------------------------
-- Functions that read or write the role (same bodies as before, role column swapped)
-- ---------------------------------------------------------------------------

create or replace function public.test_case_content_hash(p_test_case_id uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select md5(jsonb_build_object(
    'code', tc.code, 'title', tc.title, 'role', tc.test_role_id, 'priority', tc.priority,
    'section', s.name,
    'preconditions', public.case_preconditions_json(tc.id),
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object('step', ts.step, 'expected', public.step_expected_results_json(ts.id)) order by ts.order_index)
      from public.test_steps ts where ts.test_case_id = tc.id
    ), '[]'::jsonb)
  )::text)
  from public.test_cases tc join public.sections s on s.id = tc.section_id
  where tc.id = p_test_case_id
$$;

update public.test_case_results cr
  set source_hash = public.test_case_content_hash(s.test_case_id)
  from _in_sync_snapshots s
  where cr.id = s.id;

drop table _in_sync_snapshots;

create or replace function public.test_case_issues(p_test_case_id uuid)
returns setof text
language sql
stable
set search_path = ''
as $$
  select 'no_steps'
  where not exists (select 1 from public.test_steps ts where ts.test_case_id = p_test_case_id)
  union all
  select 'step_without_expected_result'
  where exists (
    select 1 from public.test_steps ts
    where ts.test_case_id = p_test_case_id
      and not exists (select 1 from public.expected_results er where er.test_step_id = ts.id)
  )
  union all
  select 'no_role_assignee'
  where exists (select 1 from public.test_cases tc where tc.id = p_test_case_id and tc.test_role_id is null)
$$;

create or replace function public.save_test_case(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case_id uuid := nullif(p_payload->>'id', '')::uuid;
  v_section_id uuid := nullif(p_payload->>'section_id', '')::uuid;
  v_test_role_id uuid := nullif(p_payload->>'test_role_id', '')::uuid;
  v_suite_id uuid;
  v_status public.suite_status;
  v_old_suite_id uuid;
  v_pre jsonb; v_pre_ord bigint; v_pre_ids uuid[] := '{}';
  v_step jsonb; v_step_ord bigint; v_step_id uuid; v_step_ids uuid[] := '{}';
  v_er jsonb; v_er_ord bigint; v_er_id uuid; v_er_ids uuid[];
  v_id uuid;
begin
  perform public.assert_can('author');

  if coalesce(btrim(p_payload->>'title'), '') = '' then
    raise exception 'Test case title is required';
  end if;

  select test_suite_id into v_suite_id from public.sections where id = v_section_id;
  if v_suite_id is null then
    raise exception 'Section % not found', v_section_id;
  end if;
  v_status := public.assert_suite_editable(v_suite_id);

  if v_test_role_id is not null and not exists (select 1 from public.test_roles where id = v_test_role_id) then
    raise exception 'That test role is no longer in the role catalog' using errcode = 'P0001';
  end if;

  if v_case_id is null then
    insert into public.test_cases (section_id, title, description, priority, test_role_id, created_by, order_index)
    values (
      v_section_id,
      btrim(p_payload->>'title'),
      coalesce(p_payload->>'description', ''),
      coalesce(nullif(p_payload->>'priority', '')::public.priority_level, 'medium'),
      v_test_role_id,
      nullif(p_payload->>'created_by', '')::uuid,
      coalesce((select max(order_index) + 1 from public.test_cases where section_id = v_section_id), 0)
    )
    returning id into v_case_id;
  else
    select s.test_suite_id into v_old_suite_id
    from public.test_cases tc join public.sections s on s.id = tc.section_id
    where tc.id = v_case_id;
    if v_old_suite_id is null then
      raise exception 'Test case % not found', v_case_id;
    end if;
    if v_old_suite_id <> v_suite_id then
      raise exception 'A test case can only move between sections of the same suite';
    end if;

    update public.test_cases
    set section_id = v_section_id,
        title = btrim(p_payload->>'title'),
        description = coalesce(p_payload->>'description', description),
        priority = coalesce(nullif(p_payload->>'priority', '')::public.priority_level, priority),
        test_role_id = v_test_role_id,
        lifecycle_status = case when v_status = 'in_testing' then 'updated'::public.test_case_lifecycle else lifecycle_status end
    where id = v_case_id;
  end if;

  for v_pre, v_pre_ord in select e, o from jsonb_array_elements(coalesce(p_payload->'preconditions', '[]')) with ordinality as t(e, o) loop
    if coalesce(btrim(v_pre->>'condition'), '') = '' then continue; end if;
    v_id := nullif(v_pre->>'id', '')::uuid;
    if v_id is not null and exists (select 1 from public.preconditions where id = v_id and test_case_id = v_case_id) then
      update public.preconditions set condition = btrim(v_pre->>'condition'), order_index = v_pre_ord - 1 where id = v_id;
    else
      insert into public.preconditions (test_case_id, condition, order_index)
      values (v_case_id, btrim(v_pre->>'condition'), v_pre_ord - 1)
      returning id into v_id;
    end if;
    v_pre_ids := v_pre_ids || v_id;
  end loop;
  delete from public.preconditions where test_case_id = v_case_id and not (id = any(v_pre_ids));

  for v_step, v_step_ord in select e, o from jsonb_array_elements(coalesce(p_payload->'steps', '[]')) with ordinality as t(e, o) loop
    if coalesce(btrim(v_step->>'step'), '') = '' then
      raise exception 'Step % has no text', v_step_ord;
    end if;
    v_step_id := nullif(v_step->>'id', '')::uuid;
    if v_step_id is not null and exists (select 1 from public.test_steps where id = v_step_id and test_case_id = v_case_id) then
      update public.test_steps set step = btrim(v_step->>'step'), order_index = v_step_ord - 1 where id = v_step_id;
    else
      insert into public.test_steps (test_case_id, step, order_index)
      values (v_case_id, btrim(v_step->>'step'), v_step_ord - 1)
      returning id into v_step_id;
    end if;
    v_step_ids := v_step_ids || v_step_id;

    v_er_ids := '{}';
    for v_er, v_er_ord in select e, o from jsonb_array_elements(coalesce(v_step->'expected_results', '[]')) with ordinality as t(e, o) loop
      if coalesce(btrim(v_er->>'result'), '') = '' then continue; end if;
      v_er_id := nullif(v_er->>'id', '')::uuid;
      if v_er_id is not null and exists (select 1 from public.expected_results where id = v_er_id and test_step_id = v_step_id) then
        update public.expected_results set result = btrim(v_er->>'result'), order_index = v_er_ord - 1 where id = v_er_id;
      else
        insert into public.expected_results (test_step_id, result, order_index)
        values (v_step_id, btrim(v_er->>'result'), v_er_ord - 1)
        returning id into v_er_id;
      end if;
      v_er_ids := v_er_ids || v_er_id;
    end loop;
    delete from public.expected_results where test_step_id = v_step_id and not (id = any(v_er_ids));
  end loop;

  delete from public.test_remarks
  where test_step_id in (select id from public.test_steps where test_case_id = v_case_id and not (id = any(v_step_ids)));
  delete from public.expected_results
  where test_step_id in (select id from public.test_steps where test_case_id = v_case_id and not (id = any(v_step_ids)));
  delete from public.test_steps where test_case_id = v_case_id and not (id = any(v_step_ids));

  if v_status = 'ready' then
    perform public.assert_suite_readiness(v_suite_id);
  end if;

  return v_case_id;
end;
$$;

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

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) a
    where nullif(a->>'test_role_id', '') is not null
      and not exists (select 1 from public.test_roles t where t.id = (a->>'test_role_id')::uuid)
  ) then
    raise exception 'A test account''s role is no longer in the role catalog' using errcode = 'P0001';
  end if;

  delete from public.suite_test_accounts where testing_suite_id = p_suite_id;

  insert into public.suite_test_accounts (testing_suite_id, test_role_id, username, password, sort_order)
  select p_suite_id,
         nullif(a.value->>'test_role_id', '')::uuid,
         btrim(a.value->>'username'),
         a.value->>'password',
         a.ordinality::integer
  from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) with ordinality a;

  if v_status = 'ready' and not exists (select 1 from public.suite_test_accounts where testing_suite_id = p_suite_id) then
    raise exception 'A Ready suite needs at least one test account. Move it back to Draft to remove the last one.';
  end if;

  return query
    select * from public.suite_test_accounts where testing_suite_id = p_suite_id order by sort_order;
end;
$$;

create or replace function public.refresh_case_result_internal(p_case_result_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_test_case_id uuid;
  v_code text;
  v_issues text;
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

  select string_agg(case issue
           when 'no_steps' then 'no steps'
           when 'step_without_expected_result' then 'a step without an expected result'
           when 'no_role_assignee' then 'no role assignee'
           else issue
         end, ', ')
  into v_issues
  from public.test_case_issues(v_test_case_id) as issue;

  if v_issues is not null then
    select tc.code into v_code from public.test_cases tc where tc.id = v_test_case_id;
    raise exception '% is incomplete (%). Fix it before syncing.', coalesce(v_code, 'This test case'), v_issues
      using errcode = 'P0001';
  end if;

  delete from public.test_step_results where test_case_result_id = p_case_result_id;

  update public.test_case_results cr
  set code = tc.code, title = tc.title, section_name = s.name, section_slug = s.slug, section_order = s.order_index,
      order_index = tc.order_index, test_role_id = tc.test_role_id, priority = tc.priority,
      preconditions = public.case_preconditions_json(tc.id), source_hash = public.test_case_content_hash(tc.id),
      status = 'Untested', status_overridden = false, executed_by = null, completed_at = null
  from public.test_cases tc join public.sections s on s.id = tc.section_id
  where cr.id = p_case_result_id and tc.id = v_test_case_id;

  insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
  select p_case_result_id, ts.id, ts.order_index, ts.step, public.step_expected_results_json(ts.id)
  from public.test_steps ts where ts.test_case_id = v_test_case_id;
end;
$$;

-- The archive snapshot keeps the role's name as it was, plus its catalog ID.
create or replace function public.force_refresh_case_result(p_case_result_id uuid, p_by uuid default null, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iteration_id uuid;
  v_snapshot jsonb;
begin
  perform public.assert_can('sync');

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required to force refresh a tested case';
  end if;

  select cr.iteration_id,
         jsonb_build_object(
           'code', cr.code, 'title', cr.title, 'section_name', cr.section_name,
           'priority', cr.priority, 'test_role_id', cr.test_role_id,
           'role_assignee', (select t.name from public.test_roles t where t.id = cr.test_role_id),
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

  insert into public.test_case_result_archives (test_case_result_id, iteration_id, archived_by, reason, snapshot)
  values (p_case_result_id, v_iteration_id, p_by, btrim(p_reason), v_snapshot);

  perform public.refresh_case_result_internal(p_case_result_id);

  update public.test_case_results
  set sync_kind = 'force_reset', synced_at = now(), synced_by = p_by
  where id = p_case_result_id;
end;
$$;

create or replace function public.sync_iteration(p_iteration_id uuid, p_test_case_ids uuid[] default null, p_org_ids uuid[] default null)
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
      (iteration_id, organization_id, test_case_id, code, title, section_name, section_slug, section_order, order_index, test_role_id, priority, preconditions, source_hash)
    select p_iteration_id, p.organization_id, tc.id, tc.code, tc.title, s.name, s.slug, s.order_index, tc.order_index, tc.test_role_id, tc.priority,
      public.case_preconditions_json(tc.id), public.test_case_content_hash(tc.id)
    from public.iteration_participants p
    cross join public.test_cases tc
    join public.sections s on s.id = tc.section_id
    where p.iteration_id = p_iteration_id
      and (p_org_ids is null or p.organization_id = any(p_org_ids))
      and s.test_suite_id = v_suite_id
      and (p_test_case_ids is null or tc.id = any(p_test_case_ids))
      and public.participant_tests_case(p_iteration_id, p.organization_id, tc.test_role_id)
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

create or replace function public.get_iteration_changes(p_iteration_id uuid)
returns table(change text, test_case_id uuid, test_case_result_id uuid, code text, title text, has_results boolean, organization_id uuid, organization_name text, incomplete boolean, audience_changed boolean)
language sql
stable
security definer
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
    select tc.id, tc.code, tc.title, tc.created_at, tc.test_role_id
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
  where public.participant_tests_case(p_iteration_id, parts.organization_id, l.test_role_id)
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
  where public.participant_tests_case(p_iteration_id, parts.organization_id, l.test_role_id)
    and snap.source_hash is distinct from public.test_case_content_hash(snap.test_case_id)
  union all
  select 'removed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results, parts.organization_id, parts.name, false, l.id is not null
  from snap
  join parts on parts.organization_id = snap.organization_id
  left join live l on l.id = snap.test_case_id
  where l.id is null or not public.participant_tests_case(p_iteration_id, parts.organization_id, l.test_role_id)
$$;

create or replace function public.apply_iteration_sync(p_iteration_id uuid, p_by uuid default null, p_add uuid[] default '{}', p_refresh uuid[] default '{}', p_remove uuid[] default '{}')
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
             when not public.participant_tests_case(p_iteration_id, cr.organization_id, tc.test_role_id) then 'audience_changed'
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

-- Removing a participant role drops the round cases only that role covered (from 0054).
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
        and not public.participant_tests_case(p_iteration_id, p_org_id, tc.test_role_id)
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

-- A tester org sees the cases of its test roles (from 0054).
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
