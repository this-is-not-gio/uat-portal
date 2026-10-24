-- derived_case_status gives the verdict the steps produce, which the action compares against the
-- clicked verdict: only a different verdict is an override. The cleanup in 0078 un-flags past
-- redundant clicks in running rounds and keeps real overrides.

do $$
declare
  v_vendor uuid := pg_temp.t_org('Vendor', 'vendor');
  v_int uuid := pg_temp.t_org('Licensing', 'client');
  v_role uuid := pg_temp.t_role(v_int, '[t] Approver');
  v_admin uuid := pg_temp.t_user('admin', 'Admin', v_vendor);
  v_a1 uuid := pg_temp.t_user('int approver', 'Internal', v_int, v_role);
  v_suite uuid := pg_temp.t_suite('Override rule');
  v_section uuid := pg_temp.t_section(v_suite, 'Main');
  v_case uuid := pg_temp.t_case(v_section, 'Approve claim', '[t] Approver');
  v_round uuid := pg_temp.t_round(v_suite);
  v_copy uuid;
  v_step uuid;
begin
  perform pg_temp.t_succeeds_as('staff scope and start the round', v_admin,
    format('select public.apply_iteration_sync(%L, null, array[%L]::uuid[]); select public.begin_iteration(%L)', v_round, v_case, v_round));
  select id into v_copy from public.test_case_results where iteration_id = v_round and tester_id = v_a1;
  select id into v_step from public.test_step_results where test_case_result_id = v_copy;

  perform pg_temp.t_eq('untested steps derive Untested', public.derived_case_status(v_copy)::text, 'Untested');
  perform pg_temp.t_succeeds_as('a step passes', v_a1,
    format('update public.test_step_results set status = ''Passed'' where id = %L', v_step));
  perform pg_temp.t_eq('all steps passed derive Passed', public.derived_case_status(v_copy)::text, 'Passed');

  -- Redundant click (what the action saves when the verdict matches): flag stays off, case follows steps
  perform pg_temp.t_succeeds_as('a tester confirms the derived verdict', v_a1,
    format('update public.test_case_results set status = ''Passed'', status_overridden = false, executed_by = %L where id = %L', v_a1, v_copy));
  perform pg_temp.t_succeeds_as('a step later fails', v_a1,
    format('update public.test_step_results set status = ''Failed'' where id = %L', v_step));
  perform pg_temp.t_eq('the confirmed case followed its steps', (select status::text from public.test_case_results where id = v_copy), 'Failed');

  -- Real override: flagged, frozen against step changes
  perform pg_temp.t_succeeds_as('a tester overrides to a different verdict', v_a1,
    format('update public.test_case_results set status = ''Passed'', status_overridden = true where id = %L', v_copy));
  perform pg_temp.t_succeeds_as('the step is blocked', v_a1,
    format('update public.test_step_results set status = ''Blocked'' where id = %L', v_step));
  perform pg_temp.t_eq('the override is kept', (select status::text from public.test_case_results where id = v_copy), 'Passed');

  -- 0078 cleanup rule: an override equal to the derived verdict is un-flagged, a different one is kept
  update public.test_case_results cr set status_overridden = false
  from public.test_iterations i
  where i.id = cr.iteration_id and i.status = 'in_progress' and cr.status_overridden
    and cr.status = public.derived_case_status(cr.id);
  perform pg_temp.t_eq('a real override survives the cleanup', (select status_overridden from public.test_case_results where id = v_copy), true);

  update public.test_case_results set status = 'Blocked' where id = v_copy;
  update public.test_case_results cr set status_overridden = false
  from public.test_iterations i
  where i.id = cr.iteration_id and i.status = 'in_progress' and cr.status_overridden
    and cr.status = public.derived_case_status(cr.id);
  perform pg_temp.t_eq('a redundant override is un-flagged by the cleanup', (select status_overridden from public.test_case_results where id = v_copy), false);
end $$;
