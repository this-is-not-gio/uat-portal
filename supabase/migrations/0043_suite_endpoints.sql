-- Overview "Endpoints": named URLs testers use (e.g. "Staging app" → https://...), one row per endpoint.
-- Same visibility as suite_test_accounts: staff see every suite's; other testers only suites their org takes part in.
-- Written only through save_suite_endpoints (Admin, suite not locked), which replaces the whole list.

create table if not exists public.suite_endpoints (
  id uuid primary key default gen_random_uuid(),
  testing_suite_id uuid not null references public.testing_suites(id) on delete cascade,
  name text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists suite_endpoints_suite_idx on public.suite_endpoints (testing_suite_id, sort_order);

alter table public.suite_endpoints enable row level security;

drop policy if exists "endpoints: staff or participating org" on public.suite_endpoints;
create policy "endpoints: staff or participating org" on public.suite_endpoints
  for select to authenticated
  using (
    (select public.can_see_all_results())
    or exists (
      select 1
      from public.iteration_participants ip
      join public.test_iterations ti on ti.id = ip.iteration_id
      where ti.testing_suite_id = suite_endpoints.testing_suite_id
        and ip.organization_id = (select public.current_org_id())
    )
  );

-- p_endpoints: [{ "name": "...", "url": "https://..." }, ...] in display order.
create or replace function public.save_suite_endpoints(p_suite_id uuid, p_endpoints jsonb)
returns setof public.suite_endpoints
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can('author');
  perform public.assert_suite_editable(p_suite_id);

  if exists (
    select 1 from jsonb_array_elements(coalesce(p_endpoints, '[]'::jsonb)) e
    where coalesce(btrim(e->>'name'), '') = '' or coalesce(btrim(e->>'url'), '') = ''
  ) then
    raise exception 'Every endpoint needs a name and a URL';
  end if;

  delete from public.suite_endpoints where testing_suite_id = p_suite_id;

  insert into public.suite_endpoints (testing_suite_id, name, url, sort_order)
  select p_suite_id,
         btrim(e.value->>'name'),
         btrim(e.value->>'url'),
         e.ordinality::integer
  from jsonb_array_elements(coalesce(p_endpoints, '[]'::jsonb)) with ordinality e;

  return query
    select * from public.suite_endpoints where testing_suite_id = p_suite_id order by sort_order;
end;
$$;

revoke execute on function public.save_suite_endpoints(uuid, jsonb) from public, anon;
grant execute on function public.save_suite_endpoints(uuid, jsonb) to authenticated;
