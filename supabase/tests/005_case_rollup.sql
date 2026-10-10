-- Strict roll-up of per-tester copies (#10): any Failed copy fails the case, it passes only once
-- every copy has passed, a partly tested case is In Progress. get_iteration_case_verdicts rolls up
-- per case (everything the caller can see) and per case + organization.

-- The verdict rows as a user sees them (RLS applies).
create function pg_temp.t_verdicts_as(p_user uuid, p_round uuid)
returns table(case_key text, test_case_id uuid, organization_id uuid, verdict text, copies integer,
              passed integer, failed integer, blocked integer, in_progress integer, untested integer)
language sql as $$
  select * from jsonb_to_recordset(
    pg_temp.t_rows_as(p_user, format('select * from public.get_iteration_case_verdicts(%L)', p_round))
  ) as x(case_key text, test_case_id uuid, organization_id uuid, verdict text, copies integer,
         passed integer, failed integer, blocked integer, in_progress integer, untested integer);
$$;

do $$
declare
  v_vendor uuid := pg_temp.t_org('Vendor', 'vendor');
  v_int uuid := pg_temp.t_org('Licensing', 'client');
  v_ext uuid := pg_temp.t_org('Company B', 'external');
  v_int_approver uuid := pg_temp.t_role(v_int, '[t] Approver');
  v_ext_approver uuid := pg_temp.t_role(v_ext, '[t] Approver');
  v_admin uuid := pg_temp.t_user('admin', 'Admin', v_vendor);
  v_a1 uuid := pg_temp.t_user('int approver 1', 'Internal', v_int, v_int_approver);
  v_a2 uuid := pg_temp.t_user('int approver 2', 'Internal', v_int, v_int_approver);
  v_a3 uuid := pg_temp.t_user('int approver 3', 'Internal', v_int, v_int_approver);
  v_b1 uuid := pg_temp.t_user('ext approver', 'External', v_ext, v_ext_approver);
  v_suite uuid := pg_temp.t_suite('Rollup');
  v_section uuid := pg_temp.t_section(v_suite, 'Main');
  v_c1 uuid := pg_temp.t_case(v_section, 'Case one', '[t] Approver');
  v_c2 uuid := pg_temp.t_case(v_section, 'Case two', '[t] Approver');
  v_c3 uuid := pg_temp.t_case(v_section, 'Case three', '[t] Approver');
  v_c4 uuid := pg_temp.t_case(v_section, 'Case four', '[t] Approver');
  v_round uuid := pg_temp.t_round(v_suite);
  v_planned uuid;
begin
  -- The rule itself, every combination of failed / passed / untested copies
  perform pg_temp.t_eq('no copies, no verdict', public.rollup_case_status('{}'), null);
  perform pg_temp.t_eq('one failed copy fails the case', public.rollup_case_status(array['Failed', 'Passed', 'Passed']::public.test_case_status[]), 'Failed');
  perform pg_temp.t_eq('a failure outweighs untested copies', public.rollup_case_status(array['Failed', 'Untested', 'Passed']::public.test_case_status[]), 'Failed');
  perform pg_temp.t_eq('all failed', public.rollup_case_status(array['Failed', 'Failed']::public.test_case_status[]), 'Failed');
  perform pg_temp.t_eq('passed only when every copy passed', public.rollup_case_status(array['Passed', 'Passed', 'Passed']::public.test_case_status[]), 'Passed');
  perform pg_temp.t_eq('a single passed copy is passed', public.rollup_case_status(array['Passed']::public.test_case_status[]), 'Passed');
  perform pg_temp.t_eq('passed + untested is in progress', public.rollup_case_status(array['Passed', 'Untested']::public.test_case_status[]), 'In Progress');
  perform pg_temp.t_eq('a copy mid-way makes the case in progress', public.rollup_case_status(array['Passed', 'In Progress']::public.test_case_status[]), 'In Progress');
  perform pg_temp.t_eq('nobody started: untested', public.rollup_case_status(array['Untested', 'Untested']::public.test_case_status[]), 'Untested');
  perform pg_temp.t_eq('a blocked copy blocks the case', public.rollup_case_status(array['Passed', 'Blocked', 'Untested']::public.test_case_status[]), 'Blocked');
  perform pg_temp.t_eq('failed outweighs blocked', public.rollup_case_status(array['Blocked', 'Failed']::public.test_case_status[]), 'Failed');

  -- A running round: 3 internal approvers + 1 external approver each have a copy of 4 cases
  perform pg_temp.t_succeeds_as('staff plan the round', v_admin,
    format('select public.apply_iteration_sync(%L, null, array[%L, %L, %L, %L]::uuid[])', v_round, v_c1, v_c2, v_c3, v_c4));
  perform pg_temp.t_succeeds_as('staff start the round', v_admin, format('select public.begin_iteration(%L)', v_round));
  perform pg_temp.t_eq('every tester has a copy of every case',
    (select count(*)::int from public.test_case_results where iteration_id = v_round and tester_id is not null), 16);

  -- case 1: one internal tester Failed, the rest untested. case 2: every copy passed.
  -- case 3: three of four copies passed, one untested. case 4: nothing touched.
  update public.test_case_results set status = 'Failed' where iteration_id = v_round and test_case_id = v_c1 and tester_id = v_a1;
  update public.test_case_results set status = 'Passed' where iteration_id = v_round and test_case_id = v_c2;
  update public.test_case_results set status = 'Passed' where iteration_id = v_round and test_case_id = v_c3 and tester_id in (v_a1, v_a2, v_b1);

  perform pg_temp.t_eq('staff: one failed copy fails the case',
    (select verdict from pg_temp.t_verdicts_as(v_admin, v_round) where test_case_id = v_c1 and organization_id is null), 'Failed');
  perform pg_temp.t_eq('staff: every copy passed passes the case',
    (select verdict from pg_temp.t_verdicts_as(v_admin, v_round) where test_case_id = v_c2 and organization_id is null), 'Passed');
  perform pg_temp.t_eq('staff: an untested copy leaves the case in progress',
    (select verdict from pg_temp.t_verdicts_as(v_admin, v_round) where test_case_id = v_c3 and organization_id is null), 'In Progress');
  perform pg_temp.t_eq('staff: nothing started is untested',
    (select verdict from pg_temp.t_verdicts_as(v_admin, v_round) where test_case_id = v_c4 and organization_id is null), 'Untested');
  perform pg_temp.t_eq('the case row counts each copy',
    (select copies from pg_temp.t_verdicts_as(v_admin, v_round) where test_case_id = v_c3 and organization_id is null), 4);
  perform pg_temp.t_eq('the breakdown counts passed and untested copies',
    (select array[passed, untested] from pg_temp.t_verdicts_as(v_admin, v_round) where test_case_id = v_c3 and organization_id is null), array[3, 1]);
  perform pg_temp.t_eq('staff get one row per case plus one per case and organization',
    (select count(*)::int from pg_temp.t_verdicts_as(v_admin, v_round)), 4 + 8);
  perform pg_temp.t_eq('per organization: the external org passed case three (its one tester did)',
    (select verdict from pg_temp.t_verdicts_as(v_admin, v_round) where test_case_id = v_c3 and organization_id = v_ext), 'Passed');
  perform pg_temp.t_eq('per organization: the internal org is still in progress on it',
    (select verdict from pg_temp.t_verdicts_as(v_admin, v_round) where test_case_id = v_c3 and organization_id = v_int), 'In Progress');

  -- Scoped to what the caller can see (RLS): an organization rolls up its own testers only
  perform pg_temp.t_eq('an external tester sees only their own organization''s copies',
    (select copies from pg_temp.t_verdicts_as(v_b1, v_round) where test_case_id = v_c1 and organization_id is null), 1);
  perform pg_temp.t_eq('so a failure inside another org does not reach them',
    (select verdict from pg_temp.t_verdicts_as(v_b1, v_round) where test_case_id = v_c1 and organization_id is null), 'Untested');
  perform pg_temp.t_eq('an internal tester sees their org''s roll-up, failure included',
    (select verdict from pg_temp.t_verdicts_as(v_a2, v_round) where test_case_id = v_c1 and organization_id is null), 'Failed');

  -- A planned round has no copies, so no verdicts
  v_planned := pg_temp.t_round(pg_temp.t_suite('Other'), 'Planned');
  perform pg_temp.t_eq('a planned round has no verdicts',
    (select count(*)::int from pg_temp.t_verdicts_as(v_admin, v_planned)), 0);

  -- Suite case states: one per_org entry per organization, not one per tester copy
  perform pg_temp.t_eq('case states list each organization once, rolled up',
    (select jsonb_agg(o->>'result' order by o->>'organizationName')
     from jsonb_array_elements((pg_temp.t_rows_as(v_admin,
       format('select per_org from public.get_suite_case_states(%L) where test_case_id = %L', v_suite, v_c3)))->0->'per_org') o),
    '["Passed", "In Progress"]'::jsonb);
  perform pg_temp.t_eq('case states roll the case up too',
    (pg_temp.t_rows_as(v_admin, format('select result from public.get_suite_case_states(%L) where test_case_id = %L', v_suite, v_c1)))->0->>'result',
    'Failed');
end;
$$;
