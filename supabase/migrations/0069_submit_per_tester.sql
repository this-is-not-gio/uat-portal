-- Submission is per tester, not per org (reverses 0058's "stamped on every active tester").
-- Each rostered tester submits their own copies; an org counts as submitted once all of its
-- active testers have (read that way by the app, unchanged). Withdrawing and the write lock
-- are per tester too, so one person submitting no longer locks their teammates out.

create or replace function public.submit_participation(p_iteration_id uuid)
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
    where iteration_id = p_iteration_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'You are not a tester in this round';
  end if;

  update public.iteration_testers
  set submitted_at = v_at, withdrawn_at = null
  where iteration_id = p_iteration_id and user_id = auth.uid()
    and status = 'active' and submitted_at is null;
  if not found then
    raise exception 'You have already submitted your results for this round';
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
      where iteration_id = p_iteration_id and user_id = auth.uid() and submitted_at is not null
    );
$$;

create or replace function public.withdraw_participation(p_iteration_id uuid)
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
  where iteration_id = p_iteration_id and user_id = auth.uid() and submitted_at is not null;
end;
$$;

-- Same as 0061, except the lock follows the signed-in tester's own submission, not the org's.
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
    where t.iteration_id = v_iteration_id and t.user_id = auth.uid() and t.submitted_at is not null
  ) then
    raise exception 'You already submitted your results for this round. Withdraw your submission to make changes.';
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

-- Internal can't complete the round while one of its own testers hasn't submitted (message only).
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
    raise exception 'Every tester in your organization must submit their results before you complete the round';
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
