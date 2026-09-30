-- Remarks stay open after an org submits and after a round is completed or stopped, so testers and
-- the vendor can keep discussing a result. Statuses and case results stay locked as in 0014.
-- Remarks still need a started round, and RLS still limits them to your own org (Admin: any org).
-- Same body as 0014 plus the early test_remarks branch.
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
    select i.status, i.id, new.organization_id into v_status, v_iteration_id, v_org_id
    from public.test_iterations i where i.id = new.iteration_id;
  elsif tg_table_name = 'test_step_results' then
    select i.status, i.id, cr.organization_id into v_status, v_iteration_id, v_org_id
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

  -- Separate ifs: SQL doesn't short-circuit OR, and each table has different columns.
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
