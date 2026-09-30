-- Internal/External can withdraw their submission until the round is closed by hand (Complete
-- or Stop). 0017 lets the last testing org's submit finish the round; that auto-finish no longer
-- blocks withdraw: withdrawing reopens the round (back to in_progress) and clears the caller's
-- submission. "Finished by submissions" = completed_at is the last testing org's submitted_at
-- (0017 stamps both with the same now()). Suite must still be in testing and no other round open.

-- One rule for the DB and the UI. Security definer because RLS hides other orgs'
-- participant rows from External, and the check needs every testing org's submitted_at.
create or replace function public.can_withdraw_participation(p_iteration_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.current_role_() in ('Internal', 'External')
    and exists (
      select 1 from public.iteration_participants
      where iteration_id = p_iteration_id and organization_id = public.current_org_id() and submitted_at is not null
    )
    and exists (
      select 1
      from public.test_iterations i
      where i.id = p_iteration_id
        and (
          i.status = 'in_progress'
          or (
            i.status = 'completed'
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
            )
          )
        )
    );
$$;

revoke execute on function public.can_withdraw_participation(uuid) from anon, public;
grant execute on function public.can_withdraw_participation(uuid) to authenticated;

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

  perform 1 from public.test_iterations where id = p_iteration_id for update;

  if not public.can_withdraw_participation(p_iteration_id) then
    raise exception 'You can only withdraw a submission until the round is completed or stopped';
  end if;

  -- Finished by the submissions: reopen it.
  update public.test_iterations
  set status = 'in_progress', completed_at = null
  where id = p_iteration_id and status = 'completed';

  update public.iteration_participants
  set submitted_at = null
  where iteration_id = p_iteration_id
    and organization_id = public.current_org_id()
    and submitted_at is not null
  returning * into v_participant;
  return v_participant;
end;
$$;

revoke execute on function public.withdraw_participation(uuid) from anon, public;
grant execute on function public.withdraw_participation(uuid) to authenticated;
