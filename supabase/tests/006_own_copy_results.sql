-- Testers record results only on their own copies (#9): a tester writes case and step
-- results on their own copy and nothing else, whether the target is a colleague's copy of the
-- same case, a case outside their role, or anything at all for a user with no role or vendor
-- staff. Reading stays org-wide, and remarks are open to anyone who can see the step.

do $$
declare
  v_vendor uuid := pg_temp.t_org('Vendor', 'vendor');
  v_int uuid := pg_temp.t_org('Licensing', 'client');
  v_ext uuid := pg_temp.t_org('Company B', 'external');
  v_int_approver uuid := pg_temp.t_role(v_int, '[t] Approver');
  v_int_encoder uuid := pg_temp.t_role(v_int, '[t] Encoder');
  v_ext_approver uuid := pg_temp.t_role(v_ext, '[t] Approver');
  v_admin uuid := pg_temp.t_user('admin', 'Admin', v_vendor);
  v_a1 uuid := pg_temp.t_user('int approver 1', 'Internal', v_int, v_int_approver);
  v_a2 uuid := pg_temp.t_user('int approver 2', 'Internal', v_int, v_int_approver);
  v_e1 uuid := pg_temp.t_user('int encoder', 'Internal', v_int, v_int_encoder);
  v_n1 uuid := pg_temp.t_user('int no role', 'Internal', v_int);
  v_b1 uuid := pg_temp.t_user('ext approver', 'External', v_ext, v_ext_approver);
  v_suite uuid := pg_temp.t_suite('Own copies');
  v_section uuid := pg_temp.t_section(v_suite, 'Main');
  v_approve uuid := pg_temp.t_case(v_section, 'Approve claim', '[t] Approver');
  v_encode uuid := pg_temp.t_case(v_section, 'Encode claim', '[t] Encoder');
  v_round uuid := pg_temp.t_round(v_suite);
  v_a1_copy uuid;
  v_a2_copy uuid;
  v_e1_copy uuid;
  v_b1_copy uuid;
  v_a1_step uuid;
  v_a2_step uuid;
  v_e1_step uuid;
  v_b1_step uuid;
begin
  perform pg_temp.t_succeeds_as('staff scope and start the round', v_admin,
    format('select public.apply_iteration_sync(%L, null, array[%L, %L]::uuid[]); select public.begin_iteration(%L)', v_round, v_approve, v_encode, v_round));

  select id into v_a1_copy from public.test_case_results where iteration_id = v_round and tester_id = v_a1;
  select id into v_a2_copy from public.test_case_results where iteration_id = v_round and tester_id = v_a2;
  select id into v_e1_copy from public.test_case_results where iteration_id = v_round and tester_id = v_e1;
  select id into v_b1_copy from public.test_case_results where iteration_id = v_round and tester_id = v_b1;
  select id into v_a1_step from public.test_step_results where test_case_result_id = v_a1_copy;
  select id into v_a2_step from public.test_step_results where test_case_result_id = v_a2_copy;
  select id into v_e1_step from public.test_step_results where test_case_result_id = v_e1_copy;
  select id into v_b1_step from public.test_step_results where test_case_result_id = v_b1_copy;

  -- Own copy: allowed
  perform pg_temp.t_succeeds_as('a tester records a step result on their own copy', v_a1,
    format('update public.test_step_results set status = ''Passed'' where id = %L', v_a1_step));
  perform pg_temp.t_eq('the step result is stored',
    (select status::text from public.test_step_results where id = v_a1_step), 'Passed');
  perform pg_temp.t_succeeds_as('a tester overrides the case result on their own copy', v_a1,
    format('update public.test_case_results set status = ''Failed'', status_overridden = true, executed_by = %L where id = %L', v_a1, v_a1_copy));
  perform pg_temp.t_eq('the case result is stored',
    (select status::text from public.test_case_results where id = v_a1_copy), 'Failed');
  perform pg_temp.t_succeeds_as('a tester resets their own copy to the derived status', v_a1,
    format('select public.recompute_case_result_status(%L)', v_a1_copy));
  perform pg_temp.t_eq('the copy is back on its derived status',
    (select status_overridden from public.test_case_results where id = v_a1_copy), false);

  -- Another tester's copy of the same case (same org, same role): rejected
  perform pg_temp.t_touches_nothing_as('a tester cannot record a step result on a colleague''s copy', v_a1,
    format('update public.test_step_results set status = ''Failed'' where id = %L returning 1', v_a2_step));
  perform pg_temp.t_touches_nothing_as('a tester cannot record a case result on a colleague''s copy', v_a1,
    format('update public.test_case_results set status = ''Failed'', status_overridden = true where id = %L returning 1', v_a2_copy));
  perform pg_temp.t_fails_as('a tester cannot reset a colleague''s copy', v_a1,
    format('select public.recompute_case_result_status(%L)', v_a2_copy), '%forbidden%');

  -- A case outside the tester's role (someone else's copy in the same org): rejected
  perform pg_temp.t_touches_nothing_as('a tester cannot record a step result on an out-of-role case', v_a1,
    format('update public.test_step_results set status = ''Passed'' where id = %L returning 1', v_e1_step));
  perform pg_temp.t_touches_nothing_as('a tester cannot record a case result on an out-of-role case', v_a1,
    format('update public.test_case_results set status = ''Passed'', status_overridden = true where id = %L returning 1', v_e1_copy));

  -- A user with no role: reads the org's cases, writes nothing
  perform pg_temp.t_eq('a user with no role can browse their org''s copies',
    pg_temp.t_count_as(v_n1, format('select 1 from public.test_case_results where iteration_id = %L and organization_id = %L', v_round, v_int)), 3);
  perform pg_temp.t_touches_nothing_as('a user with no role cannot record a step result', v_n1,
    format('update public.test_step_results set status = ''Passed'' where id = %L returning 1', v_a2_step));
  perform pg_temp.t_touches_nothing_as('a user with no role cannot record a case result', v_n1,
    format('update public.test_case_results set status = ''Passed'', status_overridden = true where id = %L returning 1', v_a2_copy));
  perform pg_temp.t_fails_as('a user with no role cannot reset a copy', v_n1,
    format('select public.recompute_case_result_status(%L)', v_a2_copy), '%forbidden%');

  -- Vendor staff: see and manage everything, record nothing
  perform pg_temp.t_eq('vendor staff see every copy',
    pg_temp.t_count_as(v_admin, format('select 1 from public.test_case_results where iteration_id = %L', v_round)), 4);
  perform pg_temp.t_touches_nothing_as('vendor staff cannot record a step result', v_admin,
    format('update public.test_step_results set status = ''Passed'' where id = %L returning 1', v_b1_step));
  perform pg_temp.t_touches_nothing_as('vendor staff cannot record a case result', v_admin,
    format('update public.test_case_results set status = ''Passed'', status_overridden = true where id = %L returning 1', v_b1_copy));
  perform pg_temp.t_fails_as('vendor staff cannot reset a copy', v_admin,
    format('select public.recompute_case_result_status(%L)', v_b1_copy), '%forbidden%');

  perform pg_temp.t_eq('none of the rejected writes landed',
    (select count(*)::int from public.test_step_results where id in (v_a2_step, v_e1_step, v_b1_step) and status <> 'Untested')
      + (select count(*)::int from public.test_case_results where id in (v_a2_copy, v_e1_copy, v_b1_copy) and status_overridden), 0);

  -- Browsing other roles' cases is still allowed
  perform pg_temp.t_eq('a tester can browse an out-of-role case in their org',
    pg_temp.t_count_as(v_a1, format('select 1 from public.test_step_results where id = %L', v_e1_step)), 1);

  -- Remarks are open to anyone who can see the step, whatever their role
  perform pg_temp.t_succeeds_as('a tester remarks on an out-of-role case', v_a1,
    format('insert into public.test_remarks (test_step_result_id, remark, created_by) values (%L, ''context'', %L)', v_e1_step, v_a1));
  perform pg_temp.t_succeeds_as('a user with no role remarks on a case', v_n1,
    format('insert into public.test_remarks (test_step_result_id, remark, created_by) values (%L, ''question'', %L)', v_a2_step, v_n1));
  perform pg_temp.t_succeeds_as('client staff remark on another org''s case they can see', v_a1,
    format('insert into public.test_remarks (test_step_result_id, remark, created_by) values (%L, ''cross-org'', %L)', v_b1_step, v_a1));
  perform pg_temp.t_succeeds_as('vendor staff remark on any case', v_admin,
    format('insert into public.test_remarks (test_step_result_id, remark, created_by) values (%L, ''reply'', %L)', v_b1_step, v_admin));
  perform pg_temp.t_fails_as('an external tester cannot remark on a case they can''t see', v_b1,
    format('insert into public.test_remarks (test_step_result_id, remark, created_by) values (%L, ''peek'', %L)', v_a2_step, v_b1));
end $$;
