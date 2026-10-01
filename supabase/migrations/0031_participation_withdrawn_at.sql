-- Test Results status badge: tell "Withdrawn" apart from "never submitted". Withdrawing used to
-- only null submitted_at, leaving no trace; withdrawn_at keeps it until the org submits again.

alter table public.iteration_participants add column if not exists withdrawn_at timestamptz;

-- 1. submit_participation: 0019's body, and a fresh submit clears the earlier withdrawal.
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
  set submitted_at = now(), withdrawn_at = null
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

-- 2. withdraw_participation: 0019's body, and it records when.
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
  set submitted_at = null, withdrawn_at = now()
  where iteration_id = p_iteration_id
    and organization_id = public.current_org_id()
    and submitted_at is not null
  returning * into v_participant;
  return v_participant;
end;
$$;

revoke execute on function public.submit_participation(uuid) from anon, public;
grant execute on function public.submit_participation(uuid) to authenticated;
revoke execute on function public.withdraw_participation(uuid) from anon, public;
grant execute on function public.withdraw_participation(uuid) to authenticated;
