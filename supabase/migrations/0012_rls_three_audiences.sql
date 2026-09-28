-- RBAC Phase 4 (part 3): RLS for the three audiences. Replaces every policy on these tables.
-- Pattern: a child table is visible when its parent row is. `exists (select 1 from parent ...)`
-- runs under the parent's own RLS, so each visibility rule is written once, on the parent:
--   test_cases        -> preconditions, test_steps -> expected_results
--   test_case_results -> test_step_results -> test_remarks; test_case_result_archives
-- Writes: authoring tables = Admin only (the RPCs are security definer and skip this anyway);
-- results = your own org's rows only, for every role (D1); remarks = own org, or Admin on any org.
-- Helpers are wrapped in (select ...) so Postgres evaluates them once per query, not per row.

do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in (
      'testing_suites', 'sections', 'test_cases', 'preconditions', 'test_steps', 'expected_results',
      'organizations', 'profiles', 'test_iterations', 'iteration_participants',
      'test_case_results', 'test_step_results', 'test_remarks', 'test_case_result_archives',
      'suite_sign_offs', 'test_executions'
    )
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end;
$$;

-- Authoring (template) tables ---------------------------------------------------

create policy "suites: read" on public.testing_suites for select to authenticated using (true);
create policy "sections: read" on public.sections for select to authenticated using (true);

-- External only sees cases meant for them; staff see every case.
create policy "cases: read by audience" on public.test_cases for select to authenticated
  using ((select public.can_see_all_results()) or audience in ('external', 'both'));

create policy "preconditions: read with case" on public.preconditions for select to authenticated
  using (exists (select 1 from public.test_cases tc where tc.id = preconditions.test_case_id));
create policy "steps: read with case" on public.test_steps for select to authenticated
  using (exists (select 1 from public.test_cases tc where tc.id = test_steps.test_case_id));
create policy "expected results: read with step" on public.expected_results for select to authenticated
  using (exists (select 1 from public.test_steps ts where ts.id = expected_results.test_step_id));

do $$
declare t text;
begin
  foreach t in array array['testing_suites', 'sections', 'test_cases', 'preconditions', 'test_steps', 'expected_results']
  loop
    execute format('create policy "admin: insert" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "admin: update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "admin: delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end;
$$;

-- Organizations and profiles ----------------------------------------------------

-- The vendor org is visible to everyone: Admins remark on External rows (D1), so External
-- needs to resolve those authors' names and org.
create policy "orgs: own, vendor, or staff" on public.organizations for select to authenticated
  using (
    id = (select public.current_org_id())
    or type = 'vendor'
    or (select public.can_see_all_results())
  );
create policy "orgs: admin insert" on public.organizations for insert to authenticated
  with check ((select public.is_admin()));
create policy "orgs: admin update" on public.organizations for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- The organizations subquery runs under the policy above, so it only returns the vendor org
-- plus orgs the caller can already see.
create policy "profiles: own org, vendor, or staff" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or organization_id = (select public.current_org_id())
    or organization_id in (select o.id from public.organizations o where o.type = 'vendor')
    or (select public.can_see_all_results())
  );
-- The column grant from 0003 limits this to full_name, so nobody can change their own role or org.
create policy "profiles: update own name" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Iterations and participants (written only through RPCs) ------------------------

create policy "iterations: staff or participating org" on public.test_iterations for select to authenticated
  using (
    (select public.can_see_all_results())
    or exists (
      select 1 from public.iteration_participants p
      where p.iteration_id = test_iterations.id and p.organization_id = (select public.current_org_id())
    )
  );

-- External sees only its own participation, not which other companies take part.
create policy "participants: staff or own org" on public.iteration_participants for select to authenticated
  using ((select public.can_see_all_results()) or organization_id = (select public.current_org_id()));

-- Results ------------------------------------------------------------------------

-- Admin + Internal see every org's results; External only its own. Every table below inherits this.
create policy "case results: read" on public.test_case_results for select to authenticated
  using ((select public.can_see_all_results()) or organization_id = (select public.current_org_id()));

create policy "case results: record own org" on public.test_case_results for update to authenticated
  using (organization_id = (select public.current_org_id()))
  with check (organization_id = (select public.current_org_id()));

create policy "step results: read with case" on public.test_step_results for select to authenticated
  using (exists (select 1 from public.test_case_results cr where cr.id = test_step_results.test_case_result_id));

create policy "step results: record own org" on public.test_step_results for update to authenticated
  using (exists (
    select 1 from public.test_case_results cr
    where cr.id = test_step_results.test_case_result_id and cr.organization_id = (select public.current_org_id())
  ))
  with check (exists (
    select 1 from public.test_case_results cr
    where cr.id = test_step_results.test_case_result_id and cr.organization_id = (select public.current_org_id())
  ));

-- Testers only record outcomes. Snapshot columns (title, steps, source_hash, org...) change only
-- through the sync RPCs, which run as the owner.
revoke update on public.test_case_results from authenticated;
grant update (status, status_overridden, executed_by, completed_at, included_in_run) on public.test_case_results to authenticated;
revoke update on public.test_step_results from authenticated;
grant update (status) on public.test_step_results to authenticated;

-- Remarks ------------------------------------------------------------------------

-- Pre-iteration remarks hang off template steps (test_step_id only); staff-only history.
create policy "remarks: read with step result" on public.test_remarks for select to authenticated
  using (
    (test_step_result_id is not null
      and exists (select 1 from public.test_step_results sr where sr.id = test_remarks.test_step_result_id))
    or (test_step_result_id is null and (select public.can_see_all_results()))
  );

create policy "remarks: add on own org, or any as admin" on public.test_remarks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.test_step_results sr
      join public.test_case_results cr on cr.id = sr.test_case_result_id
      where sr.id = test_remarks.test_step_result_id
        and (cr.organization_id = (select public.current_org_id()) or (select public.is_admin()))
    )
  );

create policy "remarks: author edits text" on public.test_remarks for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

-- Only the text is editable, so a remark can't be moved onto another org's step.
revoke update on public.test_remarks from authenticated;
grant update (remark) on public.test_remarks to authenticated;

-- Archives, sign-offs, legacy executions (read-only; written by RPCs) --------------

create policy "archives: read with case result" on public.test_case_result_archives for select to authenticated
  using (exists (select 1 from public.test_case_results cr where cr.id = test_case_result_archives.test_case_result_id));

create policy "sign-offs: staff read" on public.suite_sign_offs for select to authenticated
  using ((select public.can_see_all_results()));

create policy "executions: staff read" on public.test_executions for select to authenticated
  using ((select public.can_see_all_results()));
