-- Baseline: a non-staff user only reads the test cases whose role exists in their org.
-- Staff (Admin, Internal) read every case.

do $$
declare
  v_vendor uuid := pg_temp.t_org('Vendor', 'vendor');
  v_ext uuid := pg_temp.t_org('Company A', 'external');
  v_ext2 uuid := pg_temp.t_org('Company B', 'external');
  v_approver uuid := pg_temp.t_role(v_ext, 'Approver');
  v_admin uuid := pg_temp.t_user('admin', 'Admin', v_vendor);
  v_ext_user uuid := pg_temp.t_user('ext approver', 'External', v_ext, v_approver);
  v_ext2_user uuid := pg_temp.t_user('ext b', 'External', v_ext2);
  v_suite uuid := pg_temp.t_suite('Visibility');
  v_section uuid := pg_temp.t_section(v_suite, 'Main');
  v_sql text;
begin
  perform pg_temp.t_case(v_section, 'Approve claim', 'Approver');
  perform pg_temp.t_case(v_section, 'Approve claim again', 'approver');  -- names match loosely
  perform pg_temp.t_case(v_section, 'Encode claim', 'Encoder');
  perform pg_temp.t_case(v_section, 'Draft case', null);

  v_sql := format('select 1 from public.test_cases tc join public.sections s on s.id = tc.section_id where s.test_suite_id = %L', v_suite);

  perform pg_temp.t_eq('admin reads every case', pg_temp.t_count_as(v_admin, v_sql), 4);
  perform pg_temp.t_eq('external user reads only their org role''s cases', pg_temp.t_count_as(v_ext_user, v_sql), 2);
  perform pg_temp.t_eq('org without a matching role reads no cases', pg_temp.t_count_as(v_ext2_user, v_sql), 0);
  perform pg_temp.t_fails_as('external user cannot insert a case', v_ext_user,
    format('insert into public.test_cases (section_id, title) values (%L, %L)', v_section, 'Sneaky'),
    '%row-level security%');
end $$;
