-- Sync could copy an incomplete case into a round. Adding a case (sync_iteration) already skipped
-- cases with test_case_issues, but refreshing an edited one (Sync "Changed", Force refresh) didn't,
-- so a step left without an expected result reached testers.
--   refresh_case_result_internal   rejects a live case with issues (covers Sync and Force refresh)
--   get_iteration_changes          + incomplete, so the Sync dialog locks those rows up front

create or replace function public.refresh_case_result_internal(p_case_result_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
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

-- Return type changes (+ incomplete), so drop and recreate.
drop function public.get_iteration_changes(uuid);

create function public.get_iteration_changes(p_iteration_id uuid)
 returns table(change text, test_case_id uuid, test_case_result_id uuid, code text, title text, has_results boolean, organization_id uuid, organization_name text, incomplete boolean)
 language sql
 stable security definer
 set search_path to ''
as $function$
  with it as (
    select id, testing_suite_id, started_at from public.test_iterations where id = p_iteration_id
  ),
  parts as (
    select p.organization_id, o.name, o.type
    from public.iteration_participants p join public.organizations o on o.id = p.organization_id
    where p.iteration_id = p_iteration_id
      and (public.can_see_all_results() or p.organization_id = public.current_org_id())
  ),
  live as (
    select tc.id, tc.code, tc.title, tc.created_at, tc.audience
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
  )
  -- Incomplete cases are never offered as "added" (sync_iteration skips them anyway).
  select 'added', l.id, null::uuid, l.code, l.title, false, parts.organization_id, parts.name, false
  from live l cross join parts cross join it
  where public.org_sees_audience(parts.type, l.audience)
    and not exists (select 1 from snap where snap.test_case_id = l.id and snap.organization_id = parts.organization_id)
    and (l.created_at > it.started_at or exists (select 1 from snap where snap.test_case_id = l.id))
    and not exists (select 1 from public.test_case_issues(l.id))
  union all
  select 'changed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results, parts.organization_id, parts.name,
    exists (select 1 from public.test_case_issues(snap.test_case_id))
  from snap
  join parts on parts.organization_id = snap.organization_id
  join live l on l.id = snap.test_case_id
  where public.org_sees_audience(parts.type, l.audience)
    and snap.source_hash is distinct from public.test_case_content_hash(snap.test_case_id)
  union all
  select 'removed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results, parts.organization_id, parts.name, false
  from snap
  join parts on parts.organization_id = snap.organization_id
  left join live l on l.id = snap.test_case_id
  where l.id is null or not public.org_sees_audience(parts.type, l.audience)
$function$;

revoke execute on function public.get_iteration_changes(uuid) from public, anon;
grant execute on function public.get_iteration_changes(uuid) to authenticated;
