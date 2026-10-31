-- Defects logged by staff from client remarks on failed results (spec #52).
-- A defect belongs to one case result of one round and cites 1+ remarks of that case. The suite,
-- round and case code/title are copied onto the defect, and each cited remark is saved as a copy
-- (step, text, evidence), so the record survives the result or remark being deleted.

create type public.defect_severity as enum ('critical', 'high', 'medium', 'low');
create type public.defect_status as enum ('open', 'resolved', 'wont_fix');

create table public.defects (
  id uuid primary key default gen_random_uuid(),
  testing_suite_id uuid not null references public.testing_suites (id) on delete cascade,
  iteration_id uuid not null references public.test_iterations (id) on delete cascade,
  -- Required on create; null afterwards means the source result was removed.
  test_case_result_id uuid references public.test_case_results (id) on delete set null,
  number int not null,
  case_code text,
  case_title text not null default '',
  summary text not null check (btrim(summary) <> '' and char_length(summary) <= 200),
  description text not null default '',
  severity public.defect_severity not null default 'medium',
  status public.defect_status not null default 'open',
  jira_url text check (jira_url is null or jira_url ~* '^https?://[^\s/]+\.[^\s]+$'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (testing_suite_id, number)
);
create index defects_iteration_idx on public.defects (iteration_id);
create index defects_case_result_idx on public.defects (test_case_result_id) where test_case_result_id is not null;

create table public.defect_remarks (
  id uuid primary key default gen_random_uuid(),
  defect_id uuid not null references public.defects (id) on delete cascade,
  -- Null afterwards means the source remark was removed; the copy below stays.
  remark_id uuid references public.test_remarks (id) on delete set null,
  step_text text, -- null: overall feedback on the case
  step_order int,
  remark_text text not null,
  evidence_links jsonb not null default '[]', -- [{ label, url }] from the remark's **Evidence:** list
  attachment_ids uuid[] not null default '{}'
);
create index defect_remarks_defect_idx on public.defect_remarks (defect_id);
create index defect_remarks_remark_idx on public.defect_remarks (remark_id) where remark_id is not null;

-- Last number handed out per suite. Numbers are never reused, even after a delete.
create table public.defect_counters (
  testing_suite_id uuid primary key references public.testing_suites (id) on delete cascade,
  last_number int not null
);

alter table public.defects enable row level security;
alter table public.defect_remarks enable row level security;
alter table public.defect_counters enable row level security;

-- Staff only, read only: writes go through the functions below.
create policy "defects: staff read" on public.defects for select to authenticated
  using ((select public.can_see_all_results()));
create policy "defect remarks: staff read" on public.defect_remarks for select to authenticated
  using ((select public.can_see_all_results()));

create or replace function public.create_defect(
  p_case_result_id uuid,
  p_remark_ids uuid[],
  p_summary text,
  p_description text default '',
  p_severity public.defect_severity default 'medium',
  p_jira_url text default null
)
returns public.defects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ids uuid[] := coalesce((select array_agg(distinct r) from unnest(p_remark_ids) r where r is not null), '{}');
  v_case record;
  v_found int;
  v_number int;
  v_jira text := nullif(btrim(coalesce(p_jira_url, '')), '');
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
  if v_jira is not null and v_jira !~* '^https?://[^\s/]+\.[^\s]+$' then
    raise exception 'The Jira link must be a valid URL.' using errcode = '22023';
  end if;
  if cardinality(v_ids) = 0 then
    raise exception 'Pick at least one remark.' using errcode = '22023';
  end if;

  select cr.id, cr.code, cr.title, cr.status, cr.iteration_id, i.testing_suite_id
  into v_case
  from public.test_case_results cr
  join public.test_iterations i on i.id = cr.iteration_id
  where cr.id = p_case_result_id;
  if not found then
    raise exception 'That test case result no longer exists.' using errcode = '22023';
  end if;

  -- Every remark must belong to this case: on one of its failed steps, or overall feedback on it while it's failed.
  select count(*) into v_found
  from public.test_remarks r
  left join public.test_step_results sr on sr.id = r.test_step_result_id
  where r.id = any (v_ids)
    and (sr.test_case_result_id = p_case_result_id or r.test_case_result_id = p_case_result_id);
  if v_found <> cardinality(v_ids) then
    raise exception 'Every remark must come from this test case result.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.test_remarks r
    left join public.test_step_results sr on sr.id = r.test_step_result_id
    where r.id = any (v_ids)
      and ((sr.id is not null and sr.status <> 'Failed') or (r.test_case_result_id is not null and v_case.status <> 'Failed'))
  ) then
    raise exception 'Defects can only be logged from remarks on failed results.' using errcode = '22023';
  end if;

  -- The upsert locks the suite's counter row, so concurrent creates get distinct numbers.
  insert into public.defect_counters (testing_suite_id, last_number)
  values (v_case.testing_suite_id, 1)
  on conflict (testing_suite_id) do update set last_number = public.defect_counters.last_number + 1
  returning last_number into v_number;

  insert into public.defects (testing_suite_id, iteration_id, test_case_result_id, number, case_code, case_title, summary, description, severity, jira_url, created_by)
  values (v_case.testing_suite_id, v_case.iteration_id, p_case_result_id, v_number, v_case.code, v_case.title,
    btrim(p_summary), coalesce(p_description, ''), coalesce(p_severity, 'medium'), v_jira, v_uid)
  returning * into v_defect;

  -- Same evidence format RemarkMarkdownField writes: "**Evidence:**" then "- [Evidence 1 (Google Drive)](url)" lines.
  insert into public.defect_remarks (defect_id, remark_id, step_text, step_order, remark_text, evidence_links, attachment_ids)
  select
    v_defect.id,
    r.id,
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
  where r.id = any (v_ids)
  order by sr.order_index nulls last, r.created_at;

  return v_defect;
end;
$$;

revoke all on function public.create_defect(uuid, uuid[], text, text, public.defect_severity, text) from public, anon;
grant execute on function public.create_defect(uuid, uuid[], text, text, public.defect_severity, text) to authenticated;
