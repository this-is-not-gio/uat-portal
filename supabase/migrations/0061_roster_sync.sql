-- Roster sync (#12). The roster is fixed at Start (0058), but who holds a role keeps changing.
-- Those changes now show up in the Sync dialog next to case-content changes, and staff choose
-- which to apply; nothing is applied automatically.
--   * tester_joined: a user now holds an in-scope role in a participating org (an org with someone
--     on the roster). Applying it adds them to the roster and creates their copies of the in-scope
--     cases of their role. Users staff unticked while planning are left out on purpose.
--   * tester_dropped: a rostered tester no longer holds the role they were rostered for (lost it,
--     switched role or org) or was deactivated (banned in auth). Applying it marks them dropped and
--     freezes their copies: out of the run (included_in_run = false), flagged
--     sync_kind = 'tester_dropped', and view only. Results are never deleted.
-- A dropped tester who regains the role is reported as joined again; applying it gives back their
-- frozen copies of that role and creates any they're missing.

alter table public.test_case_results drop constraint test_case_results_sync_kind_check;
alter table public.test_case_results add constraint test_case_results_sync_kind_check
  check (sync_kind = any (array['added', 'updated', 'force_reset', 'removed', 'audience_changed', 'tester_dropped']));

-- ---------------------------------------------------------------------------
-- Detection
-- ---------------------------------------------------------------------------

-- Roster drift of a running round (empty for any other status). One row per change; a tester who
-- switched to another in-scope role gets a dropped row (old role) and a joined row (new role).
create function public.round_roster_drift(p_iteration_id uuid)
returns table(change text, user_id uuid, full_name text, organization_id uuid, organization_name text, test_role_id uuid, test_role_name text)
language sql
stable
security definer
set search_path = ''
as $$
  with it as (
    select id from public.test_iterations where id = p_iteration_id and status = 'in_progress'
  ),
  -- Roles the round runs: those of its copies, except copies of cases taken out by Sync.
  scope_roles as (
    select distinct cr.test_role_id
    from public.test_case_results cr join it on it.id = cr.iteration_id
    where cr.tester_id is not null and cr.test_role_id is not null
      and cr.sync_kind is distinct from 'removed' and cr.sync_kind is distinct from 'audience_changed'
  ),
  orgs as (
    select distinct t.organization_id from public.iteration_testers t join it on it.id = t.iteration_id
  ),
  -- Who holds which role right now. Deactivated (banned) users hold nothing.
  holding as (
    select p.id as user_id, p.full_name, r.organization_id, r.test_role_id
    from public.profiles p
    join public.organization_roles r on r.id = p.org_role_id
    join auth.users u on u.id = p.id
    where u.banned_until is null or u.banned_until <= now()
  )
  select 'tester_joined', h.user_id, h.full_name, h.organization_id, o.name, h.test_role_id, tr.name
  from holding h
  join public.organizations o on o.id = h.organization_id
  join public.test_roles tr on tr.id = h.test_role_id
  where h.organization_id in (select organization_id from orgs)
    and h.test_role_id in (select test_role_id from scope_roles)
    and not exists (
      select 1 from public.iteration_testers t
      where t.iteration_id = p_iteration_id and t.user_id = h.user_id and t.status = 'active'
        and t.test_role_id = h.test_role_id and t.organization_id = h.organization_id
    )
    and not exists (
      select 1 from public.iteration_excluded_testers x where x.iteration_id = p_iteration_id and x.user_id = h.user_id
    )
  union all
  select 'tester_dropped', t.user_id, p.full_name, t.organization_id, o.name, t.test_role_id, tr.name
  from public.iteration_testers t
  join it on it.id = t.iteration_id
  join public.profiles p on p.id = t.user_id
  join public.organizations o on o.id = t.organization_id
  join public.test_roles tr on tr.id = t.test_role_id
  where t.status = 'active'
    and not exists (
      select 1 from holding h
      where h.user_id = t.user_id and h.test_role_id = t.test_role_id and h.organization_id = t.organization_id
    )
$$;
revoke execute on function public.round_roster_drift(uuid) from public, anon, authenticated;

-- Same as 0058 plus roster rows (Admins, who sync): user_id and test_role_name are set on them,
-- organization_id / organization_name are the tester's org, title is the tester's name, and
-- has_results says whether a dropped tester has results that will be kept. Frozen copies no longer
-- drive case changes (they're out of the run and never refreshed by force).
drop function public.get_iteration_changes(uuid);
create function public.get_iteration_changes(p_iteration_id uuid)
returns table(change text, test_case_id uuid, test_case_result_id uuid, code text, title text, has_results boolean, organization_id uuid, organization_name text, incomplete boolean, audience_changed boolean, user_id uuid, test_role_name text)
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
      and cr.sync_kind is distinct from 'tester_dropped'
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
  select 'added', l.id, null::uuid, l.code, l.title, false, null::uuid, null::text, false, false, null::uuid, null::text
  from live l cross join it cross join me
  where me.sees_all
    and not exists (select 1 from public.test_case_results cr where cr.iteration_id = p_iteration_id and cr.test_case_id = l.id)
    and l.created_at > it.started_at
    and not exists (select 1 from public.test_case_issues(l.id))
  union all
  select 'changed', v.test_case_id, v.rep_id, v.code, v.title, v.has_results, null, null,
    exists (select 1 from public.test_case_issues(v.test_case_id)), false, null, null
  from visible v
  join live l on l.id = v.test_case_id
  cross join it
  where v.stale
    and (it.status = 'not_started' or l.test_role_id is not distinct from v.test_role_id)
  union all
  select 'removed', v.test_case_id, v.rep_id, v.code, v.title, v.has_results, null, null, false, l.id is not null, null, null
  from visible v
  left join live l on l.id = v.test_case_id
  cross join it
  where l.id is null
    or (it.status <> 'not_started' and l.test_role_id is distinct from v.test_role_id)
  union all
  select d.change, null, null, null, d.full_name,
    d.change = 'tester_dropped' and exists (
      select 1 from public.test_case_results cr
      where cr.iteration_id = p_iteration_id and cr.tester_id = d.user_id and public.case_result_has_results(cr.id)
    ),
    d.organization_id, d.organization_name, false, false, d.user_id, d.test_role_name
  from public.round_roster_drift(p_iteration_id) d
  where public.current_role_() = 'Admin' -- only those who can sync (assert_can('sync'))
$$;

-- ---------------------------------------------------------------------------
-- Apply
-- ---------------------------------------------------------------------------

-- Same as 0058 plus p_join / p_drop (user ids from get_iteration_changes' roster rows; running
-- rounds only). Each must still be reported by round_roster_drift when applied. Drops run before
-- joins, so a role switch is applied by passing the user in both. Frozen copies keep their flag
-- through a content refresh and are skipped by removals.
drop function public.apply_iteration_sync(uuid, uuid, uuid[], uuid[], uuid[]);
create function public.apply_iteration_sync(p_iteration_id uuid, p_by uuid default null::uuid, p_add uuid[] default '{}'::uuid[], p_refresh uuid[] default '{}'::uuid[], p_remove uuid[] default '{}'::uuid[], p_join uuid[] default '{}'::uuid[], p_drop uuid[] default '{}'::uuid[])
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
  v_role uuid;
  v_org uuid;
begin
  perform public.assert_can('sync');

  select status into v_status from public.test_iterations where id = p_iteration_id;
  if v_status is null or v_status not in ('not_started', 'in_progress') then
    raise exception 'Iteration % is not open', p_iteration_id;
  end if;

  if v_status <> 'not_started' and cardinality(coalesce(p_add, '{}')) > 0 then
    raise exception 'This round has already started, so the test cases it runs are locked.' using errcode = 'P0001';
  end if;
  if v_status <> 'in_progress' and cardinality(coalesce(p_join, '{}')) + cardinality(coalesce(p_drop, '{}')) > 0 then
    raise exception 'Roster changes only apply to a running round.' using errcode = 'P0001';
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
      set sync_kind = case when sync_kind = 'tester_dropped' then sync_kind else 'updated' end, synced_at = now(), synced_by = p_by
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

  -- Drops: mark the tester dropped and freeze their copies (results stay).
  foreach v_id in array coalesce(p_drop, '{}') loop
    perform 1 from public.round_roster_drift(p_iteration_id) d where d.change = 'tester_dropped' and d.user_id = v_id;
    if not found then
      raise exception 'Tester % is not dropped from this round', v_id using errcode = 'P0001';
    end if;

    update public.iteration_testers set status = 'dropped'
    where iteration_id = p_iteration_id and user_id = v_id;

    update public.test_case_results
    set included_in_run = false, sync_kind = 'tester_dropped', synced_at = now(), synced_by = p_by
    where iteration_id = p_iteration_id and tester_id = v_id and included_in_run
      and sync_kind is distinct from 'removed' and sync_kind is distinct from 'audience_changed';
  end loop;

  -- Joins: (re)activate the roster row, give back frozen copies of the role, create the rest.
  foreach v_id in array coalesce(p_join, '{}') loop
    select d.test_role_id, d.organization_id into v_role, v_org
    from public.round_roster_drift(p_iteration_id) d where d.change = 'tester_joined' and d.user_id = v_id;
    if not found then
      raise exception 'User % has not joined this round', v_id using errcode = 'P0001';
    end if;
    if exists (select 1 from public.iteration_testers where iteration_id = p_iteration_id and user_id = v_id and status = 'active') then
      raise exception 'This tester switched role: apply their drop from the previous role along with the join.' using errcode = 'P0001';
    end if;

    insert into public.iteration_testers (iteration_id, user_id, test_role_id, organization_id)
    values (p_iteration_id, v_id, v_role, v_org)
    on conflict (iteration_id, user_id) do update
      set test_role_id = excluded.test_role_id, organization_id = excluded.organization_id,
          status = 'active', submitted_at = null, withdrawn_at = null;

    -- Frozen copies of this role whose case still exists with it.
    update public.test_case_results cr
    set included_in_run = true, sync_kind = null, synced_at = null, synced_by = null, organization_id = v_org
    from public.test_cases tc
    where cr.iteration_id = p_iteration_id and cr.tester_id = v_id and cr.sync_kind = 'tester_dropped'
      and cr.test_role_id = v_role and tc.id = cr.test_case_id and tc.test_role_id = v_role;

    -- A copy of every other in-scope case of the role, from a sibling copy (the newest synced
    -- version, so every copy tests the same content), steps included.
    with src as (
      select distinct on (cr.test_case_id) cr.*
      from public.test_case_results cr
      where cr.iteration_id = p_iteration_id and cr.tester_id is not null and cr.test_case_id is not null
        and cr.test_role_id = v_role
        and cr.sync_kind is distinct from 'removed' and cr.sync_kind is distinct from 'audience_changed'
        and not exists (
          select 1 from public.test_case_results mine
          where mine.iteration_id = p_iteration_id and mine.tester_id = v_id and mine.test_case_id = cr.test_case_id
        )
      order by cr.test_case_id, coalesce(cr.source_hash = public.test_case_content_hash(cr.test_case_id), false) desc, cr.id
    ),
    copies as (
      insert into public.test_case_results
        (iteration_id, organization_id, tester_id, test_case_id, code, title, section_name, section_slug, section_order, order_index, test_role_id, priority, preconditions, source_hash)
      select src.iteration_id, v_org, v_id, src.test_case_id, src.code, src.title, src.section_name, src.section_slug, src.section_order,
        src.order_index, src.test_role_id, src.priority, src.preconditions, src.source_hash
      from src
      returning id, test_case_id
    )
    insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
    select c.id, sr.test_step_id, sr.order_index, sr.step, sr.expected_results
    from copies c
    join src on src.test_case_id = c.test_case_id
    join public.test_step_results sr on sr.test_case_result_id = src.id;
  end loop;
end;
$$;

-- Force refresh (0058) leaves a dropped tester's frozen copies and their results alone.
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
      and cr.sync_kind is distinct from 'tester_dropped'
  loop
    perform public.force_refresh_case_result_one(v_sibling, p_by, p_reason);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Frozen copies are view only
-- ---------------------------------------------------------------------------

-- Same as 0058, plus: a dropped tester's copies reject result writes, and a frozen row can't be
-- put back into the run by its tester (included_in_run is theirs to update, 0012; sync_kind isn't,
-- so only the sync RPCs, which change both together, can).
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
  v_message text;
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

  if v_sync_kind in ('removed', 'audience_changed', 'tester_dropped') then
    v_message := case when v_sync_kind = 'tester_dropped'
      then 'This tester was dropped from the round, so their results are view only.'
      else 'This test case was removed from the round, so its results are view only.' end;
    if tg_table_name = 'test_step_results' then
      if new.status is distinct from old.status then
        raise exception '%', v_message using errcode = 'P0001';
      end if;
    elsif new.status is distinct from old.status
      or new.status_overridden is distinct from old.status_overridden
      or new.executed_by is distinct from old.executed_by
      or (new.included_in_run is distinct from old.included_in_run and new.sync_kind is not distinct from old.sync_kind) then
      raise exception '%', v_message using errcode = 'P0001';
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
-- Reset
-- ---------------------------------------------------------------------------

-- Same as 0058, plus: sync flags are cleared before results are reset, since frozen rows (removed,
-- role changed, tester dropped) reject result writes. A dropped tester's copies go with the roster.
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

  update public.test_case_results
  set sync_kind = null, synced_at = null, synced_by = null
  where iteration_id = p_iteration_id and sync_kind is not null;

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
