-- RBAC Phase 6 (part 1): External orgs submit their part of a round, and a submitted org is locked.
-- Decisions (tester-screens plan §5): only External orgs submit (D4: the client's "done" is Complete
-- round); after submit the org is read-only, and it can withdraw while the round is open (D3).
-- submit_participation itself is in 0015.

-- 1. New action for assert_can: submit. Same body as 0011 plus one branch.
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
    when 'submit' then v_allowed := v_role = 'External';
    else v_allowed := false;
  end case;
  if not coalesce(v_allowed, false) then
    raise exception 'forbidden: %', p_action using errcode = '42501';
  end if;
end;
$$;

-- 2. The lock (tester-screens edge case 15). Hiding buttons isn't enough: a teammate with the sheet
-- still open must be rejected too. It only locks your *own* org's rows, so the vendor's syncs and
-- Admin replies on a submitted org's rows (D1) still go through.
create or replace function public.guard_completed_iteration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.iteration_status;
  v_iteration_id uuid;
  v_org_id uuid;
begin
  if tg_table_name = 'test_case_results' then
    select i.status, i.id, new.organization_id into v_status, v_iteration_id, v_org_id
    from public.test_iterations i where i.id = new.iteration_id;
  elsif tg_table_name = 'test_step_results' then
    select i.status, i.id, cr.organization_id into v_status, v_iteration_id, v_org_id
    from public.test_case_results cr join public.test_iterations i on i.id = cr.iteration_id
    where cr.id = new.test_case_result_id;
  elsif tg_table_name = 'test_remarks' then
    if new.test_step_result_id is null then return new; end if;
    select i.status, i.id, cr.organization_id into v_status, v_iteration_id, v_org_id
    from public.test_step_results sr
    join public.test_case_results cr on cr.id = sr.test_case_result_id
    join public.test_iterations i on i.id = cr.iteration_id
    where sr.id = new.test_step_result_id;
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

  -- Separate ifs: SQL doesn't short-circuit OR, and each table has different columns.
  if v_status = 'not_started' then
    if tg_table_name = 'test_remarks' then
      raise exception 'Start the iteration before recording results';
    elsif tg_table_name = 'test_step_results' then
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

-- 3. Undo a submission while the round is still in progress (D3).
create or replace function public.withdraw_participation(p_iteration_id uuid)
returns public.iteration_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant public.iteration_participants;
begin
  perform public.assert_can('submit');

  if not exists (select 1 from public.test_iterations where id = p_iteration_id and status = 'in_progress') then
    raise exception 'You can only withdraw while the round is in progress';
  end if;

  update public.iteration_participants
  set submitted_at = null
  where iteration_id = p_iteration_id
    and organization_id = public.current_org_id()
    and submitted_at is not null
  returning * into v_participant;

  if v_participant.iteration_id is null then
    raise exception 'Your organization has not submitted this round';
  end if;
  return v_participant;
end;
$$;

-- 0010's default privileges only cover functions created by postgres, so revoke explicitly.
revoke execute on function public.withdraw_participation(uuid) from anon, public;
grant execute on function public.withdraw_participation(uuid) to authenticated;
