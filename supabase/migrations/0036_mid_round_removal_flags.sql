-- Testers learn what happened to a case mid-round only once the vendor approves it in Sync.
-- Updated / Reset already had sync_kind values; this adds the two removal flags.
--   removed            the live case was deleted from the suite
--   audience_changed   the case still exists but its audience no longer includes this org
-- A started round's case set stays locked (0023): approving a removal mid-round never deletes the
-- row. It keeps its results, drops out of the run (included_in_run = false, so progress, submission
-- and sign-off counts skip it) and turns view only for testers. Planned rounds still delete as before.
--   test_case_results.sync_kind   + removed, audience_changed
--   apply_iteration_sync          p_remove allowed mid-round: marks instead of deleting
--   guard_completed_iteration     no result writes on a removed row (remarks still allowed, 0020)
--   get_iteration_changes         + audience_changed; already-marked rows are no longer pending

alter table public.test_case_results drop constraint test_case_results_sync_kind_check;
alter table public.test_case_results add constraint test_case_results_sync_kind_check
  check (sync_kind = any (array['added', 'updated', 'force_reset', 'removed', 'audience_changed']));

create or replace function public.apply_iteration_sync(p_iteration_id uuid, p_by uuid default null, p_add uuid[] default '{}'::uuid[], p_refresh uuid[] default '{}'::uuid[], p_remove uuid[] default '{}'::uuid[])
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
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

    if v_status = 'not_started' then
      perform public.remove_case_result(v_id); -- rejects rows with results
      continue;
    end if;

    -- Running round: flag it, keep it. Only rows whose live case really is gone for this org.
    select case
             when tc.id is null then 'removed'
             when not public.org_sees_audience(o.type, tc.audience) then 'audience_changed'
           end
    into v_kind
    from public.test_case_results cr
    join public.organizations o on o.id = cr.organization_id
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
$function$;

create or replace function public.guard_completed_iteration()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
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
    select 1 from public.iteration_participants p
    where p.iteration_id = v_iteration_id and p.organization_id = v_org_id and p.submitted_at is not null
  ) then
    raise exception 'Your organization already submitted this round. Withdraw the submission to make changes.';
  end if;

  -- Removed mid-round (0036): results are kept as they were, view only.
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
$function$;

-- Return type changes (+ audience_changed), so drop and recreate.
drop function public.get_iteration_changes(uuid);

create function public.get_iteration_changes(p_iteration_id uuid)
 returns table(change text, test_case_id uuid, test_case_result_id uuid, code text, title text, has_results boolean, organization_id uuid, organization_name text, incomplete boolean, audience_changed boolean)
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
  -- Rows already flagged removed (0036) were synced; they're no longer pending.
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
  -- Incomplete cases are never offered as "added" (sync_iteration skips them anyway).
  select 'added', l.id, null::uuid, l.code, l.title, false, parts.organization_id, parts.name, false, false
  from live l cross join parts cross join it
  where public.org_sees_audience(parts.type, l.audience)
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
  where public.org_sees_audience(parts.type, l.audience)
    and snap.source_hash is distinct from public.test_case_content_hash(snap.test_case_id)
  union all
  select 'removed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results, parts.organization_id, parts.name, false, l.id is not null
  from snap
  join parts on parts.organization_id = snap.organization_id
  left join live l on l.id = snap.test_case_id
  where l.id is null or not public.org_sees_audience(parts.type, l.audience)
$function$;

revoke execute on function public.get_iteration_changes(uuid) from public, anon;
grant execute on function public.get_iteration_changes(uuid) to authenticated;
