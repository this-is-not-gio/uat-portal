-- Defect refinement: structured markdown fields, many result references, many external links.
--  * description -> precondition / steps_to_reproduce / expected_result / actual_result (old text moves to steps).
--  * A defect still belongs to one round, but cites remarks AND failed case results from any case in it
--    (defect_remarks gains the case it came from; defect_cases holds directly cited case results).
--  * jira_url -> defect_external_refs ({label, url} rows).
-- Each reference keeps a saved copy so the defect survives the source being deleted (as in 0080).

alter table public.defects
  add column precondition text not null default '',
  add column steps_to_reproduce text not null default '',
  add column expected_result text not null default '',
  add column actual_result text not null default '';
update public.defects set steps_to_reproduce = description;

alter table public.defect_remarks
  add column case_result_id uuid references public.test_case_results (id) on delete set null,
  add column case_code text,
  add column case_title text not null default '';
update public.defect_remarks dr
set case_result_id = d.test_case_result_id, case_code = d.case_code, case_title = d.case_title
from public.defects d
where d.id = dr.defect_id;

create table public.defect_cases (
  id uuid primary key default gen_random_uuid(),
  defect_id uuid not null references public.defects (id) on delete cascade,
  -- Null afterwards means the case result was removed; the copy below stays.
  case_result_id uuid references public.test_case_results (id) on delete set null,
  case_code text,
  case_title text not null default '',
  unique (defect_id, case_result_id)
);
create index defect_cases_defect_idx on public.defect_cases (defect_id);
create index defect_cases_result_idx on public.defect_cases (case_result_id) where case_result_id is not null;
insert into public.defect_cases (defect_id, case_result_id, case_code, case_title)
select id, test_case_result_id, case_code, case_title from public.defects where test_case_result_id is not null;

create table public.defect_external_refs (
  id uuid primary key default gen_random_uuid(),
  defect_id uuid not null references public.defects (id) on delete cascade,
  label text not null default '',
  url text not null check (url ~* '^https?://[^\s/]+\.[^\s]+$'),
  position int not null default 0
);
create index defect_external_refs_defect_idx on public.defect_external_refs (defect_id);
insert into public.defect_external_refs (defect_id, label, url)
select id, 'Jira', jira_url from public.defects where jira_url is not null;

alter table public.defect_cases enable row level security;
alter table public.defect_external_refs enable row level security;
create policy "defect cases: staff read" on public.defect_cases for select to authenticated
  using ((select public.can_see_all_results()));
create policy "defect external refs: staff read" on public.defect_external_refs for select to authenticated
  using ((select public.can_see_all_results()));

drop index public.defects_case_result_idx;
alter table public.defects
  drop column description,
  drop column test_case_result_id,
  drop column case_code,
  drop column case_title,
  drop column jira_url;

drop function public.create_defect(uuid, uuid[], text, text, public.defect_severity, text);
drop function public.update_defect(uuid, text, text, public.defect_severity, public.defect_status, text);

-- Internal: make a defect's references match the given lists. A null list leaves that kind untouched.
-- Only newly added remarks/cases must be on a failed result of the defect's round; existing ones stay as saved.
-- Remarks whose source was deleted (remark_id null) keep their saved copy.
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
          and ((sr.id is not null and sr.status <> 'Failed') or (sr.id is null and cr.status <> 'Failed'))
      ) then
        raise exception 'Defects can only cite remarks on failed results.' using errcode = '22023';
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
      if exists (select 1 from public.test_case_results cr where cr.id = any (v_new) and cr.status <> 'Failed') then
        raise exception 'Defects can only cite failed test cases.' using errcode = '22023';
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
  p_external jsonb default '[]'
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

  insert into public.defects (testing_suite_id, iteration_id, number, summary, precondition, steps_to_reproduce, expected_result, actual_result, severity, created_by)
  values (v_suite, p_iteration_id, v_number, btrim(p_summary), coalesce(p_precondition, ''), coalesce(p_steps_to_reproduce, ''),
    coalesce(p_expected_result, ''), coalesce(p_actual_result, ''), coalesce(p_severity, 'medium'), v_uid)
  returning * into v_defect;

  perform public.defect_sync_references(v_defect.id, p_iteration_id, p_remark_ids, p_case_result_ids, p_external);
  return v_defect;
end;
$$;

-- Null reference lists leave them unchanged, so a status or severity change can skip them.
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
  p_external jsonb default null
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

revoke all on function public.create_defect(uuid, text, text, text, text, text, public.defect_severity, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.create_defect(uuid, text, text, text, text, text, public.defect_severity, uuid[], uuid[], jsonb) to authenticated;
revoke all on function public.update_defect(uuid, text, text, text, text, text, public.defect_severity, public.defect_status, uuid[], uuid[], jsonb) from public, anon;
grant execute on function public.update_defect(uuid, text, text, text, text, text, public.defect_severity, public.defect_status, uuid[], uuid[], jsonb) to authenticated;
