-- Login is back (RBAC playbook Phase 1), so the dev-only anon write stopgaps go.
drop policy if exists "TEMP anon can record step status" on public.test_steps;
drop policy if exists "TEMP anon can update test case status" on public.test_cases;
drop policy if exists "TEMP anon can add a remark" on public.test_remarks;
drop policy if exists "TEMP anon can read profiles" on public.profiles;
drop policy if exists "TEMP anon can record case result" on public.test_case_results;
drop policy if exists "TEMP anon can record step result" on public.test_step_results;
