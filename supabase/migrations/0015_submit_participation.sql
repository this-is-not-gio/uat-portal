-- RBAC Phase 6 (part 2): an External org marks its part of a round as done (playbook 6.1).
-- After this, 0014's guard rejects that org's result/step/remark writes until it withdraws.
-- Submitting with Untested cases is allowed (D2): the UI warns, the data stays Untested.

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

revoke execute on function public.submit_participation(uuid) from anon, public;
grant execute on function public.submit_participation(uuid) to authenticated;
