-- Withdraw an organization from a planned or running round: the inverse of add_iteration_participant.
-- Only while none of that org's case results have recorded results yet (same rule
-- remove_case_result / cancel_iteration use), so no testing history is lost. Deleting the
-- participant row cascades to its test_case_results (test_case_results_participant_fkey).

create or replace function public.remove_iteration_participant(p_iteration_id uuid, p_org_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform public.assert_can('run_iteration');

  perform 1 from public.test_iterations
  where id = p_iteration_id and status in ('not_started', 'in_progress')
  for update;
  if not found then
    raise exception 'Iteration % is not open', p_iteration_id;
  end if;

  if exists (
    select 1 from public.test_case_results cr
    where cr.iteration_id = p_iteration_id and cr.organization_id = p_org_id
      and public.case_result_has_results(cr.id)
  ) then
    raise exception 'This organization has already recorded results in this round, so it stays in it.' using errcode = 'P0001';
  end if;

  delete from public.iteration_participants
  where iteration_id = p_iteration_id and organization_id = p_org_id;
  if not found then
    raise exception 'This organization is not taking part in the iteration';
  end if;
end;
$function$;

revoke execute on function public.remove_iteration_participant(uuid, uuid) from public, anon;
grant execute on function public.remove_iteration_participant(uuid, uuid) to authenticated;
