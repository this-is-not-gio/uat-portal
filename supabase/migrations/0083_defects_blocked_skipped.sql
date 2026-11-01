-- Defects can also cite blocked and skipped steps (and blocked cases), not just failed ones.
-- Only the reference check in defect_sync_references changes; create_defect/update_defect call it as before.

-- Newly added remarks must be on a Failed/Blocked/Skipped step, or overall feedback on a Failed/Blocked case;
-- newly added cases must be Failed or Blocked. Existing references stay as saved.
create or replace function public.defect_sync_references(
  p_defect_id uuid,
  p_iteration_id uuid,
  p_remark_ids uuid[],
  p_case_result_ids uuid[],
  p_external jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remarks uuid[];
  v_cases uuid[];
  v_new uuid[];
  v_item jsonb;
  v_url text;
  v_pos int := 0;
begin
  if p_remark_ids is not null then
    v_remarks := coalesce((select array_agg(distinct r) from unnest(p_remark_ids) r where r is not null), '{}');
    delete from public.defect_remarks where defect_id = p_defect_id and remark_id is not null and remark_id <> all (v_remarks);
    v_new := coalesce((select array_agg(r) from unnest(v_remarks) r
      where not exists (select 1 from public.defect_remarks x where x.defect_id = p_defect_id and x.remark_id = r)), '{}');

    if cardinality(v_new) > 0 then
      if (
        select count(*)
        from public.test_remarks r
        left join public.test_step_results sr on sr.id = r.test_step_result_id
        join public.test_case_results cr on cr.id = coalesce(sr.test_case_result_id, r.test_case_result_id)
        where r.id = any (v_new) and cr.iteration_id = p_iteration_id
      ) <> cardinality(v_new) then
        raise exception 'Every remark must come from a test case in this round.' using errcode = '22023';
      end if;
      if exists (
        select 1
        from public.test_remarks r
        left join public.test_step_results sr on sr.id = r.test_step_result_id
        join public.test_case_results cr on cr.id = coalesce(sr.test_case_result_id, r.test_case_result_id)
        where r.id = any (v_new)
          and ((sr.id is not null and sr.status not in ('Failed', 'Blocked', 'Skipped')) or (sr.id is null and cr.status not in ('Failed', 'Blocked')))
      ) then
        raise exception 'Defects can only cite remarks on failed, blocked or skipped results.' using errcode = '22023';
      end if;

      -- Same evidence format RemarkMarkdownField writes: "**Evidence:**" then "- [Evidence 1 (Google Drive)](url)" lines.
      insert into public.defect_remarks (defect_id, remark_id, case_result_id, case_code, case_title, step_text, step_order, remark_text, evidence_links, attachment_ids)
      select
        p_defect_id,
        r.id,
        cr.id,
        cr.code,
        cr.title,
        sr.step,
        sr.order_index,
        btrim(regexp_replace(r.remark, '\*\*Evidence:\*\*.*$', '')),
        coalesce((
          select jsonb_agg(jsonb_build_object('label', m[1], 'url', m[2]))
          from regexp_matches(coalesce(substring(r.remark from '\*\*Evidence:\*\*(.*)$'), ''), '\[([^\]]*)\]\((https?://[^)\s]+)\)', 'g') as m
        ), '[]'::jsonb),
        coalesce((
          select array_agg(a.id order by a.created_at)
          from public.attachments a
          where a.remark_id = r.id and a.status = 'ready'
        ), '{}')
      from public.test_remarks r
      left join public.test_step_results sr on sr.id = r.test_step_result_id
      join public.test_case_results cr on cr.id = coalesce(sr.test_case_result_id, r.test_case_result_id)
      where r.id = any (v_new)
      order by cr.code, sr.order_index nulls last, r.created_at;
    end if;
  end if;

  if p_case_result_ids is not null then
    v_cases := coalesce((select array_agg(distinct c) from unnest(p_case_result_ids) c where c is not null), '{}');
    delete from public.defect_cases where defect_id = p_defect_id and case_result_id is not null and case_result_id <> all (v_cases);
    v_new := coalesce((select array_agg(c) from unnest(v_cases) c
      where not exists (select 1 from public.defect_cases x where x.defect_id = p_defect_id and x.case_result_id = c)), '{}');

    if cardinality(v_new) > 0 then
      if (select count(*) from public.test_case_results cr where cr.id = any (v_new) and cr.iteration_id = p_iteration_id) <> cardinality(v_new) then
        raise exception 'Every test case must come from this round.' using errcode = '22023';
      end if;
      if exists (select 1 from public.test_case_results cr where cr.id = any (v_new) and cr.status not in ('Failed', 'Blocked')) then
        raise exception 'Defects can only cite failed or blocked test cases.' using errcode = '22023';
      end if;
      insert into public.defect_cases (defect_id, case_result_id, case_code, case_title)
      select p_defect_id, cr.id, cr.code, cr.title from public.test_case_results cr where cr.id = any (v_new) order by cr.code;
    end if;
  end if;

  if p_external is not null then
    if jsonb_typeof(p_external) <> 'array' then
      raise exception 'External references must be a list.' using errcode = '22023';
    end if;
    delete from public.defect_external_refs where defect_id = p_defect_id;
    for v_item in select * from jsonb_array_elements(p_external) loop
      v_url := btrim(coalesce(v_item ->> 'url', ''));
      if v_url = '' then continue; end if;
      if v_url !~* '^https?://[^\s/]+\.[^\s]+$' then
        raise exception 'External reference links must be valid URLs.' using errcode = '22023';
      end if;
      insert into public.defect_external_refs (defect_id, label, url, position)
      values (p_defect_id, btrim(coalesce(v_item ->> 'label', '')), v_url, v_pos);
      v_pos := v_pos + 1;
    end loop;
  end if;
end;
$$;
revoke all on function public.defect_sync_references(uuid, uuid, uuid[], uuid[], jsonb) from public, anon, authenticated;
