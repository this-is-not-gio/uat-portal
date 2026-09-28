-- RBAC Phase 4 (part 2): assert_can enforces the permission matrix (playbook §0) inside every RPC.
-- Role-only: which org's rows you may touch is RLS's job (0012), not this function's.
-- security definer because it reads profiles through current_role_().

create or replace function public.assert_can(p_action text)
returns void
language plpgsql
stable
security definer
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
    when 'sign_off' then v_allowed := v_role = 'Internal';
    else v_allowed := false;
  end case;
  if not coalesce(v_allowed, false) then
    raise exception 'forbidden: %', p_action using errcode = '42501';
  end if;
end;
$$;

-- "Reset to auto" writes a result row, so it follows the same rule as RLS on test_case_results:
-- only your own org's rows (D1). security definer would otherwise let anyone reset any org's case.
create or replace function public.recompute_case_result_status(p_case_result_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.test_case_results
    where id = p_case_result_id and organization_id = public.current_org_id()
  ) then
    raise exception 'forbidden: execute' using errcode = '42501';
  end if;

  update public.test_case_results set status_overridden = false where id = p_case_result_id;
  perform public.apply_derived_case_status(p_case_result_id);
end;
$$;

-- security definer skips RLS, so the participant list is narrowed to what the caller may see.
create or replace function public.get_iteration_changes(p_iteration_id uuid)
returns table(change text, test_case_id uuid, test_case_result_id uuid, code text, title text, has_results boolean, organization_id uuid, organization_name text)
language sql
stable
security definer
set search_path = ''
as $$
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
  select 'added', l.id, null::uuid, l.code, l.title, false, parts.organization_id, parts.name
  from live l cross join parts cross join it
  where public.org_sees_audience(parts.type, l.audience)
    and not exists (select 1 from snap where snap.test_case_id = l.id and snap.organization_id = parts.organization_id)
    and (l.created_at > it.started_at or exists (select 1 from snap where snap.test_case_id = l.id))
    and not exists (select 1 from public.test_case_issues(l.id))
  union all
  select 'changed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results, parts.organization_id, parts.name
  from snap
  join parts on parts.organization_id = snap.organization_id
  join live l on l.id = snap.test_case_id
  where public.org_sees_audience(parts.type, l.audience)
    and snap.source_hash is distinct from public.test_case_content_hash(snap.test_case_id)
  union all
  select 'removed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results, parts.organization_id, parts.name
  from snap
  join parts on parts.organization_id = snap.organization_id
  left join live l on l.id = snap.test_case_id
  where l.id is null or not public.org_sees_audience(parts.type, l.audience)
$$;
