-- Roster sync (#12): once a round runs, changes to who holds a role show up as Sync changes and
-- are applied by staff, never automatically.
--   * Tester joined: a user now holds an in-scope role in a participating org. Applying it adds
--     them to the roster and creates their copies of the in-scope cases of their role.
--   * Tester dropped: a rostered tester lost the role or was deactivated (banned). Applying it
--     marks them dropped and freezes their copies (out of the run, flagged, view only).
-- Results are never deleted, and a dropped tester who comes back gets their frozen copies back.

do $$
declare
  v_vendor uuid := pg_temp.t_org('Vendor', 'vendor');
  v_int uuid := pg_temp.t_org('Licensing', 'client');
  v_ext uuid := pg_temp.t_org('Company B', 'external');
  v_other uuid := pg_temp.t_org('Company C', 'client');
  v_int_approver uuid := pg_temp.t_role(v_int, '[t] Approver');
  v_int_encoder uuid := pg_temp.t_role(v_int, '[t] Encoder');
  v_ext_approver uuid := pg_temp.t_role(v_ext, '[t] Approver');
  v_other_approver uuid := pg_temp.t_role(v_other, '[t] Approver');
  v_admin uuid := pg_temp.t_user('admin', 'Admin', v_vendor);
  v_a1 uuid := pg_temp.t_user('int approver 1', 'Internal', v_int, v_int_approver);
  v_a2 uuid := pg_temp.t_user('int approver 2', 'Internal', v_int, v_int_approver);
  v_x1 uuid := pg_temp.t_user('int approver on leave', 'Internal', v_int, v_int_approver);
  v_e1 uuid := pg_temp.t_user('int encoder', 'Internal', v_int, v_int_encoder);
  v_j1 uuid := pg_temp.t_user('int late joiner', 'Internal', v_int);
  v_b1 uuid := pg_temp.t_user('ext approver', 'External', v_ext, v_ext_approver);
  v_c1 uuid := pg_temp.t_user('other org user', 'Internal', v_other);
  v_suite uuid := pg_temp.t_suite('Roster sync');
  v_section uuid := pg_temp.t_section(v_suite, 'Main');
  v_approve uuid := pg_temp.t_case(v_section, 'Approve claim', '[t] Approver');
  v_refund uuid := pg_temp.t_case(v_section, 'Approve refund', '[t] Approver');
  v_encode uuid := pg_temp.t_case(v_section, 'Encode claim', '[t] Encoder');
  v_round uuid := pg_temp.t_round(v_suite);
  v_a2_copy uuid;
  v_a2_step uuid;
  v_b1_step uuid;
  v_roster_sql text;
begin
  perform pg_temp.t_succeeds_as('staff scope the round, untick the tester on leave and start it', v_admin,
    format('select public.apply_iteration_sync(%L, null, array[%L, %L, %L]::uuid[]);
            select public.set_iteration_testers_excluded(%L, array[%L]::uuid[], true);
            select public.begin_iteration(%L)',
      v_round, v_approve, v_refund, v_encode, v_round, v_x1, v_round));

  v_roster_sql := format('select change, user_id, organization_name, test_role_name from public.get_iteration_changes(%L) where change like ''tester_%%''', v_round);

  perform pg_temp.t_eq('a freshly started round has no roster changes',
    pg_temp.t_count_as(v_admin, v_roster_sql), 0);

  -- a2 records a result before losing the role
  select id into v_a2_copy from public.test_case_results where iteration_id = v_round and tester_id = v_a2 and test_case_id = v_approve;
  select id into v_a2_step from public.test_step_results where test_case_result_id = v_a2_copy;
  perform pg_temp.t_succeeds_as('a tester records a result on their copy', v_a2,
    format('update public.test_step_results set status = ''Passed'' where id = %L', v_a2_step));
  select sr.id into v_b1_step from public.test_step_results sr join public.test_case_results cr on cr.id = sr.test_case_result_id
  where cr.iteration_id = v_round and cr.tester_id = v_b1 and cr.test_case_id = v_approve;
  perform pg_temp.t_succeeds_as('another tester records a result on their copy', v_b1,
    format('update public.test_step_results set status = ''Failed'' where id = %L', v_b1_step));

  -- Drift after Start
  update public.profiles set org_role_id = v_int_approver where id = v_j1;          -- gains an in-scope role
  update public.profiles set org_role_id = null where id = v_a2;                    -- loses the role
  update public.profiles set org_role_id = v_int_approver where id = v_e1;          -- switches role
  update auth.users set banned_until = now() + interval '1 day' where id = v_b1;    -- deactivated
  update public.profiles set org_role_id = v_other_approver where id = v_c1;        -- org not in the round

  -- Detection
  perform pg_temp.t_eq('a user who gained an in-scope role is reported as joined',
    pg_temp.t_count_as(v_admin, v_roster_sql || format(' and change = ''tester_joined'' and user_id = %L', v_j1)), 1);
  perform pg_temp.t_eq('a tester who switched to another in-scope role is reported as joined with the new role',
    pg_temp.t_count_as(v_admin, v_roster_sql || format(' and change = ''tester_joined'' and user_id = %L and test_role_name = ''[t] Approver''', v_e1)), 1);
  perform pg_temp.t_eq('only those two joined (not the unticked tester, not a non-participating org)',
    pg_temp.t_count_as(v_admin, v_roster_sql || ' and change = ''tester_joined'''), 2);
  perform pg_temp.t_eq('a tester who lost the role is reported as dropped',
    pg_temp.t_count_as(v_admin, v_roster_sql || format(' and change = ''tester_dropped'' and user_id = %L', v_a2)), 1);
  perform pg_temp.t_eq('a deactivated tester is reported as dropped',
    pg_temp.t_count_as(v_admin, v_roster_sql || format(' and change = ''tester_dropped'' and user_id = %L', v_b1)), 1);
  perform pg_temp.t_eq('a tester who switched role is reported as dropped from the old one',
    pg_temp.t_count_as(v_admin, v_roster_sql || format(' and change = ''tester_dropped'' and user_id = %L and test_role_name = ''[t] Encoder''', v_e1)), 1);
  perform pg_temp.t_eq('only those three dropped',
    pg_temp.t_count_as(v_admin, v_roster_sql || ' and change = ''tester_dropped'''), 3);
  perform pg_temp.t_eq('testers don''t see roster changes',
    pg_temp.t_count_as(v_a1, v_roster_sql), 0);
  perform pg_temp.t_eq('nothing is applied automatically',
    (select count(*)::int from public.iteration_testers where iteration_id = v_round and status = 'active' and user_id in (v_a2, v_b1, v_e1)), 3);

  -- Applying is staff-only and only for changes that are really there
  perform pg_temp.t_fails_as('a tester cannot apply roster changes', v_a1,
    format('select public.apply_iteration_sync(%L, null, p_join => array[%L]::uuid[])', v_round, v_j1), '%forbidden%');
  perform pg_temp.t_fails_as('dropping a tester who still holds their role is rejected', v_admin,
    format('select public.apply_iteration_sync(%L, null, p_drop => array[%L]::uuid[])', v_round, v_a1), '%not dropped%');
  perform pg_temp.t_fails_as('joining a user who has no in-scope role is rejected', v_admin,
    format('select public.apply_iteration_sync(%L, null, p_join => array[%L]::uuid[])', v_round, v_c1), '%not joined%');
  perform pg_temp.t_fails_as('a role switch needs its drop applied with its join', v_admin,
    format('select public.apply_iteration_sync(%L, null, p_join => array[%L]::uuid[])', v_round, v_e1), '%drop%');

  -- Apply
  perform pg_temp.t_succeeds_as('staff apply the joins and drops', v_admin,
    format('select public.apply_iteration_sync(%L, %L, p_join => array[%L, %L]::uuid[], p_drop => array[%L, %L, %L]::uuid[])',
      v_round, v_admin, v_j1, v_e1, v_a2, v_b1, v_e1));

  -- Join
  perform pg_temp.t_eq('the joined user is on the roster with their role',
    (select count(*)::int from public.iteration_testers
     where iteration_id = v_round and user_id = v_j1 and status = 'active' and test_role_id = pg_temp.t_test_role('[t] Approver') and organization_id = v_int), 1);
  perform pg_temp.t_eq('the joined user gets a copy of each in-scope case of their role',
    (select count(*)::int from public.test_case_results
     where iteration_id = v_round and tester_id = v_j1 and included_in_run and test_case_id in (v_approve, v_refund)), 2);
  perform pg_temp.t_eq('the joined user gets no copies of other roles'' cases',
    (select count(*)::int from public.test_case_results where iteration_id = v_round and tester_id = v_j1), 2);
  perform pg_temp.t_eq('the new copies start untested, steps included',
    (select count(*)::int from public.test_step_results sr join public.test_case_results cr on cr.id = sr.test_case_result_id
     where cr.iteration_id = v_round and cr.tester_id = v_j1 and sr.status = 'Untested' and cr.status = 'Untested'), 2);
  perform pg_temp.t_eq('the switched tester is active again with the new role and its copies',
    (select count(*)::int from public.test_case_results cr join public.iteration_testers t on t.iteration_id = cr.iteration_id and t.user_id = cr.tester_id
     where cr.iteration_id = v_round and cr.tester_id = v_e1 and cr.included_in_run and t.status = 'active'
       and t.test_role_id = pg_temp.t_test_role('[t] Approver') and cr.test_case_id in (v_approve, v_refund)), 2);
  perform pg_temp.t_eq('the switched tester''s old-role copy is frozen',
    (select count(*)::int from public.test_case_results
     where iteration_id = v_round and tester_id = v_e1 and test_case_id = v_encode and not included_in_run and sync_kind = 'tester_dropped'), 1);

  -- Drop
  perform pg_temp.t_eq('dropped testers are marked dropped, not removed',
    (select count(*)::int from public.iteration_testers where iteration_id = v_round and user_id in (v_a2, v_b1) and status = 'dropped'), 2);
  perform pg_temp.t_eq('their copies are frozen and flagged',
    (select count(*)::int from public.test_case_results
     where iteration_id = v_round and tester_id in (v_a2, v_b1) and not included_in_run and sync_kind = 'tester_dropped'), 4);
  perform pg_temp.t_eq('the completed result on a frozen copy remains',
    (select status::text from public.test_step_results where id = v_a2_step), 'Passed');
  perform pg_temp.t_fails_as('a frozen copy rejects step result writes', v_a2,
    format('update public.test_step_results set status = ''Failed'' where id = %L', v_a2_step), '%view only%');
  perform pg_temp.t_fails_as('a frozen copy rejects case result writes', v_a2,
    format('update public.test_case_results set status = ''Failed'', status_overridden = true where id = %L', v_a2_copy), '%view only%');
  perform pg_temp.t_fails_as('a dropped tester cannot put their frozen copy back into the run', v_a2,
    format('update public.test_case_results set included_in_run = true where id = %L', v_a2_copy), '%view only%');
  perform pg_temp.t_eq('the frozen copy no longer counts towards the case verdict',
    (select copies from public.get_iteration_case_verdicts(v_round) where test_case_id = v_approve and organization_id is null), 3);
  perform pg_temp.t_eq('applied roster changes are no longer reported',
    pg_temp.t_count_as(v_admin, v_roster_sql), 0);

  -- Coming back
  update public.profiles set org_role_id = v_int_approver where id = v_a2;
  perform pg_temp.t_eq('a dropped tester who regains the role is reported as joined',
    pg_temp.t_count_as(v_admin, v_roster_sql || format(' and change = ''tester_joined'' and user_id = %L', v_a2)), 1);
  perform pg_temp.t_succeeds_as('staff apply the rejoin', v_admin,
    format('select public.apply_iteration_sync(%L, %L, p_join => array[%L]::uuid[])', v_round, v_admin, v_a2));
  perform pg_temp.t_eq('the rejoined tester gets their frozen copies back, no duplicates',
    (select count(*)::int from public.test_case_results
     where iteration_id = v_round and tester_id = v_a2 and included_in_run and sync_kind is null), 2);
  perform pg_temp.t_eq('their earlier result is still there',
    (select status::text from public.test_step_results where id = v_a2_step), 'Passed');

  -- Frozen copies don't drive case changes: deleting a case nobody active tests reports nothing to sync
  delete from public.expected_results where test_step_id in (select id from public.test_steps where test_case_id = v_encode);
  delete from public.test_steps where test_case_id = v_encode;
  delete from public.test_cases where id = v_encode;
  perform pg_temp.t_eq('a deleted case whose copies are all frozen is not reported as removed',
    pg_temp.t_count_as(v_admin, format('select 1 from public.get_iteration_changes(%L) where change = ''removed''', v_round)), 0);

  -- A round with frozen, tested copies can still be reset
  perform pg_temp.t_succeeds_as('staff reset a round that has frozen copies with results', v_admin,
    format('select public.reset_iteration(%L)', v_round));
end $$;
