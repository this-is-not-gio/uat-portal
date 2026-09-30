-- Submitting no longer finishes the round (undoes 0017's step 3). Once every testing org has
-- submitted, the round stays in_progress and reads as "Submitted" until an Admin/Internal user
-- completes or stops it; until then any org can withdraw. That makes 0018's reopen-on-withdraw
-- branch unnecessary, so withdraw is back to "while the round is in progress".

-- 1. submit_participation: 0015's body (no auto-finish).
create or replace function public.submit_participation(p_iteration_id uuid)
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
    raise exception 'You can only submit while the round is in progress';
  end if;

  if not exists (
    select 1
    from public.iteration_participants
    where iteration_id = p_iteration_id
      and organization_id = public.current_org_id()
  ) then
    raise exception 'Your org is not a participant in this round';
  end if;

  update public.iteration_participants
  set submitted_at = now()
  where iteration_id = p_iteration_id
    and organization_id = public.current_org_id()
    and submitted_at is null
  returning * into v_participant;

  if v_participant.iteration_id is null then
    raise exception 'Your org has already submitted participation for this round';
  end if;

  return v_participant;
end;
$$;

-- 2. Withdraw: the caller's org submitted and the round is still in progress.
create or replace function public.can_withdraw_participation(p_iteration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_role_() in ('Internal', 'External')
    and exists (select 1 from public.test_iterations where id = p_iteration_id and status = 'in_progress')
    and exists (
      select 1 from public.iteration_participants
      where iteration_id = p_iteration_id and organization_id = public.current_org_id() and submitted_at is not null
    );
$$;

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

  if not public.can_withdraw_participation(p_iteration_id) then
    raise exception 'You can only withdraw a submission until the round is completed or stopped';
  end if;

  update public.iteration_participants
  set submitted_at = null
  where iteration_id = p_iteration_id
    and organization_id = public.current_org_id()
    and submitted_at is not null
  returning * into v_participant;
  return v_participant;
end;
$$;

revoke execute on function public.submit_participation(uuid) from anon, public;
grant execute on function public.submit_participation(uuid) to authenticated;
revoke execute on function public.can_withdraw_participation(uuid) from anon, public;
grant execute on function public.can_withdraw_participation(uuid) to authenticated;
revoke execute on function public.withdraw_participation(uuid) from anon, public;
grant execute on function public.withdraw_participation(uuid) to authenticated;

-- 3. Reopen rounds 0017 closed on the last submit (completed_at = last testing-org submitted_at)
-- while their suite is still in testing and no other round is open. Hand-completed rounds stay.
update public.test_iterations i
set status = 'in_progress', completed_at = null
where i.status = 'completed'
  and i.completed_at = (
    select max(p.submitted_at)
    from public.iteration_participants p
    join public.organizations o on o.id = p.organization_id
    where p.iteration_id = i.id and o.type <> 'vendor'
  )
  and exists (select 1 from public.testing_suites s where s.id = i.testing_suite_id and s.status = 'in_testing')
  and not exists (
    select 1 from public.test_iterations x
    where x.testing_suite_id = i.testing_suite_id and x.id <> i.id and x.status in ('not_started', 'in_progress')
  );
