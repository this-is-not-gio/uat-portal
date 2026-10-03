-- Bulk import of test cases from a CSV/XLSX file, in one transaction.
-- p_cases is a list of save_test_case payloads that name their section
-- (section_name) instead of pointing at one (section_id). Missing sections are
-- created in file order; cases are created through save_test_case so they get
-- the same blank-handling, defaults, codes and Ready re-check as the editor.

create or replace function public.import_test_cases(p_suite_id uuid, p_cases jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int := jsonb_array_length(coalesce(p_cases, '[]'));
  v_case jsonb;
  v_name text;
  v_slug text;
  v_section_id uuid;
  v_sections jsonb := '{}'; -- slug -> section id
  v_sections_created int := 0;
begin
  perform public.assert_can('author');

  -- Serialises imports into the same suite so the max+1 codes and order indexes can't collide.
  perform 1 from public.testing_suites where id = p_suite_id for update;
  perform public.assert_suite_editable(p_suite_id);

  if v_count = 0 then
    raise exception 'The file has no test cases to import';
  end if;
  if v_count > 500 then
    raise exception 'Import is limited to 500 test cases at a time (the file has %)', v_count;
  end if;

  for v_case in select e from jsonb_array_elements(p_cases) as t(e) loop
    v_name := btrim(coalesce(v_case->>'section_name', ''));
    v_slug := public.slugify(v_name);
    if v_slug = '' then
      raise exception 'Test case "%" has no usable section name', v_case->>'title';
    end if;

    v_section_id := (v_sections->>v_slug)::uuid;
    if v_section_id is null then
      select id into v_section_id from public.sections where test_suite_id = p_suite_id and slug = v_slug;
      if v_section_id is null then
        insert into public.sections (test_suite_id, name, slug, order_index)
        values (p_suite_id, v_name, v_slug,
                coalesce((select max(order_index) + 1 from public.sections where test_suite_id = p_suite_id), 0))
        returning id into v_section_id;
        v_sections_created := v_sections_created + 1;
      end if;
      v_sections := v_sections || jsonb_build_object(v_slug, v_section_id);
    end if;

    -- Import is create-only: never let a payload id update an existing case.
    perform public.save_test_case(
      (v_case - 'section_name' - 'id') || jsonb_build_object('section_id', v_section_id)
    );
  end loop;

  return jsonb_build_object('created', v_count, 'sectionsCreated', v_sections_created);
end;
$$;

revoke execute on function public.import_test_cases(uuid, jsonb) from public, anon;
grant execute on function public.import_test_cases(uuid, jsonb) to authenticated;
