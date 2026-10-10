-- Cases and test accounts reference the role catalog (#6): org visibility and round sync
-- match by catalog role ID, so a rename changes nothing; authors save roles by ID, and a
-- draft case may have none.

do $$
declare
  v_vendor uuid := pg_temp.t_org('Vendor', 'vendor');
  v_ext uuid := pg_temp.t_org('Company A', 'external');
  v_approver uuid := pg_temp.t_test_role('[t] Approver');
  v_encoder uuid := pg_temp.t_test_role('[t] Encoder');
  v_ext_approver uuid := pg_temp.t_org_role(v_ext, v_approver);
  v_admin uuid := pg_temp.t_user('admin', 'Admin', v_vendor);
  v_tester uuid := pg_temp.t_user('ext approver', 'External', v_ext, v_ext_approver);
  v_suite uuid := pg_temp.t_suite('Catalog roles', 'draft');
  v_section uuid := pg_temp.t_section(v_suite, 'Main');
  v_approve uuid := pg_temp.t_case(v_section, 'Approve claim', '[t] Approver');
  v_encode uuid := pg_temp.t_case(v_section, 'Encode claim', '[t] Encoder');
  v_draft uuid := pg_temp.t_case(v_section, 'Draft case', null);
  v_sql text := format('select 1 from public.test_cases tc join public.sections s on s.id = tc.section_id where s.test_suite_id = %L', v_suite);
  v_round uuid;
  v_new uuid;
begin
  -- Visibility by catalog ID
  perform pg_temp.t_eq('admin reads every case', pg_temp.t_count_as(v_admin, v_sql), 3);
  perform pg_temp.t_eq('tester reads only the cases of a catalog role their org has',
    pg_temp.t_count_as(v_tester, v_sql || format(' and tc.id = %L', v_approve)), 1);
  perform pg_temp.t_eq('tester reads nothing else (other role, roleless draft)', pg_temp.t_count_as(v_tester, v_sql), 1);

  update public.test_roles set name = '[t] Approver (renamed)' where id = v_approver;
  perform pg_temp.t_eq('renaming the catalog role keeps the tester''s cases visible', pg_temp.t_count_as(v_tester, v_sql), 1);

  -- Authoring by ID
  perform pg_temp.t_succeeds_as('author saves a case with a catalog role ID', v_admin,
    format('select public.save_test_case(%L::jsonb)', jsonb_build_object(
      'id', v_encode, 'section_id', v_section, 'title', 'Encode claim', 'test_role_id', v_approver,
      'steps', jsonb_build_array(jsonb_build_object('step', 'Do it', 'expected_results', jsonb_build_array(jsonb_build_object('result', 'Done'))))
    )));
  perform pg_temp.t_eq('the case now references that catalog role',
    (select test_role_id from public.test_cases where id = v_encode), v_approver);
  perform pg_temp.t_eq('so the tester now reads it too', pg_temp.t_count_as(v_tester, v_sql), 2);

  perform pg_temp.t_succeeds_as('author saves a draft case with no role', v_admin,
    format('select public.save_test_case(%L::jsonb)', jsonb_build_object('section_id', v_section, 'title', 'Another draft')));
  perform pg_temp.t_eq('the roleless draft is flagged incomplete',
    (select count(*)::int from public.test_case_issues(v_draft) i where i = 'no_role_assignee'), 1);
  perform pg_temp.t_fails_as('a role ID outside the catalog is rejected', v_admin,
    format('select public.save_test_case(%L::jsonb)', jsonb_build_object('section_id', v_section, 'title', 'Bad', 'test_role_id', gen_random_uuid())),
    '%no longer in the role catalog%');

  -- Test accounts by ID
  perform pg_temp.t_succeeds_as('author saves test accounts with a catalog role and "any role"', v_admin,
    format('select public.save_suite_test_accounts(%L, %L::jsonb)', v_suite, jsonb_build_array(
      jsonb_build_object('test_role_id', v_approver, 'username', 'approver@x', 'password', 'p'),
      jsonb_build_object('test_role_id', null, 'username', 'any@x', 'password', 'p')
    )));
  perform pg_temp.t_eq('the accounts reference the catalog role (or none)',
    (select array_agg(test_role_id order by sort_order)::text from public.suite_test_accounts where testing_suite_id = v_suite),
    array[v_approver, null]::uuid[]::text);
  perform pg_temp.t_fails_as('a test account role outside the catalog is rejected', v_admin,
    format('select public.save_suite_test_accounts(%L, %L::jsonb)', v_suite, jsonb_build_array(
      jsonb_build_object('test_role_id', gen_random_uuid(), 'username', 'u', 'password', 'p'))),
    '%no longer in the role catalog%');

  -- Round sync by ID
  v_round := pg_temp.t_round(v_suite);
  perform pg_temp.t_succeeds_as('staff add the org to a round with its Approver instance', v_admin,
    format('select public.add_iteration_participant(%L, %L, array[%L]::uuid[])', v_round, v_ext, v_ext_approver));
  perform pg_temp.t_eq('the round snapshots exactly the complete cases of that catalog role',
    (select count(*)::int from public.test_case_results where iteration_id = v_round and organization_id = v_ext), 2);
  perform pg_temp.t_eq('the snapshots carry the catalog role ID',
    (select count(*)::int from public.test_case_results where iteration_id = v_round and test_role_id = v_approver), 2);

  -- Everything in this transaction shares one now(), so date the late case after the round.
  v_new := pg_temp.t_case(v_section, 'Late approver case', '[t] Approver (renamed)');
  update public.test_cases set created_at = now() + interval '1 minute' where id = v_new;
  perform pg_temp.t_eq('a new case of that role shows up as a sync change for the org',
    pg_temp.t_count_as(v_admin, format('select 1 from public.get_iteration_changes(%L) c where c.test_case_id = %L and c.change = ''added'' and c.organization_id = %L', v_round, v_new, v_ext)), 1);

  update public.test_cases set test_role_id = v_encoder where id = v_approve;
  perform pg_temp.t_eq('moving a case to a role the org does not test shows it as removed',
    pg_temp.t_count_as(v_admin, format('select 1 from public.get_iteration_changes(%L) c where c.test_case_id = %L and c.change = ''removed''', v_round, v_approve)), 1);
end $$;
