-- Testers record results only on their own copies (#9). Since 0058 every tester has their own
-- copy of each in-scope case of their role, so "record own org" (0012) became too wide: anyone in
-- the org could write a colleague's copy or a case outside their role. Writes now need
-- tester_id = the caller. Users with no role and vendor staff hold no copies, so they record
-- nothing. Reading stays as it is (testers browse every copy visible to their org).
-- Remarks are not restricted by role: anyone who can see a step result can remark on it.

-- ---------------------------------------------------------------------------
-- Results
-- ---------------------------------------------------------------------------

drop policy "case results: record own org" on public.test_case_results;
create policy "case results: record own copy" on public.test_case_results for update to authenticated
  using (tester_id = (select auth.uid()))
  with check (tester_id = (select auth.uid()));

drop policy "step results: record own org" on public.test_step_results;
create policy "step results: record own copy" on public.test_step_results for update to authenticated
  using (exists (
    select 1 from public.test_case_results cr
    where cr.id = test_step_results.test_case_result_id and cr.tester_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.test_case_results cr
    where cr.id = test_step_results.test_case_result_id and cr.tester_id = (select auth.uid())
  ));

-- "Reset to auto" runs as the owner, so it checks ownership itself. Same body as 0011 otherwise.
create or replace function public.recompute_case_result_status(p_case_result_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.test_case_results
    where id = p_case_result_id and tester_id = (select auth.uid())
  ) then
    raise exception 'forbidden: execute' using errcode = '42501';
  end if;

  update public.test_case_results set status_overridden = false where id = p_case_result_id;
  perform public.apply_derived_case_status(p_case_result_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Remarks
-- ---------------------------------------------------------------------------

-- The step-result lookup runs under its own RLS, so "can see the step" is exactly the read rule.
drop policy "remarks: add on own org, or any as admin" on public.test_remarks;
create policy "remarks: add on any visible step" on public.test_remarks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (select 1 from public.test_step_results sr where sr.id = test_remarks.test_step_result_id)
  );
