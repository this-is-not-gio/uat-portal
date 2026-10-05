-- Overview custom sections: author-defined cards (header, Lucide icon name, Markdown content), one row per section.
-- Same visibility as suite_test_accounts: staff see every suite's; other testers only suites their org takes part in.
-- Written only through save_suite_overview_sections (Admin, suite not locked), which replaces the whole list.

create table if not exists public.suite_overview_sections (
  id uuid primary key default gen_random_uuid(),
  testing_suite_id uuid not null references public.testing_suites(id) on delete cascade,
  title text not null,
  icon text,
  content text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists suite_overview_sections_suite_idx on public.suite_overview_sections (testing_suite_id, sort_order);

alter table public.suite_overview_sections enable row level security;

drop policy if exists "overview sections: staff or participating org" on public.suite_overview_sections;
create policy "overview sections: staff or participating org" on public.suite_overview_sections
  for select to authenticated
  using (
    (select public.can_see_all_results())
    or exists (
      select 1
      from public.iteration_participants ip
      join public.test_iterations ti on ti.id = ip.iteration_id
      where ti.testing_suite_id = suite_overview_sections.testing_suite_id
        and ip.organization_id = (select public.current_org_id())
    )
  );

-- p_sections: [{ "title": "...", "icon": "signpost" | null, "content": "markdown" }, ...] in display order.
create or replace function public.save_suite_overview_sections(p_suite_id uuid, p_sections jsonb)
returns setof public.suite_overview_sections
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can('author');
  perform public.assert_suite_editable(p_suite_id);

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb)) s
    where coalesce(btrim(s->>'title'), '') = ''
  ) then
    raise exception 'Every custom section needs a header';
  end if;

  delete from public.suite_overview_sections where testing_suite_id = p_suite_id;

  insert into public.suite_overview_sections (testing_suite_id, title, icon, content, sort_order)
  select p_suite_id,
         btrim(s.value->>'title'),
         nullif(btrim(s.value->>'icon'), ''),
         coalesce(s.value->>'content', ''),
         s.ordinality::integer
  from jsonb_array_elements(coalesce(p_sections, '[]'::jsonb)) with ordinality s;

  return query
    select * from public.suite_overview_sections where testing_suite_id = p_suite_id order by sort_order;
end;
$$;

revoke execute on function public.save_suite_overview_sections(uuid, jsonb) from public, anon;
grant execute on function public.save_suite_overview_sections(uuid, jsonb) to authenticated;
