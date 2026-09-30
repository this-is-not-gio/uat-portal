-- Once a round starts, the set of test cases it runs is fixed (same rule as set_case_inclusion, 0022).
-- apply_iteration_sync still refreshes content on planned and running rounds, but adding or
-- removing cases (Sync "Added"/"Removed", Add Section, Add test cases, Remove section) is only
-- allowed while the round is planned (not_started). Adding a participant mid-round is unaffected:
-- it gives the new org rows for the round's existing cases and doesn't change the case set.

create or replace function public.apply_iteration_sync(p_iteration_id uuid, p_by uuid default null, p_add uuid[] default '{}'::uuid[], p_refresh uuid[] default '{}'::uuid[], p_remove uuid[] default '{}'::uuid[])
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_status public.iteration_status;
  v_new_ids uuid[];
  v_id uuid;
begin
  perform public.assert_can('sync');

  select status into v_status from public.test_iterations where id = p_iteration_id;
  if v_status is null or v_status not in ('not_started', 'in_progress') then
    raise exception 'Iteration % is not open', p_iteration_id;
  end if;

  if v_status <> 'not_started' and (cardinality(coalesce(p_add, '{}')) > 0 or cardinality(coalesce(p_remove, '{}')) > 0) then
    raise exception 'This round has already started, so the test cases it runs are locked.' using errcode = 'P0001';
  end if;

  -- Collect the new ids first: an UPDATE in the same statement wouldn't see rows the function inserts.
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
    perform public.refresh_case_result(v_id); -- rejects rows with results
    update public.test_case_results
    set sync_kind = 'updated', synced_at = now(), synced_by = p_by
    where id = v_id;
  end loop;

  foreach v_id in array coalesce(p_remove, '{}') loop
    if not exists (select 1 from public.test_case_results where id = v_id and iteration_id = p_iteration_id) then
      raise exception 'Case result % does not belong to this iteration', v_id;
    end if;
    perform public.remove_case_result(v_id); -- rejects rows with results
  end loop;
end;
$function$;
