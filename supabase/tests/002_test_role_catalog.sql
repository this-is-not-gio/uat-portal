-- Test role catalog (#4): one global catalog with normalized-name uniqueness, org instances
-- (at most one per org and catalog role), admin-only writes, and renames that follow through.

do $$
declare
  v_vendor uuid := pg_temp.t_org('Vendor', 'vendor');
  v_client uuid := pg_temp.t_org('Client', 'client');
  v_ext uuid := pg_temp.t_org('Company A', 'external');
  v_admin uuid := pg_temp.t_user('admin', 'Admin', v_vendor);
  v_internal uuid := pg_temp.t_user('internal', 'Internal', v_client);
  v_approver uuid;
  v_ext_role uuid;
  v_holder uuid;
  v_name text;
begin
  -- Catalog writes
  perform pg_temp.t_succeeds_as('admin creates a catalog role with orgs ticked', v_admin,
    format('select public.create_test_role(%L, array[%L, %L]::uuid[])', '[t] Approver', v_client, v_ext));
  select id into v_approver from public.test_roles where name = '[t] Approver';

  perform pg_temp.t_fails_as('a second spelling of the same name is rejected', v_admin,
    format('select public.create_test_role(%L)', '[T]  APPROVER'), '%already in the role catalog%');
  perform pg_temp.t_fails_as('a dash/space variant is rejected too', v_admin,
    format('insert into public.test_roles (name) values (%L)', 't-approver'));
  perform pg_temp.t_fails_as('non-admin cannot create catalog roles', v_internal,
    format('select public.create_test_role(%L)', '[t] Encoder'), '%forbidden%');
  perform pg_temp.t_fails_as('non-admin cannot insert into the catalog directly', v_internal,
    format('insert into public.test_roles (name) values (%L)', '[t] Encoder'), '%row-level security%');
  perform pg_temp.t_eq('every signed-in user reads the catalog',
    pg_temp.t_count_as(v_internal, format('select 1 from public.test_roles where id = %L', v_approver)), 1);

  -- Org instances
  perform pg_temp.t_eq('create_test_role made one instance per ticked org',
    (select count(*)::int from public.organization_roles where test_role_id = v_approver), 2);
  perform pg_temp.t_fails_as('an org cannot get the same catalog role twice', v_admin,
    format('insert into public.organization_roles (organization_id, test_role_id) values (%L, %L)', v_client, v_approver),
    '%organization_roles_org_test_role_key%');
  perform pg_temp.t_fails_as('the vendor org cannot be given a test role', v_admin,
    format('select public.set_test_role_orgs(%L, array[%L]::uuid[])', v_approver, v_vendor), '%Internal or External%');

  select id into v_ext_role from public.organization_roles where test_role_id = v_approver and organization_id = v_ext;
  v_holder := pg_temp.t_user('ext holder', 'External', v_ext, v_ext_role);
  perform pg_temp.t_fails_as('a user cannot hold a role instance from another org', v_admin,
    format('update public.profiles set org_role_id = (select id from public.organization_roles where organization_id = %L and test_role_id = %L) where id = %L',
      v_client, v_approver, v_holder));

  perform pg_temp.t_succeeds_as('admin unticks an org', v_admin,
    format('select public.set_test_role_orgs(%L, array[%L]::uuid[])', v_approver, v_client));
  perform pg_temp.t_eq('the unticked org loses its instance',
    (select count(*)::int from public.organization_roles where test_role_id = v_approver and organization_id = v_ext), 0);
  perform pg_temp.t_eq('its holder keeps their org but loses the role',
    (select org_role_id from public.profiles where id = v_holder), null::uuid);
  perform pg_temp.t_eq('the holder is still in the org',
    (select organization_id from public.profiles where id = v_holder), v_ext);

  -- Rename once, everywhere
  perform pg_temp.t_succeeds_as('admin renames the catalog role', v_admin,
    format('update public.test_roles set name = %L where id = %L', '[t] Approver (Licensing)', v_approver));
  select t.name into v_name
  from public.organization_roles r join public.test_roles t on t.id = r.test_role_id
  where r.organization_id = v_client and r.test_role_id = v_approver;
  perform pg_temp.t_eq('the org instance shows the new name', v_name, '[t] Approver (Licensing)');

  -- Migration mapping: every org role points at a catalog role.
  perform pg_temp.t_eq('no org role is left without a catalog role',
    (select count(*)::int from public.organization_roles where test_role_id is null), 0);
end $$;
