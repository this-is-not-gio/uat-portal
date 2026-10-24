-- A tester clicking the verdict the steps already give is a confirmation, not an override.
-- Only a verdict that differs from the derived one sets status_overridden (and stops the case
-- following its steps). This adds the derivation as a read-only function so the action can compare.

-- Same rule as apply_derived_case_status (Failed > Blocked > all Untested > In Progress > Passed),
-- but returns the status instead of saving it. Null when the case has no steps.
create or replace function public.derived_case_status(p_case_result_id uuid)
returns public.test_case_status
language sql
stable
set search_path = ''
as $$
  select case
    when count(*) = 0 then null
    when count(*) filter (where status = 'Failed') > 0 then 'Failed'
    when count(*) filter (where status = 'Blocked') > 0 then 'Blocked'
    when count(*) filter (where status = 'Untested') = count(*) then 'Untested'
    when count(*) filter (where status = 'Untested') > 0 then 'In Progress'
    when count(*) filter (where status = 'Passed') > 0 then 'Passed'
    else 'Untested'
  end::public.test_case_status
  from public.test_step_results
  where test_case_result_id = p_case_result_id;
$$;

grant execute on function public.derived_case_status(uuid) to authenticated;

-- Clean up past redundant clicks in running rounds: flagged cases whose verdict equals what the
-- steps give follow their steps again. Real overrides (different verdict) are untouched. Other
-- rounds are left alone (the round guards reject edits outside a running round).
update public.test_case_results cr
set status_overridden = false
from public.test_iterations i
where i.id = cr.iteration_id
  and i.status = 'in_progress'
  and cr.status_overridden
  and cr.sync_kind is distinct from 'removed'
  and cr.status = public.derived_case_status(cr.id);
