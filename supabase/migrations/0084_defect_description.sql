-- A free-form description on a defect, next to the structured precondition / steps / results fields.
-- Optional; empty by default. create_defect and update_defect gain p_description (last parameter).

alter table public.defects add column description text not null default '';

drop function if exists public.create_defect(uuid, text, text, text, text, text, public.defect_severity, uuid[], uuid[], jsonb);
drop function if exists public.update_defect(uuid, text, text, text, text, text, public.defect_severity, public.defect_status, uuid[], uuid[], jsonb);

create or replace function public.create_defect(
  p_iteration_id uuid,
  p_summary text,
  p_precondition text default '',
  p_steps_to_reproduce text default '',
  p_expected_result text default '',
  p_actual_result text default '',
  p_severity public.defect_severity default 'medium',
  p_remark_ids uuid[] default '{}',
  p_case_result_ids uuid[] default '{}',
  p_external jsonb default '[]',
  p_description text default ''
)
returns public.defects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_suite uuid;
  v_number int;
  v_defect public.defects;
begin
  if v_uid is null or not (select public.can_see_all_results()) then
    raise exception 'forbidden: only staff can log defects' using errcode = '42501';
  end if;
  if coalesce(btrim(p_summary), '') = '' then
    raise exception 'A summary is required.' using errcode = '22023';
  end if;
  if char_length(btrim(p_summary)) > 200 then
    raise exception 'The summary can be at most 200 characters.' using errcode = '22023';
  end if;

  select testing_suite_id into v_suite from public.test_iterations where id = p_iteration_id;
  if not found then
    raise exception 'That testing round no longer exists.' using errcode = '22023';
  end if;

  -- The upsert locks the suite's counter row, so concurrent creates get distinct numbers.
  insert into public.defect_counters (testing_suite_id, last_number)
  values (v_suite, 1)
  on conflict (testing_suite_id) do update set last_number = public.defect_counters.last_number + 1
  returning last_number into v_number;

  insert into public.defects (testing_suite_id, iteration_id, number, summary, description, precondition, steps_to_reproduce, expected_result, actual_result, severity, created_by)
  values (v_suite, p_iteration_id, v_number, btrim(p_summary), coalesce(p_description, ''), coalesce(p_precondition, ''), coalesce(p_steps_to_reproduce, ''),
    coalesce(p_expected_result, ''), coalesce(p_actual_result, ''), coalesce(p_severity, 'medium'), v_uid)
  returning * into v_defect;

  perform public.defect_sync_references(v_defect.id, p_iteration_id, p_remark_ids, p_case_result_ids, p_external);
  return v_defect;
end;
$$;

-- Null reference lists leave them unchanged, so a status or severity change can skip them. A null description is left as is.
create or replace function public.update_defect(
  p_defect_id uuid,
  p_summary text,
  p_precondition text,
  p_steps_to_reproduce text,
  p_expected_result text,
  p_actual_result text,
  p_severity public.defect_severity,
  p_status public.defect_status,
  p_remark_ids uuid[] default null,
  p_case_result_ids uuid[] default null,
  p_external jsonb default null,
  p_description text default null
)
returns public.defects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_defect public.defects;
begin
  if (select auth.uid()) is null or not (select public.can_see_all_results()) then
    raise exception 'forbidden: only staff can edit defects' using errcode = '42501';
  end if;
  if coalesce(btrim(p_summary), '') = '' then
    raise exception 'A summary is required.' using errcode = '22023';
  end if;
  if char_length(btrim(p_summary)) > 200 then
    raise exception 'The summary can be at most 200 characters.' using errcode = '22023';
  end if;

  update public.defects
  set summary = btrim(p_summary),
      description = coalesce(p_description, description),
      precondition = coalesce(p_precondition, ''),
      steps_to_reproduce = coalesce(p_steps_to_reproduce, ''),
      expected_result = coalesce(p_expected_result, ''),
      actual_result = coalesce(p_actual_result, ''),
      severity = coalesce(p_severity, severity),
      status = coalesce(p_status, status),
      updated_at = now()
  where id = p_defect_id
  returning * into v_defect;
  if not found then
    raise exception 'That defect no longer exists.' using errcode = '22023';
  end if;

  perform public.defect_sync_references(v_defect.id, v_defect.iteration_id, p_remark_ids, p_case_result_ids, p_external);
  return v_defect;
end;
$$;

revoke all on function public.create_defect(uuid, text, text, text, text, text, public.defect_severity, uuid[], uuid[], jsonb, text) from public, anon;
grant execute on function public.create_defect(uuid, text, text, text, text, text, public.defect_severity, uuid[], uuid[], jsonb, text) to authenticated;
revoke all on function public.update_defect(uuid, text, text, text, text, text, public.defect_severity, public.defect_status, uuid[], uuid[], jsonb, text) from public, anon;
grant execute on function public.update_defect(uuid, text, text, text, text, text, public.defect_severity, public.defect_status, uuid[], uuid[], jsonb, text) to authenticated;
