-- The last testing org to submit finishes the round: once every Internal/External participant
-- has submitted, submit_participation marks the iteration completed (same update as
-- complete_iteration). The vendor never submits, so its participant row doesn't hold it open.
-- Body is 0015's plus step 3.

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

  -- 3. Everyone's in: finish the round.
  if not exists (
    select 1
    from public.iteration_participants p
    join public.organizations o on o.id = p.organization_id
    where p.iteration_id = p_iteration_id
      and o.type <> 'vendor'
      and p.submitted_at is null
  ) then
    update public.test_iterations
    set status = 'completed', completed_at = now()
    where id = p_iteration_id and status = 'in_progress';
  end if;

  return v_participant;
end;
$$;
