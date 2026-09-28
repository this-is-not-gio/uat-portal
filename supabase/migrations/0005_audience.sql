-- RBAC Phase 3.1: who a test case is meant for.
-- internal = the client's staff, external = the client's clients, both = everyone.
-- Not part of test_case_content_hash: changing a case's audience doesn't change what gets
-- tested, so it shouldn't mark results Outdated. Sync instead offers the case as added/removed
-- for the orgs it now does/doesn't apply to (see 0006).

create type public.audience as enum ('internal', 'external', 'both');

alter table public.test_cases
  add column audience public.audience not null default 'internal';

update public.test_cases set audience = 'external' where role_assignee = 'Company Admin';

-- Same as before, plus `audience` (optional in the payload: omitted keeps the current value,
-- and new cases default to internal).
create or replace function public.save_test_case(p_payload jsonb)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_case_id uuid := nullif(p_payload->>'id', '')::uuid;
  v_section_id uuid := nullif(p_payload->>'section_id', '')::uuid;
  v_suite_id uuid;
  v_status public.suite_status;
  v_old_suite_id uuid;
  v_pre jsonb; v_pre_ord bigint; v_pre_ids uuid[] := '{}';
  v_step jsonb; v_step_ord bigint; v_step_id uuid; v_step_ids uuid[] := '{}';
  v_er jsonb; v_er_ord bigint; v_er_id uuid; v_er_ids uuid[];
  v_id uuid;
begin
  perform public.assert_can('author');

  if coalesce(btrim(p_payload->>'title'), '') = '' then
    raise exception 'Test case title is required';
  end if;

  select test_suite_id into v_suite_id from public.sections where id = v_section_id;
  if v_suite_id is null then
    raise exception 'Section % not found', v_section_id;
  end if;
  v_status := public.assert_suite_editable(v_suite_id);

  if v_case_id is null then
    insert into public.test_cases (section_id, title, description, priority, role_assignee, audience, created_by, order_index)
    values (
      v_section_id,
      btrim(p_payload->>'title'),
      coalesce(p_payload->>'description', ''),
      coalesce(nullif(p_payload->>'priority', '')::public.priority_level, 'medium'),
      nullif(p_payload->>'role_assignee', '')::public.role_assignee_type,
      coalesce(nullif(p_payload->>'audience', '')::public.audience, 'internal'),
      nullif(p_payload->>'created_by', '')::uuid,
      coalesce((select max(order_index) + 1 from public.test_cases where section_id = v_section_id), 0)
    )
    returning id into v_case_id;
  else
    select s.test_suite_id into v_old_suite_id
    from public.test_cases tc join public.sections s on s.id = tc.section_id
    where tc.id = v_case_id;
    if v_old_suite_id is null then
      raise exception 'Test case % not found', v_case_id;
    end if;
    if v_old_suite_id <> v_suite_id then
      raise exception 'A test case can only move between sections of the same suite';
    end if;

    update public.test_cases
    set section_id = v_section_id,
        title = btrim(p_payload->>'title'),
        description = coalesce(p_payload->>'description', description),
        priority = coalesce(nullif(p_payload->>'priority', '')::public.priority_level, priority),
        role_assignee = nullif(p_payload->>'role_assignee', '')::public.role_assignee_type,
        audience = coalesce(nullif(p_payload->>'audience', '')::public.audience, audience),
        -- Cases stay 'new' until testing has started.
        lifecycle_status = case when v_status = 'in_testing' then 'updated'::public.test_case_lifecycle else lifecycle_status end
    where id = v_case_id;
  end if;

  -- Preconditions
  for v_pre, v_pre_ord in select e, o from jsonb_array_elements(coalesce(p_payload->'preconditions', '[]')) with ordinality as t(e, o) loop
    if coalesce(btrim(v_pre->>'condition'), '') = '' then continue; end if;
    v_id := nullif(v_pre->>'id', '')::uuid;
    if v_id is not null and exists (select 1 from public.preconditions where id = v_id and test_case_id = v_case_id) then
      update public.preconditions set condition = btrim(v_pre->>'condition'), order_index = v_pre_ord - 1 where id = v_id;
    else
      insert into public.preconditions (test_case_id, condition, order_index)
      values (v_case_id, btrim(v_pre->>'condition'), v_pre_ord - 1)
      returning id into v_id;
    end if;
    v_pre_ids := v_pre_ids || v_id;
  end loop;
  delete from public.preconditions where test_case_id = v_case_id and not (id = any(v_pre_ids));

  -- Steps and their expected results
  for v_step, v_step_ord in select e, o from jsonb_array_elements(coalesce(p_payload->'steps', '[]')) with ordinality as t(e, o) loop
    if coalesce(btrim(v_step->>'step'), '') = '' then
      raise exception 'Step % has no text', v_step_ord;
    end if;
    v_step_id := nullif(v_step->>'id', '')::uuid;
    if v_step_id is not null and exists (select 1 from public.test_steps where id = v_step_id and test_case_id = v_case_id) then
      update public.test_steps set step = btrim(v_step->>'step'), order_index = v_step_ord - 1 where id = v_step_id;
    else
      insert into public.test_steps (test_case_id, step, order_index)
      values (v_case_id, btrim(v_step->>'step'), v_step_ord - 1)
      returning id into v_step_id;
    end if;
    v_step_ids := v_step_ids || v_step_id;

    v_er_ids := '{}';
    for v_er, v_er_ord in select e, o from jsonb_array_elements(coalesce(v_step->'expected_results', '[]')) with ordinality as t(e, o) loop
      if coalesce(btrim(v_er->>'result'), '') = '' then continue; end if;
      v_er_id := nullif(v_er->>'id', '')::uuid;
      if v_er_id is not null and exists (select 1 from public.expected_results where id = v_er_id and test_step_id = v_step_id) then
        update public.expected_results set result = btrim(v_er->>'result'), order_index = v_er_ord - 1 where id = v_er_id;
      else
        insert into public.expected_results (test_step_id, result, order_index)
        values (v_step_id, btrim(v_er->>'result'), v_er_ord - 1)
        returning id into v_er_id;
      end if;
      v_er_ids := v_er_ids || v_er_id;
    end loop;
    delete from public.expected_results where test_step_id = v_step_id and not (id = any(v_er_ids));
  end loop;

  -- Steps removed from the payload (legacy live remarks go with them; snapshots keep theirs).
  delete from public.test_remarks
  where test_step_id in (select id from public.test_steps where test_case_id = v_case_id and not (id = any(v_step_ids)));
  delete from public.expected_results
  where test_step_id in (select id from public.test_steps where test_case_id = v_case_id and not (id = any(v_step_ids)));
  delete from public.test_steps where test_case_id = v_case_id and not (id = any(v_step_ids));

  -- A Ready suite must keep at least one complete test case.
  if v_status = 'ready' then
    perform public.assert_suite_readiness(v_suite_id);
  end if;

  return v_case_id;
end;
$function$;
