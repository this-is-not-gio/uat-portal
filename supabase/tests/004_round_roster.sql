-- Round roster and per-tester copies (#8): coverage lists the roles a scope needs with the
-- orgs and users holding them (ticked unless unticked), Start is rejected while a role has no
-- ticked tester or a case has no role, and Start gives every ticked tester their own copy of
-- each in-scope case of their role. Case-content sync reaches every copy.

do $$
declare
  v_vendor uuid := pg_temp.t_org('Vendor', 'vendor');
  v_int uuid := pg_temp.t_org('Licensing', 'client');
  v_ext uuid := pg_temp.t_org('Company B', 'external');
  v_int_approver uuid := pg_temp.t_role(v_int, '[t] Approver');
  v_int_encoder uuid := pg_temp.t_role(v_int, '[t] Encoder');
  v_ext_approver uuid := pg_temp.t_role(v_ext, '[t] Approver');
  v_approver uuid := pg_temp.t_test_role('[t] Approver');
  v_encoder uuid := pg_temp.t_test_role('[t] Encoder');
  v_nobody uuid := pg_temp.t_test_role('[t] Auditor');
  v_admin uuid := pg_temp.t_user('admin', 'Admin', v_vendor);
  v_a1 uuid := pg_temp.t_user('int approver 1', 'Internal', v_int, v_int_approver);
  v_a2 uuid := pg_temp.t_user('int approver 2', 'Internal', v_int, v_int_approver);
  v_b1 uuid := pg_temp.t_user('ext approver', 'External', v_ext, v_ext_approver);
  v_e1 uuid := pg_temp.t_user('int encoder', 'Internal', v_int, v_int_encoder);
  v_suite uuid := pg_temp.t_suite('Roster');
  v_section uuid := pg_temp.t_section(v_suite, 'Main');
  v_approve1 uuid := pg_temp.t_case(v_section, 'Approve claim', '[t] Approver');
  v_approve2 uuid := pg_temp.t_case(v_section, 'Reject claim', '[t] Approver');
  v_encode uuid := pg_temp.t_case(v_section, 'Encode claim', '[t] Encoder');
  v_draft uuid := pg_temp.t_case(v_section, 'Draft case', null);
  v_audit uuid := pg_temp.t_case(v_section, 'Audit claim', '[t] Auditor');
  v_round uuid := pg_temp.t_round(v_suite);
  v_cov jsonb;
  v_change uuid;
begin
  -- Scope: one scope row per case, no tester yet
  perform pg_temp.t_succeeds_as('staff add the cases to the planned round', v_admin,
    format('select public.apply_iteration_sync(%L, null, array[%L, %L, %L]::uuid[])', v_round, v_approve1, v_approve2, v_encode));
  perform pg_temp.t_eq('a planned round has one scope row per case and no tester copies',
    (select count(*)::int from public.test_case_results where iteration_id = v_round and tester_id is null), 3);

  -- Coverage of the planned round
  v_cov := (pg_temp.t_rows_as(v_admin, format('select public.get_iteration_coverage(%L) as c', v_round)))->0->'c';
  perform pg_temp.t_eq('coverage lists each required role with its case count',
    (select jsonb_object_agg(r->>'name', (r->>'caseCount')::int) from jsonb_array_elements(v_cov->'roles') r),
    jsonb_build_object('[t] Approver', 2, '[t] Encoder', 1));
  perform pg_temp.t_eq('under a role: the orgs that have it',
    (select jsonb_array_length(r->'orgs') from jsonb_array_elements(v_cov->'roles') r where r->>'name' = '[t] Approver'), 2);
  perform pg_temp.t_eq('under each org: its users holding the role, ticked by default',
    (select count(*)::int from jsonb_array_elements(v_cov->'roles') r, jsonb_array_elements(r->'orgs') o, jsonb_array_elements(o->'users') u
     where r->>'name' = '[t] Approver' and (u->>'ticked')::boolean), 3);
  perform pg_temp.t_eq('a full scope has no blocking issues', (v_cov->>'canStart')::boolean, true);
  perform pg_temp.t_fails_as('a tester cannot read coverage', v_b1,
    format('select public.get_iteration_coverage(%L)', v_round), '%forbidden%');

  -- Coverage of a candidate scope (the wizard)
  v_cov := (pg_temp.t_rows_as(v_admin, format('select public.get_round_coverage(%L, array[%L, %L, %L]::uuid[]) as c', v_suite, v_approve1, v_draft, v_audit)))->0->'c';
  perform pg_temp.t_eq('a candidate case with no role is reported',
    (select array_agg(c->>'title') from jsonb_array_elements(v_cov->'casesWithoutRole') c), array['Draft case']);
  perform pg_temp.t_eq('a role nobody holds is reported',
    (select array_agg(r->>'name') from jsonb_array_elements(v_cov->'rolesWithoutUsers') r), array['[t] Auditor']);
  perform pg_temp.t_eq('that scope cannot start', (v_cov->>'canStart')::boolean, false);
  v_cov := (pg_temp.t_rows_as(v_admin, format('select public.get_round_coverage(%L, array[%L]::uuid[], array[%L, %L]::uuid[]) as c', v_suite, v_approve1, v_a1, v_a2)))->0->'c';
  perform pg_temp.t_eq('unticked users in a candidate scope count as not ticked',
    (select (r->>'tickedCount')::int from jsonb_array_elements(v_cov->'roles') r), 1);

  -- Start gating
  perform pg_temp.t_succeeds_as('staff untick the only Encoder', v_admin,
    format('select public.set_iteration_testers_excluded(%L, array[%L]::uuid[], true)', v_round, v_e1));
  v_cov := (pg_temp.t_rows_as(v_admin, format('select public.get_iteration_coverage(%L) as c', v_round)))->0->'c';
  perform pg_temp.t_eq('a role with no ticked tester is blocking',
    (select array_agg(r->>'name') from jsonb_array_elements(v_cov->'rolesWithoutTesters') r), array['[t] Encoder']);
  perform pg_temp.t_fails_as('Start is rejected while a role has no ticked tester', v_admin,
    format('select public.begin_iteration(%L)', v_round), '%No tester for: [t] Encoder%');

  perform pg_temp.t_succeeds_as('staff tick the Encoder again', v_admin,
    format('select public.set_iteration_testers_excluded(%L, array[%L]::uuid[], false)', v_round, v_e1));
  perform pg_temp.t_succeeds_as('staff untick one Approver', v_admin,
    format('select public.set_iteration_testers_excluded(%L, array[%L]::uuid[], true)', v_round, v_a2));

  update public.test_case_results set test_role_id = null where iteration_id = v_round and test_case_id = v_encode;
  perform pg_temp.t_fails_as('Start is rejected while a case in scope has no role', v_admin,
    format('select public.begin_iteration(%L)', v_round), '%needs a test role%Encode claim%');
  update public.test_case_results set test_role_id = v_encoder where iteration_id = v_round and test_case_id = v_encode;

  -- Start: roster fixed, one copy per (tester, case of their role)
  perform pg_temp.t_succeeds_as('Start succeeds once every role and case is covered', v_admin,
    format('select public.begin_iteration(%L)', v_round));
  perform pg_temp.t_eq('the roster holds exactly the ticked testers with their role and org',
    (select array_agg(user_id::text || '/' || test_role_id::text || '/' || organization_id::text || '/' || status order by user_id) from public.iteration_testers where iteration_id = v_round),
    (select array_agg(x order by x) from unnest(array[
      v_a1::text || '/' || v_approver::text || '/' || v_int::text || '/active',
      v_b1::text || '/' || v_approver::text || '/' || v_ext::text || '/active',
      v_e1::text || '/' || v_encoder::text || '/' || v_int::text || '/active']) x));
  perform pg_temp.t_eq('every tester gets one copy per in-scope case of their role (2 + 2 + 1)',
    (select count(*)::int from public.test_case_results where iteration_id = v_round and tester_id is not null), 5);
  perform pg_temp.t_eq('never two copies for the same tester and case',
    (select count(distinct (tester_id, test_case_id))::int from public.test_case_results where iteration_id = v_round and tester_id is not null), 5);
  perform pg_temp.t_eq('copies only cover the tester''s own role',
    (select count(*)::int from public.test_case_results cr join public.iteration_testers t on t.iteration_id = cr.iteration_id and t.user_id = cr.tester_id
     where cr.iteration_id = v_round and cr.test_role_id is distinct from t.test_role_id), 0);
  perform pg_temp.t_eq('the unticked user gets no copies',
    (select count(*)::int from public.test_case_results where iteration_id = v_round and tester_id = v_a2), 0);
  perform pg_temp.t_eq('each copy belongs to its tester''s org',
    (select count(*)::int from public.test_case_results where iteration_id = v_round and tester_id = v_b1 and organization_id = v_ext), 2);
  perform pg_temp.t_eq('each copy has its own step copies',
    (select count(*)::int from public.test_step_results sr join public.test_case_results cr on cr.id = sr.test_case_result_id
     where cr.iteration_id = v_round and cr.tester_id is not null), 5);
  perform pg_temp.t_eq('the scope rows are replaced by the copies',
    (select count(*)::int from public.test_case_results where iteration_id = v_round and tester_id is null), 0);
  perform pg_temp.t_fails_as('the roster is fixed once the round runs', v_admin,
    format('select public.set_iteration_testers_excluded(%L, array[%L]::uuid[], false)', v_round, v_a2), '%already started%');
  perform pg_temp.t_eq('a participating external org now sees the round',
    pg_temp.t_count_as(v_b1, format('select 1 from public.test_iterations where id = %L', v_round)), 1);

  -- Case-content sync reaches every copy
  update public.test_steps set step = 'Approve the claim (v2)' where test_case_id = v_approve1;
  perform pg_temp.t_eq('a changed case is one sync change, not one per copy',
    pg_temp.t_count_as(v_admin, format('select 1 from public.get_iteration_changes(%L) c where c.test_case_id = %L and c.change = ''changed''', v_round, v_approve1)), 1);
  v_change := (pg_temp.t_rows_as(v_admin, format('select test_case_result_id as id from public.get_iteration_changes(%L) c where c.test_case_id = %L', v_round, v_approve1)))->0->>'id';
  perform pg_temp.t_succeeds_as('staff sync the change', v_admin,
    format('select public.apply_iteration_sync(%L, null, ''{}'', array[%L]::uuid[])', v_round, v_change));
  perform pg_temp.t_eq('every tester''s copy is refreshed',
    (select count(*)::int from public.test_case_results where iteration_id = v_round and test_case_id = v_approve1
       and source_hash = public.test_case_content_hash(v_approve1) and sync_kind = 'updated'), 2);
  perform pg_temp.t_eq('and carries the new step',
    (select count(*)::int from public.test_step_results sr join public.test_case_results cr on cr.id = sr.test_case_result_id
     where cr.iteration_id = v_round and cr.test_case_id = v_approve1 and sr.step = 'Approve the claim (v2)'), 2);

  -- Submission is per org, stored on its testers
  perform pg_temp.t_succeeds_as('a tester submits for their org', v_b1, format('select public.submit_participation(%L)', v_round));
  perform pg_temp.t_eq('every tester of that org is marked submitted',
    (select count(*)::int from public.iteration_testers where iteration_id = v_round and organization_id = v_ext and submitted_at is not null), 1);
  perform pg_temp.t_eq('other orgs are not',
    (select count(*)::int from public.iteration_testers where iteration_id = v_round and organization_id = v_int and submitted_at is not null), 0);

  -- Reset collapses the copies back into scope rows and releases the roster
  perform pg_temp.t_succeeds_as('staff reset the round', v_admin, format('select public.reset_iteration(%L)', v_round));
  perform pg_temp.t_eq('reset leaves one scope row per case',
    (select count(*)::int from public.test_case_results where iteration_id = v_round and tester_id is null), 3);
  perform pg_temp.t_eq('reset leaves no copies and no roster',
    (select count(*)::int from public.test_case_results where iteration_id = v_round and tester_id is not null)
      + (select count(*)::int from public.iteration_testers where iteration_id = v_round), 0);
  perform pg_temp.t_succeeds_as('the reset round starts again', v_admin, format('select public.begin_iteration(%L)', v_round));
  perform pg_temp.t_eq('with the same copies (the unticked user stays unticked)',
    (select count(*)::int from public.test_case_results where iteration_id = v_round and tester_id is not null), 5);
end $$;
