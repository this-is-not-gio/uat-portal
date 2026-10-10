-- Helpers for the SQL scenario scripts in this folder. The runner
-- (scripts/run-sql-scenarios.mjs) prepends this file to every scenario and wraps the
-- whole thing in a transaction that is always rolled back, so nothing a scenario
-- seeds survives. Everything lives in pg_temp and is called as pg_temp.t_*(...).
--
-- Seeding runs as the connection's own role (postgres), which bypasses RLS.
-- Acting as a user goes through t_*_as(user, sql): it sets the JWT claims, switches
-- to the `authenticated` role for that one statement, and switches back.

create temp table t_results (
  n serial primary key,
  label text not null,
  ok boolean not null,
  detail text
) on commit drop;

-- ---------------------------------------------------------------------------
-- Assertions
-- ---------------------------------------------------------------------------

create function pg_temp.t_ok(p_label text, p_ok boolean, p_detail text default null)
returns void language sql as $$
  insert into pg_temp.t_results (label, ok, detail) values (p_label, coalesce(p_ok, false), p_detail);
$$;

create function pg_temp.t_eq(p_label text, p_actual anyelement, p_expected anyelement)
returns void language sql as $$
  select pg_temp.t_ok(
    p_label,
    p_actual is not distinct from p_expected,
    format('expected %s, got %s', coalesce(p_expected::text, 'null'), coalesce(p_actual::text, 'null'))
  );
$$;

-- ---------------------------------------------------------------------------
-- Acting as a user (RLS applies)
-- ---------------------------------------------------------------------------

-- Runs p_sql as p_user and returns the error message, or null when it succeeded.
create function pg_temp.t_exec_as(p_user uuid, p_sql text)
returns text language plpgsql as $$
declare
  v_back text := session_user;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute p_sql;
    execute 'set local role ' || quote_ident(v_back);
    return null;
  exception when others then
    -- The failed sub-transaction undoes the role switch too.
    return sqlerrm;
  end;
end;
$$;

-- Number of rows p_sql returns when run as p_user.
create function pg_temp.t_count_as(p_user uuid, p_sql text)
returns integer language plpgsql as $$
declare
  v_back text := session_user;
  v integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute 'select count(*) from (' || p_sql || ') q' into v;
  execute 'set local role ' || quote_ident(v_back);
  return v;
end;
$$;

-- p_sql's rows as a jsonb array when run as p_user.
create function pg_temp.t_rows_as(p_user uuid, p_sql text)
returns jsonb language plpgsql as $$
declare
  v_back text := session_user;
  v jsonb;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute 'select coalesce(jsonb_agg(to_jsonb(q)), ''[]'') from (' || p_sql || ') q' into v;
  execute 'set local role ' || quote_ident(v_back);
  return v;
end;
$$;

create function pg_temp.t_succeeds_as(p_label text, p_user uuid, p_sql text)
returns void language plpgsql as $$
declare v_err text := pg_temp.t_exec_as(p_user, p_sql);
begin
  perform pg_temp.t_ok(p_label, v_err is null, v_err);
end;
$$;

-- Passes when p_sql fails for p_user (and, if given, the message matches p_like).
create function pg_temp.t_fails_as(p_label text, p_user uuid, p_sql text, p_like text default null)
returns void language plpgsql as $$
declare v_err text := pg_temp.t_exec_as(p_user, p_sql);
begin
  perform pg_temp.t_ok(
    p_label,
    v_err is not null and (p_like is null or v_err ilike p_like),
    coalesce(v_err, 'succeeded but should have failed')
  );
end;
$$;

-- An UPDATE blocked by RLS doesn't error, it touches 0 rows. Passes when p_sql
-- (an update/delete ... returning 1) affects no rows or fails.
create function pg_temp.t_touches_nothing_as(p_label text, p_user uuid, p_sql text)
returns void language plpgsql as $$
declare
  v_back text := session_user;
  v integer;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute 'with w as (' || p_sql || ') select count(*) from w' into v;
    execute 'set local role ' || quote_ident(v_back);
  exception when others then
    perform pg_temp.t_ok(p_label, true, sqlerrm);
    return;
  end;
  perform pg_temp.t_ok(p_label, v = 0, format('%s row(s) affected', v));
end;
$$;

-- ---------------------------------------------------------------------------
-- Seeding (as postgres, RLS bypassed)
-- ---------------------------------------------------------------------------

create function pg_temp.t_org(p_name text, p_type public.org_type default 'client')
returns uuid language sql as $$
  insert into public.organizations (name, type) values ('[t] ' || p_name, p_type) returning id;
$$;

-- An org's test role.
create function pg_temp.t_role(p_org uuid, p_name text)
returns uuid language sql as $$
  insert into public.organization_roles (organization_id, name) values (p_org, p_name) returning id;
$$;

-- A user (auth.users row → profile via handle_new_user), optionally holding a test role.
-- The id is derived from the label, so scenarios can refer to it again cheaply.
create function pg_temp.t_user(p_label text, p_role public.user_role, p_org uuid default null, p_org_role uuid default null)
returns uuid language plpgsql as $$
declare v_id uuid := md5('t-user:' || p_label)::uuid;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
  values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'test+' || md5(p_label) || '@scenario.local',
    jsonb_build_object('role', p_role, 'organization_id', p_org),
    jsonb_build_object('full_name', '[t] ' || p_label)
  );
  if p_org_role is not null then
    update public.profiles set org_role_id = p_org_role where id = v_id;
  end if;
  return v_id;
end;
$$;

create function pg_temp.t_suite(p_name text, p_status public.suite_status default 'ready')
returns uuid language sql as $$
  insert into public.testing_suites (name, slug, code, status)
  values ('[t] ' || p_name, 't-' || md5(p_name || clock_timestamp()::text), 'T' || substr(md5(p_name), 1, 4), p_status)
  returning id;
$$;

create function pg_temp.t_section(p_suite uuid, p_name text)
returns uuid language sql as $$
  insert into public.sections (test_suite_id, name, slug, order_index)
  values (p_suite, p_name, 't-' || md5(p_name || clock_timestamp()::text),
          (select count(*) from public.sections where test_suite_id = p_suite))
  returning id;
$$;

-- A complete test case (one step with one expected result) for the given role name.
create function pg_temp.t_case(p_section uuid, p_title text, p_role text)
returns uuid language plpgsql as $$
declare
  v_case uuid;
  v_step uuid;
begin
  insert into public.test_cases (section_id, title, role_assignee, order_index)
  values (p_section, p_title, p_role, (select count(*) from public.test_cases where section_id = p_section))
  returning id into v_case;
  insert into public.test_steps (test_case_id, step) values (v_case, 'Do ' || p_title) returning id into v_step;
  insert into public.expected_results (test_step_id, result) values (v_step, p_title || ' works');
  return v_case;
end;
$$;
