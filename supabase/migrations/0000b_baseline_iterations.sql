-- Baseline schema (part 2 of 2): continues 0000_baseline_core.sql in the dev history.
-- Separate file because the enum values added at the end of part 1 can only be used after that transaction commits.

-- ===== 20260920072527 drop_order_index_from_test_remarks =====
alter table public.test_remarks drop column order_index;

-- ===== 20260920080557 rename_user_role_enum_values =====
alter type public.user_role rename value 'internal' to 'Internal';
alter type public.user_role rename value 'client' to 'External';

create or replace function public.is_internal()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'Internal'
  );
$function$;

-- ===== 20260921153414 add_slug_to_sections =====
alter table sections add column slug text;

update sections
set slug = lower(regexp_replace(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'), '(^-|-$)', '', 'g'));

alter table sections alter column slug set not null;
alter table sections add constraint sections_test_suite_id_slug_key unique (test_suite_id, slug);

-- ===== 20260923111530 add_test_iterations_and_results =====
create type public.iteration_status as enum ('in_progress', 'completed');

create table public.test_iterations (
  id               uuid primary key default gen_random_uuid(),
  testing_suite_id uuid not null references public.testing_suites(id) on delete cascade,
  iteration_number int  not null,
  name             text not null,
  status           public.iteration_status not null default 'in_progress',
  started_at       timestamptz not null default now(),
  completed_at     timestamptz,
  created_by       uuid references public.profiles(id),
  unique (testing_suite_id, iteration_number)
);

create unique index test_iterations_one_active_per_suite
  on public.test_iterations (testing_suite_id)
  where status = 'in_progress';

create table public.test_case_results (
  id            uuid primary key default gen_random_uuid(),
  iteration_id  uuid not null references public.test_iterations(id) on delete cascade,
  test_case_id  uuid references public.test_cases(id) on delete set null,
  code          text,
  title         text not null,
  section_name  text,
  section_order int  not null default 0,
  order_index   int  not null default 0,
  role_assignee public.role_assignee_type,
  priority      public.priority_level,
  preconditions jsonb not null default '[]'::jsonb,
  status        public.test_case_status not null default 'Untested',
  executed_by   uuid references public.profiles(id),
  completed_at  timestamptz,
  unique (iteration_id, test_case_id)
);

create table public.test_step_results (
  id                  uuid primary key default gen_random_uuid(),
  test_case_result_id uuid not null references public.test_case_results(id) on delete cascade,
  test_step_id        uuid references public.test_steps(id) on delete set null,
  order_index         int  not null default 0,
  step                text not null,
  expected_results    jsonb not null default '[]'::jsonb,
  status              public.test_step_status not null default 'Untested'
);

alter table public.test_remarks
  add column test_step_result_id uuid references public.test_step_results(id) on delete cascade;

create index on public.test_case_results (iteration_id);
create index on public.test_case_results (test_case_id);
create index on public.test_case_results (executed_by);
create index on public.test_step_results (test_case_result_id);
create index on public.test_step_results (test_step_id);
create index on public.test_remarks (test_step_result_id);
create index on public.test_iterations (created_by);

alter table public.test_iterations   enable row level security;
alter table public.test_case_results enable row level security;
alter table public.test_step_results enable row level security;

create policy "iterations are readable by any authenticated user"   on public.test_iterations   for select using (true);
create policy "case results are readable by any authenticated user" on public.test_case_results for select using (true);
create policy "step results are readable by any authenticated user" on public.test_step_results for select using (true);

create policy "only internal users manage iterations" on public.test_iterations for all using (is_internal()) with check (is_internal());
create policy "any authenticated user can record case result" on public.test_case_results for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "any authenticated user can record step result" on public.test_step_results for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- TEMP (dev only, drop when login returns)
create policy "TEMP anon can record case result" on public.test_case_results for update to anon using (true) with check (true);
create policy "TEMP anon can record step result" on public.test_step_results for update to anon using (true) with check (true);

-- ===== 20260923111607 add_iteration_functions =====
-- Snapshots every suite test case not yet in the iteration (idempotent).
create or replace function public.sync_iteration(p_iteration_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suite_id uuid;
begin
  select testing_suite_id into v_suite_id
  from public.test_iterations
  where id = p_iteration_id and status = 'in_progress';

  if v_suite_id is null then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;

  with new_cases as (
    insert into public.test_case_results
      (iteration_id, test_case_id, code, title, section_name, section_order, order_index, role_assignee, priority, preconditions)
    select p_iteration_id, tc.id, tc.code, tc.title, s.name, s.order_index, tc.order_index, tc.role_assignee, tc.priority,
      coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'condition', p.condition) order by p.order_index)
        from public.preconditions p where p.test_case_id = tc.id
      ), '[]'::jsonb)
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    where s.test_suite_id = v_suite_id
    on conflict (iteration_id, test_case_id) do nothing
    returning id, test_case_id
  )
  insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
  select nc.id, ts.id, ts.order_index, ts.step,
    coalesce((
      select jsonb_agg(jsonb_build_object('id', er.id, 'result', er.result) order by er.order_index)
      from public.expected_results er where er.test_step_id = ts.id
    ), '[]'::jsonb)
  from new_cases nc
  join public.test_steps ts on ts.test_case_id = nc.test_case_id;
end;
$$;

-- Starts the next iteration for a suite; the partial unique index rejects a second active one.
create or replace function public.start_iteration(p_suite_id uuid, p_created_by uuid default null)
returns public.test_iterations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number int;
  v_iteration public.test_iterations;
begin
  select coalesce(max(iteration_number), 0) + 1 into v_number
  from public.test_iterations
  where testing_suite_id = p_suite_id;

  insert into public.test_iterations (testing_suite_id, iteration_number, name, created_by)
  values (p_suite_id, v_number, 'User Acceptance Test ' || lpad(v_number::text, 2, '0'), p_created_by)
  returning * into v_iteration;

  perform public.sync_iteration(v_iteration.id);
  return v_iteration;
end;
$$;

create or replace function public.complete_iteration(p_iteration_id uuid)
returns public.test_iterations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iteration public.test_iterations;
begin
  update public.test_iterations
  set status = 'completed', completed_at = now()
  where id = p_iteration_id and status = 'in_progress'
  returning * into v_iteration;

  if v_iteration.id is null then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;
  return v_iteration;
end;
$$;

-- Completed iterations are read-only.
create or replace function public.guard_completed_iteration()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.iteration_status;
begin
  if tg_table_name = 'test_case_results' then
    select i.status into v_status from public.test_iterations i where i.id = new.iteration_id;
  elsif tg_table_name = 'test_step_results' then
    select i.status into v_status
    from public.test_case_results cr join public.test_iterations i on i.id = cr.iteration_id
    where cr.id = new.test_case_result_id;
  elsif tg_table_name = 'test_remarks' then
    if new.test_step_result_id is null then return new; end if;
    select i.status into v_status
    from public.test_step_results sr
    join public.test_case_results cr on cr.id = sr.test_case_result_id
    join public.test_iterations i on i.id = cr.iteration_id
    where sr.id = new.test_step_result_id;
  end if;

  if v_status = 'completed' then
    raise exception 'Cannot modify results of a completed iteration';
  end if;
  return new;
end;
$$;

create trigger guard_completed_iteration before update on public.test_case_results
  for each row execute function public.guard_completed_iteration();
create trigger guard_completed_iteration before update on public.test_step_results
  for each row execute function public.guard_completed_iteration();
create trigger guard_completed_iteration before insert or update on public.test_remarks
  for each row execute function public.guard_completed_iteration();

-- ===== 20260923111745 make_remark_test_step_id_nullable =====
alter table public.test_remarks alter column test_step_id drop not null;

-- ===== 20260923113050 iteration_drift_and_derived_status =====
alter table public.test_case_results add column source_hash text;

-- Shared snapshot builders (one source of truth for sync, refresh and fingerprinting)
create or replace function public.case_preconditions_json(p_test_case_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'condition', p.condition) order by p.order_index), '[]'::jsonb)
  from public.preconditions p where p.test_case_id = p_test_case_id
$$;

create or replace function public.step_expected_results_json(p_test_step_id uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', er.id, 'result', er.result) order by er.order_index), '[]'::jsonb)
  from public.expected_results er where er.test_step_id = p_test_step_id
$$;

-- Fingerprint of everything a snapshot copies; differs => the live case changed.
create or replace function public.test_case_content_hash(p_test_case_id uuid)
returns text language sql stable set search_path = '' as $$
  select md5(jsonb_build_object(
    'code', tc.code, 'title', tc.title, 'role', tc.role_assignee, 'priority', tc.priority,
    'section', s.name,
    'preconditions', public.case_preconditions_json(tc.id),
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object('step', ts.step, 'expected', public.step_expected_results_json(ts.id)) order by ts.order_index)
      from public.test_steps ts where ts.test_case_id = tc.id
    ), '[]'::jsonb)
  )::text)
  from public.test_cases tc join public.sections s on s.id = tc.section_id
  where tc.id = p_test_case_id
$$;

-- sync_iteration now optionally takes a subset of test case ids ("add selected to this iteration").
drop function public.sync_iteration(uuid);
create function public.sync_iteration(p_iteration_id uuid, p_test_case_ids uuid[] default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_suite_id uuid;
begin
  select testing_suite_id into v_suite_id
  from public.test_iterations
  where id = p_iteration_id and status = 'in_progress';

  if v_suite_id is null then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;

  with new_cases as (
    insert into public.test_case_results
      (iteration_id, test_case_id, code, title, section_name, section_order, order_index, role_assignee, priority, preconditions, source_hash)
    select p_iteration_id, tc.id, tc.code, tc.title, s.name, s.order_index, tc.order_index, tc.role_assignee, tc.priority,
      public.case_preconditions_json(tc.id), public.test_case_content_hash(tc.id)
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    where s.test_suite_id = v_suite_id
      and (p_test_case_ids is null or tc.id = any(p_test_case_ids))
    on conflict (iteration_id, test_case_id) do nothing
    returning id, test_case_id
  )
  insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
  select nc.id, ts.id, ts.order_index, ts.step, public.step_expected_results_json(ts.id)
  from new_cases nc
  join public.test_steps ts on ts.test_case_id = nc.test_case_id;
end;
$$;

-- What differs between the active iteration and the live suite.
--   added   : in the suite, not in the iteration
--   changed : snapshot fingerprint no longer matches the live case
--   removed : snapshot's case was deleted or moved out of the suite
-- has_results = the snapshot already has any status/remark recorded (refresh would discard it).
create or replace function public.get_iteration_changes(p_iteration_id uuid)
returns table (change text, test_case_id uuid, test_case_result_id uuid, code text, title text, has_results boolean)
language sql stable security definer set search_path = '' as $$
  with it as (
    select id, testing_suite_id from public.test_iterations where id = p_iteration_id
  ),
  live as (
    select tc.id, tc.code, tc.title
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    join it on it.testing_suite_id = s.test_suite_id
  ),
  snap as (
    select cr.*,
      (cr.status <> 'Untested' or exists (
        select 1 from public.test_step_results sr
        where sr.test_case_result_id = cr.id
          and (sr.status <> 'Untested' or exists (select 1 from public.test_remarks r where r.test_step_result_id = sr.id))
      )) as has_results
    from public.test_case_results cr join it on it.id = cr.iteration_id
  )
  select 'added', l.id, null::uuid, l.code, l.title, false
  from live l where not exists (select 1 from snap where snap.test_case_id = l.id)
  union all
  select 'changed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results
  from snap join live l on l.id = snap.test_case_id
  where snap.source_hash is distinct from public.test_case_content_hash(snap.test_case_id)
  union all
  select 'removed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results
  from snap where snap.test_case_id is null or not exists (select 1 from live l where l.id = snap.test_case_id)
$$;

-- Re-copy the latest live case into an active iteration's snapshot, resetting its results.
create or replace function public.refresh_case_result(p_case_result_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_test_case_id uuid;
begin
  select cr.test_case_id into v_test_case_id
  from public.test_case_results cr
  join public.test_iterations i on i.id = cr.iteration_id
  where cr.id = p_case_result_id and i.status = 'in_progress';

  if not found then
    raise exception 'Case result % is not in an in-progress iteration', p_case_result_id;
  end if;
  if v_test_case_id is null then
    raise exception 'Test case for result % no longer exists', p_case_result_id;
  end if;

  delete from public.test_step_results where test_case_result_id = p_case_result_id; -- cascades remarks

  update public.test_case_results cr
  set code = tc.code, title = tc.title, section_name = s.name, section_order = s.order_index,
      order_index = tc.order_index, role_assignee = tc.role_assignee, priority = tc.priority,
      preconditions = public.case_preconditions_json(tc.id), source_hash = public.test_case_content_hash(tc.id),
      status = 'Untested', executed_by = null, completed_at = null
  from public.test_cases tc join public.sections s on s.id = tc.section_id
  where cr.id = p_case_result_id and tc.id = v_test_case_id;

  insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
  select p_case_result_id, ts.id, ts.order_index, ts.step, public.step_expected_results_json(ts.id)
  from public.test_steps ts where ts.test_case_id = v_test_case_id;
end;
$$;

-- Drop a case from an active iteration (e.g. one removed from the suite).
create or replace function public.remove_case_result(p_case_result_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.test_case_results cr
  using public.test_iterations i
  where cr.id = p_case_result_id and i.id = cr.iteration_id and i.status = 'in_progress';

  if not found then
    raise exception 'Case result % is not in an in-progress iteration', p_case_result_id;
  end if;
end;
$$;

-- Case verdict derived from its steps:
--   any Failed/Blocked -> Failed; all Untested -> Untested; some Untested -> In Progress; otherwise Passed.
create or replace function public.derive_case_result_status()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_case_id uuid := coalesce(new.test_case_result_id, old.test_case_result_id);
  v_total int; v_failed int; v_untested int;
  v_status public.test_case_status;
begin
  select count(*), count(*) filter (where status in ('Failed', 'Blocked')), count(*) filter (where status = 'Untested')
  into v_total, v_failed, v_untested
  from public.test_step_results where test_case_result_id = v_case_id;

  if v_total = 0 then return null; end if;

  v_status := case
    when v_failed > 0 then 'Failed'
    when v_untested = v_total then 'Untested'
    when v_untested > 0 then 'In Progress'
    else 'Passed'
  end;

  update public.test_case_results
  set status = v_status,
      completed_at = case when v_status in ('Passed', 'Failed') then coalesce(completed_at, now()) else null end
  where id = v_case_id and status is distinct from v_status;
  return null;
end;
$$;

create trigger derive_case_result_status
  after update of status on public.test_step_results
  for each row when (old.status is distinct from new.status)
  execute function public.derive_case_result_status();

-- ===== 20260923122339 add_missing_fk_indexes =====
create index if not exists idx_expected_results_test_step_id on public.expected_results (test_step_id);
create index if not exists idx_preconditions_test_case_id on public.preconditions (test_case_id);
create index if not exists idx_test_cases_created_by on public.test_cases (created_by);
create index if not exists idx_test_cases_section_id on public.test_cases (section_id);
create index if not exists idx_test_executions_executed_by on public.test_executions (executed_by);
create index if not exists idx_test_executions_test_case_id on public.test_executions (test_case_id);
create index if not exists idx_test_remarks_created_by on public.test_remarks (created_by);
create index if not exists idx_test_remarks_test_step_id on public.test_remarks (test_step_id);
create index if not exists idx_test_steps_test_case_id on public.test_steps (test_case_id);
create index if not exists idx_testing_suites_created_by on public.testing_suites (created_by);

-- ===== 20260923122428 optimize_rls_auth_initplan =====
alter policy "profiles are readable by any authenticated user" on public.profiles
  using ((select auth.role()) = 'authenticated');

alter policy "users can update their own display name" on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy "any authenticated user can record case result" on public.test_case_results
  using ((select auth.role()) = 'authenticated')
  with check ((select auth.role()) = 'authenticated');

alter policy "any authenticated user can record an execution" on public.test_executions
  with check ((select auth.role()) = 'authenticated');

alter policy "only the executor or internal can amend an execution" on public.test_executions
  using ((executed_by = (select auth.uid())) or is_internal())
  with check ((executed_by = (select auth.uid())) or is_internal());

alter policy "any authenticated user can add a remark" on public.test_remarks
  with check ((select auth.role()) = 'authenticated');

alter policy "only the author or internal can amend a remark" on public.test_remarks
  using ((created_by = (select auth.uid())) or is_internal())
  with check ((created_by = (select auth.uid())) or is_internal());

alter policy "any authenticated user can record step result" on public.test_step_results
  using ((select auth.role()) = 'authenticated')
  with check ((select auth.role()) = 'authenticated');

alter policy "any authenticated user can record step status" on public.test_steps
  using ((select auth.role()) = 'authenticated')
  with check ((select auth.role()) = 'authenticated');

-- ===== 20260923122751 narrow_internal_all_policies_off_select =====
-- expected_results
drop policy "only internal users manage expected results" on public.expected_results;
create policy "only internal users insert expected results" on public.expected_results for insert to public with check (is_internal());
create policy "only internal users update expected results" on public.expected_results for update to public using (is_internal()) with check (is_internal());
create policy "only internal users delete expected results" on public.expected_results for delete to public using (is_internal());

-- preconditions
drop policy "only internal users manage preconditions" on public.preconditions;
create policy "only internal users insert preconditions" on public.preconditions for insert to public with check (is_internal());
create policy "only internal users update preconditions" on public.preconditions for update to public using (is_internal()) with check (is_internal());
create policy "only internal users delete preconditions" on public.preconditions for delete to public using (is_internal());

-- sections
drop policy "only internal users manage sections" on public.sections;
create policy "only internal users insert sections" on public.sections for insert to public with check (is_internal());
create policy "only internal users update sections" on public.sections for update to public using (is_internal()) with check (is_internal());
create policy "only internal users delete sections" on public.sections for delete to public using (is_internal());

-- test_cases
drop policy "only internal users manage test cases" on public.test_cases;
create policy "only internal users insert test cases" on public.test_cases for insert to public with check (is_internal());
create policy "only internal users update test cases" on public.test_cases for update to public using (is_internal()) with check (is_internal());
create policy "only internal users delete test cases" on public.test_cases for delete to public using (is_internal());

-- test_iterations
drop policy "only internal users manage iterations" on public.test_iterations;
create policy "only internal users insert iterations" on public.test_iterations for insert to public with check (is_internal());
create policy "only internal users update iterations" on public.test_iterations for update to public using (is_internal()) with check (is_internal());
create policy "only internal users delete iterations" on public.test_iterations for delete to public using (is_internal());

-- test_steps
drop policy "only internal users manage test steps" on public.test_steps;
create policy "only internal users insert test steps" on public.test_steps for insert to public with check (is_internal());
create policy "only internal users update test steps" on public.test_steps for update to public using (is_internal()) with check (is_internal());
create policy "only internal users delete test steps" on public.test_steps for delete to public using (is_internal());

-- testing_suites
drop policy "only internal users manage epics" on public.testing_suites;
create policy "only internal users insert epics" on public.testing_suites for insert to public with check (is_internal());
create policy "only internal users update epics" on public.testing_suites for update to public using (is_internal()) with check (is_internal());
create policy "only internal users delete epics" on public.testing_suites for delete to public using (is_internal());

-- ===== 20260923123304 snapshot_section_slug =====
alter table public.test_case_results add column section_slug text;

-- Backfill from the live section the case still belongs to.
update public.test_case_results cr
set section_slug = s.slug
from public.test_cases tc join public.sections s on s.id = tc.section_id
where tc.id = cr.test_case_id and cr.section_slug is null;

create or replace function public.sync_iteration(p_iteration_id uuid, p_test_case_ids uuid[] default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_suite_id uuid;
begin
  select testing_suite_id into v_suite_id
  from public.test_iterations
  where id = p_iteration_id and status = 'in_progress';

  if v_suite_id is null then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;

  with new_cases as (
    insert into public.test_case_results
      (iteration_id, test_case_id, code, title, section_name, section_slug, section_order, order_index, role_assignee, priority, preconditions, source_hash)
    select p_iteration_id, tc.id, tc.code, tc.title, s.name, s.slug, s.order_index, tc.order_index, tc.role_assignee, tc.priority,
      public.case_preconditions_json(tc.id), public.test_case_content_hash(tc.id)
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    where s.test_suite_id = v_suite_id
      and (p_test_case_ids is null or tc.id = any(p_test_case_ids))
    on conflict (iteration_id, test_case_id) do nothing
    returning id, test_case_id
  )
  insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
  select nc.id, ts.id, ts.order_index, ts.step, public.step_expected_results_json(ts.id)
  from new_cases nc
  join public.test_steps ts on ts.test_case_id = nc.test_case_id;
end;
$$;

create or replace function public.refresh_case_result(p_case_result_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_test_case_id uuid;
begin
  select cr.test_case_id into v_test_case_id
  from public.test_case_results cr
  join public.test_iterations i on i.id = cr.iteration_id
  where cr.id = p_case_result_id and i.status = 'in_progress';

  if not found then
    raise exception 'Case result % is not in an in-progress iteration', p_case_result_id;
  end if;
  if v_test_case_id is null then
    raise exception 'Test case for result % no longer exists', p_case_result_id;
  end if;

  delete from public.test_step_results where test_case_result_id = p_case_result_id; -- cascades remarks

  update public.test_case_results cr
  set code = tc.code, title = tc.title, section_name = s.name, section_slug = s.slug, section_order = s.order_index,
      order_index = tc.order_index, role_assignee = tc.role_assignee, priority = tc.priority,
      preconditions = public.case_preconditions_json(tc.id), source_hash = public.test_case_content_hash(tc.id),
      status = 'Untested', executed_by = null, completed_at = null
  from public.test_cases tc join public.sections s on s.id = tc.section_id
  where cr.id = p_case_result_id and tc.id = v_test_case_id;

  insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
  select p_case_result_id, ts.id, ts.order_index, ts.step, public.step_expected_results_json(ts.id)
  from public.test_steps ts where ts.test_case_id = v_test_case_id;
end;
$$;

-- ===== 20260924051152 add_blocked_to_test_case_status =====
alter type public.test_case_status add value if not exists 'Blocked';

-- ===== 20260924051208 suite_lifecycle_schema =====
-- Suite status
create type public.suite_status as enum ('draft', 'ready', 'in_testing', 'signed_off', 'archived');

alter table public.testing_suites
  add column status public.suite_status not null default 'draft';

update public.testing_suites s
set status = 'in_testing'
where exists (select 1 from public.test_iterations i where i.testing_suite_id = s.id);

-- Sign-off history: the current sign-off is the latest row with revoked_at is null.
create table public.suite_sign_offs (
  id uuid primary key default gen_random_uuid(),
  testing_suite_id uuid not null references public.testing_suites(id) on delete cascade,
  iteration_id uuid not null references public.test_iterations(id) on delete cascade,
  signed_off_by uuid references public.profiles(id),
  signed_off_at timestamptz not null default now(),
  note text,
  exceptions jsonb not null default '{}'::jsonb,
  revoked_at timestamptz,
  revoked_by uuid references public.profiles(id)
);
create index suite_sign_offs_testing_suite_id_idx on public.suite_sign_offs (testing_suite_id);
create index suite_sign_offs_iteration_id_idx on public.suite_sign_offs (iteration_id);
create index suite_sign_offs_signed_off_by_idx on public.suite_sign_offs (signed_off_by);
create index suite_sign_offs_revoked_by_idx on public.suite_sign_offs (revoked_by);
create unique index suite_sign_offs_one_active_per_suite
  on public.suite_sign_offs (testing_suite_id) where revoked_at is null;

alter table public.suite_sign_offs enable row level security;
create policy "sign-offs are readable by any authenticated user"
  on public.suite_sign_offs for select using (true);

-- Iteration label and planned end date
alter table public.test_iterations
  add column label text,
  add column planned_end_date date;

-- Manual override + sync tracking on case results
alter table public.test_case_results
  add column status_overridden boolean not null default false,
  add column sync_kind text check (sync_kind in ('added', 'updated', 'force_reset')),
  add column synced_at timestamptz,
  add column synced_by uuid references public.profiles(id);
create index test_case_results_synced_by_idx on public.test_case_results (synced_by);

-- Results wiped by a vendor force refresh are archived here, never lost.
create table public.test_case_result_archives (
  id uuid primary key default gen_random_uuid(),
  test_case_result_id uuid not null references public.test_case_results(id) on delete cascade,
  iteration_id uuid not null references public.test_iterations(id) on delete cascade,
  archived_by uuid references public.profiles(id),
  archived_at timestamptz not null default now(),
  reason text not null check (length(btrim(reason)) > 0),
  snapshot jsonb not null
);
create index test_case_result_archives_case_result_idx on public.test_case_result_archives (test_case_result_id);
create index test_case_result_archives_iteration_idx on public.test_case_result_archives (iteration_id);
create index test_case_result_archives_archived_by_idx on public.test_case_result_archives (archived_by);

alter table public.test_case_result_archives enable row level security;
create policy "result archives are readable by any authenticated user"
  on public.test_case_result_archives for select using (true);

-- ===== 20260924051230 derived_case_status_blocked_and_override =====
-- Case status derived from steps, first match wins:
-- any Failed -> Failed; any Blocked -> Blocked; all Untested -> Untested;
-- some Untested -> In Progress; all Passed/Skipped with >=1 Passed -> Passed;
-- all Skipped -> Untested (nothing was verified).
-- A manual override (status_overridden) is never clobbered.
create or replace function public.derive_case_result_status()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
declare
  v_case_id uuid := coalesce(new.test_case_result_id, old.test_case_result_id);
  v_total int; v_failed int; v_blocked int; v_untested int; v_passed int;
  v_status public.test_case_status;
begin
  select count(*),
         count(*) filter (where status = 'Failed'),
         count(*) filter (where status = 'Blocked'),
         count(*) filter (where status = 'Untested'),
         count(*) filter (where status = 'Passed')
  into v_total, v_failed, v_blocked, v_untested, v_passed
  from public.test_step_results where test_case_result_id = v_case_id;

  if v_total = 0 then return null; end if;

  v_status := case
    when v_failed > 0 then 'Failed'
    when v_blocked > 0 then 'Blocked'
    when v_untested = v_total then 'Untested'
    when v_untested > 0 then 'In Progress'
    when v_passed > 0 then 'Passed'
    else 'Untested'
  end;

  update public.test_case_results
  set status = v_status,
      completed_at = case when v_status in ('Passed', 'Failed', 'Blocked') then coalesce(completed_at, now()) else null end
  where id = v_case_id
    and not status_overridden
    and status is distinct from v_status;
  return null;
end;
$function$;

-- Recompute on demand (used after clearing an override).
create or replace function public.recompute_case_result_status(p_case_result_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  update public.test_step_results set status = status
  where id = (select id from public.test_step_results where test_case_result_id = p_case_result_id limit 1);
end;
$function$;

-- "Has results": case or any step moved off Untested, or any remark on its steps.
create or replace function public.case_result_has_results(p_case_result_id uuid)
 returns boolean
 language sql
 stable
 set search_path to ''
as $function$
  select exists (
    select 1 from public.test_case_results cr
    where cr.id = p_case_result_id
      and (cr.status <> 'Untested' or exists (
        select 1 from public.test_step_results sr
        where sr.test_case_result_id = cr.id
          and (sr.status <> 'Untested' or exists (select 1 from public.test_remarks r where r.test_step_result_id = sr.id))
      ))
  )
$function$;

-- Unchecked refresh, only callable from other definer functions (sync / force refresh).
create or replace function public.refresh_case_result_internal(p_case_result_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_test_case_id uuid;
begin
  select cr.test_case_id into v_test_case_id
  from public.test_case_results cr
  join public.test_iterations i on i.id = cr.iteration_id
  where cr.id = p_case_result_id and i.status = 'in_progress';

  if not found then
    raise exception 'Case result % is not in an in-progress iteration', p_case_result_id;
  end if;
  if v_test_case_id is null then
    raise exception 'Test case for result % no longer exists', p_case_result_id;
  end if;

  delete from public.test_step_results where test_case_result_id = p_case_result_id; -- cascades remarks

  update public.test_case_results cr
  set code = tc.code, title = tc.title, section_name = s.name, section_slug = s.slug, section_order = s.order_index,
      order_index = tc.order_index, role_assignee = tc.role_assignee, priority = tc.priority,
      preconditions = public.case_preconditions_json(tc.id), source_hash = public.test_case_content_hash(tc.id),
      status = 'Untested', status_overridden = false, executed_by = null, completed_at = null
  from public.test_cases tc join public.sections s on s.id = tc.section_id
  where cr.id = p_case_result_id and tc.id = v_test_case_id;

  insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
  select p_case_result_id, ts.id, ts.order_index, ts.step, public.step_expected_results_json(ts.id)
  from public.test_steps ts where ts.test_case_id = v_test_case_id;
end;
$function$;
revoke execute on function public.refresh_case_result_internal(uuid) from public, anon, authenticated;

-- Public refresh/remove now refuse rows that already have results (only force refresh may reset those).
create or replace function public.refresh_case_result(p_case_result_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if public.case_result_has_results(p_case_result_id) then
    raise exception 'Case result % already has results; use force refresh with a reason', p_case_result_id;
  end if;
  perform public.refresh_case_result_internal(p_case_result_id);
end;
$function$;

create or replace function public.remove_case_result(p_case_result_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if public.case_result_has_results(p_case_result_id) then
    raise exception 'Case result % already has results and stays in this iteration', p_case_result_id;
  end if;

  delete from public.test_case_results cr
  using public.test_iterations i
  where cr.id = p_case_result_id and i.id = cr.iteration_id and i.status = 'in_progress';

  if not found then
    raise exception 'Case result % is not in an in-progress iteration', p_case_result_id;
  end if;
end;
$function$;

-- ===== 20260924051315 suite_lifecycle_functions =====
-- Single hook for role gating. No-op until login returns; then implement the
-- action -> role mapping here (author/sync/archive = vendor, run_iteration/sign_off = Internal).
create or replace function public.assert_can(p_action text)
 returns void
 language plpgsql
 stable
 set search_path to ''
as $function$
begin
  return;
end;
$function$;

-- Why a suite can't be Ready: no cases, cases without steps, steps without expected results.
create or replace function public.suite_readiness_issues(p_suite_id uuid)
 returns table(test_case_id uuid, code text, title text, issue text)
 language sql
 stable
 set search_path to ''
as $function$
  select null::uuid, null::text, null::text, 'no_test_cases'
  where not exists (
    select 1 from public.test_cases tc join public.sections s on s.id = tc.section_id
    where s.test_suite_id = p_suite_id
  )
  union all
  select tc.id, tc.code, tc.title, 'no_steps'
  from public.test_cases tc join public.sections s on s.id = tc.section_id
  where s.test_suite_id = p_suite_id
    and not exists (select 1 from public.test_steps ts where ts.test_case_id = tc.id)
  union all
  select distinct tc.id, tc.code, tc.title, 'step_without_expected_result'
  from public.test_cases tc
  join public.sections s on s.id = tc.section_id
  join public.test_steps ts on ts.test_case_id = tc.id
  where s.test_suite_id = p_suite_id
    and not exists (select 1 from public.expected_results er where er.test_step_id = ts.id)
$function$;

create or replace function public.assert_suite_readiness(p_suite_id uuid)
 returns void
 language plpgsql
 stable
 set search_path to ''
as $function$
declare
  v_issues text;
begin
  select string_agg(coalesce(code, '(suite)') || ': ' || issue, ', ' order by code)
  into v_issues
  from public.suite_readiness_issues(p_suite_id);

  if v_issues is not null then
    raise exception 'Suite is not ready: %', v_issues using errcode = 'P0001', hint = 'readiness';
  end if;
end;
$function$;

-- Authoring lock: signed_off / archived suites are read-only. Returns the current status.
create or replace function public.assert_suite_editable(p_suite_id uuid)
 returns public.suite_status
 language plpgsql
 stable
 set search_path to ''
as $function$
declare
  v_status public.suite_status;
begin
  select status into v_status from public.testing_suites where id = p_suite_id;
  if v_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_status in ('signed_off', 'archived') then
    raise exception 'Testing suite is % and can no longer be edited', v_status;
  end if;
  return v_status;
end;
$function$;

-- Manual transitions: draft <-> ready, signed_off <-> archived.
-- (in_testing / signed_off are entered via start_iteration / sign_off_suite.)
create or replace function public.set_suite_status(p_suite_id uuid, p_status public.suite_status)
 returns public.testing_suites
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite public.testing_suites;
begin
  select * into v_suite from public.testing_suites where id = p_suite_id for update;
  if v_suite.id is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;

  if v_suite.status = 'draft' and p_status = 'ready' then
    perform public.assert_can('author');
    perform public.assert_suite_readiness(p_suite_id);
  elsif v_suite.status = 'ready' and p_status = 'draft' then
    perform public.assert_can('author');
  elsif v_suite.status = 'signed_off' and p_status = 'archived' then
    perform public.assert_can('archive');
  elsif v_suite.status = 'archived' and p_status = 'signed_off' then
    perform public.assert_can('archive');
  else
    raise exception 'Cannot move suite from % to %', v_suite.status, p_status;
  end if;

  update public.testing_suites set status = p_status where id = p_suite_id returning * into v_suite;
  return v_suite;
end;
$function$;

-- start_iteration gains label / planned end date and lifecycle guards.
drop function if exists public.start_iteration(uuid, uuid);
create function public.start_iteration(
  p_suite_id uuid,
  p_created_by uuid default null,
  p_label text default null,
  p_planned_end_date date default null
)
 returns public.test_iterations
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_status public.suite_status;
  v_number int;
  v_iteration public.test_iterations;
begin
  perform public.assert_can('run_iteration');

  select status into v_suite_status from public.testing_suites where id = p_suite_id for update;
  if v_suite_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_suite_status not in ('ready', 'in_testing', 'signed_off') then
    raise exception 'Cannot start an iteration while the suite is %', v_suite_status;
  end if;
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status = 'in_progress') then
    raise exception 'An iteration is already in progress for this suite';
  end if;

  -- Reopening a signed-off suite revokes (but keeps) its sign-off.
  if v_suite_status = 'signed_off' then
    update public.suite_sign_offs
    set revoked_at = now(), revoked_by = p_created_by
    where testing_suite_id = p_suite_id and revoked_at is null;
  end if;

  select coalesce(max(iteration_number), 0) + 1 into v_number
  from public.test_iterations
  where testing_suite_id = p_suite_id;

  insert into public.test_iterations (testing_suite_id, iteration_number, name, label, planned_end_date, created_by)
  values (p_suite_id, v_number, 'User Acceptance Test ' || lpad(v_number::text, 2, '0'),
          nullif(btrim(p_label), ''), p_planned_end_date, p_created_by)
  returning * into v_iteration;

  perform public.sync_iteration(v_iteration.id);

  update public.testing_suites set status = 'in_testing' where id = p_suite_id;
  return v_iteration;
end;
$function$;

create or replace function public.complete_iteration(p_iteration_id uuid)
 returns public.test_iterations
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_iteration public.test_iterations;
begin
  perform public.assert_can('run_iteration');

  update public.test_iterations
  set status = 'completed', completed_at = now()
  where id = p_iteration_id and status = 'in_progress'
  returning * into v_iteration;

  if v_iteration.id is null then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;
  return v_iteration;
end;
$function$;

-- Cancel a round started by mistake: only while nothing has been recorded.
create or replace function public.cancel_iteration(p_iteration_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
begin
  perform public.assert_can('run_iteration');

  select testing_suite_id into v_suite_id
  from public.test_iterations
  where id = p_iteration_id and status = 'in_progress'
  for update;

  if v_suite_id is null then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;

  if exists (
    select 1 from public.test_case_results cr
    where cr.iteration_id = p_iteration_id and public.case_result_has_results(cr.id)
  ) then
    raise exception 'Iteration already has recorded results; complete it instead';
  end if;

  delete from public.test_iterations where id = p_iteration_id; -- cascades snapshot rows

  if not exists (select 1 from public.test_iterations where testing_suite_id = v_suite_id) then
    update public.testing_suites set status = 'ready' where id = v_suite_id;
  end if;
end;
$function$;

-- Sign off on the latest completed iteration. A note is required unless every case Passed.
create or replace function public.sign_off_suite(p_suite_id uuid, p_by uuid default null, p_note text default null)
 returns public.suite_sign_offs
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_status public.suite_status;
  v_iteration_id uuid;
  v_counts jsonb;
  v_total int;
  v_passed int;
  v_sign_off public.suite_sign_offs;
begin
  perform public.assert_can('sign_off');

  select status into v_status from public.testing_suites where id = p_suite_id for update;
  if v_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_status <> 'in_testing' then
    raise exception 'Only a suite in testing can be signed off (current: %)', v_status;
  end if;
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status = 'in_progress') then
    raise exception 'Complete the running iteration before signing off';
  end if;

  select id into v_iteration_id
  from public.test_iterations
  where testing_suite_id = p_suite_id and status = 'completed'
  order by iteration_number desc
  limit 1;

  if v_iteration_id is null then
    raise exception 'At least one completed iteration is required to sign off';
  end if;

  select count(*), count(*) filter (where status = 'Passed'),
         jsonb_build_object(
           'total', count(*),
           'passed', count(*) filter (where status = 'Passed'),
           'failed', count(*) filter (where status = 'Failed'),
           'blocked', count(*) filter (where status = 'Blocked'),
           'in_progress', count(*) filter (where status = 'In Progress'),
           'untested', count(*) filter (where status = 'Untested')
         )
  into v_total, v_passed, v_counts
  from public.test_case_results where iteration_id = v_iteration_id;

  if v_passed < v_total and coalesce(btrim(p_note), '') = '' then
    raise exception 'A note is required to sign off with exceptions (% of % passed)', v_passed, v_total;
  end if;

  insert into public.suite_sign_offs (testing_suite_id, iteration_id, signed_off_by, note, exceptions)
  values (p_suite_id, v_iteration_id, p_by, nullif(btrim(p_note), ''), v_counts)
  returning * into v_sign_off;

  update public.testing_suites set status = 'signed_off' where id = p_suite_id;
  return v_sign_off;
end;
$function$;

-- Vendor sync of mid-round changes, atomic. Rows with results can't be refreshed/removed here.
create or replace function public.apply_iteration_sync(
  p_iteration_id uuid,
  p_by uuid default null,
  p_add uuid[] default '{}',
  p_refresh uuid[] default '{}',
  p_remove uuid[] default '{}'
)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_new_ids uuid[];
  v_id uuid;
begin
  perform public.assert_can('sync');

  if not exists (select 1 from public.test_iterations where id = p_iteration_id and status = 'in_progress') then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;

  -- Added: only cases not already in the round.
  select coalesce(array_agg(x), '{}') into v_new_ids
  from unnest(coalesce(p_add, '{}')) x
  where not exists (select 1 from public.test_case_results cr where cr.iteration_id = p_iteration_id and cr.test_case_id = x);

  if cardinality(v_new_ids) > 0 then
    perform public.sync_iteration(p_iteration_id, v_new_ids);
    update public.test_case_results
    set sync_kind = 'added', synced_at = now(), synced_by = p_by
    where iteration_id = p_iteration_id and test_case_id = any(v_new_ids);
  end if;

  foreach v_id in array coalesce(p_refresh, '{}') loop
    if not exists (select 1 from public.test_case_results where id = v_id and iteration_id = p_iteration_id) then
      raise exception 'Case result % does not belong to this iteration', v_id;
    end if;
    perform public.refresh_case_result(v_id); -- rejects rows with results
    update public.test_case_results
    set sync_kind = 'updated', synced_at = now(), synced_by = p_by
    where id = v_id;
  end loop;

  foreach v_id in array coalesce(p_remove, '{}') loop
    if not exists (select 1 from public.test_case_results where id = v_id and iteration_id = p_iteration_id) then
      raise exception 'Case result % does not belong to this iteration', v_id;
    end if;
    perform public.remove_case_result(v_id); -- rejects rows with results
  end loop;
end;
$function$;

-- Vendor escape hatch for a tested case whose results are invalid: archive, then reset.
create or replace function public.force_refresh_case_result(p_case_result_id uuid, p_by uuid default null, p_reason text default null)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_iteration_id uuid;
  v_snapshot jsonb;
begin
  perform public.assert_can('sync');

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required to force refresh a tested case';
  end if;

  select cr.iteration_id,
         jsonb_build_object(
           'code', cr.code, 'title', cr.title, 'section_name', cr.section_name,
           'priority', cr.priority, 'role_assignee', cr.role_assignee,
           'preconditions', cr.preconditions, 'status', cr.status,
           'status_overridden', cr.status_overridden, 'executed_by', cr.executed_by,
           'completed_at', cr.completed_at, 'source_hash', cr.source_hash,
           'steps', coalesce((
             select jsonb_agg(jsonb_build_object(
               'step', sr.step, 'order_index', sr.order_index, 'status', sr.status,
               'expected_results', sr.expected_results,
               'remarks', coalesce((
                 select jsonb_agg(jsonb_build_object('remark', r.remark, 'created_by', r.created_by, 'created_at', r.created_at) order by r.created_at)
                 from public.test_remarks r where r.test_step_result_id = sr.id
               ), '[]'::jsonb)
             ) order by sr.order_index)
             from public.test_step_results sr where sr.test_case_result_id = cr.id
           ), '[]'::jsonb)
         )
  into v_iteration_id, v_snapshot
  from public.test_case_results cr
  join public.test_iterations i on i.id = cr.iteration_id
  where cr.id = p_case_result_id and i.status = 'in_progress';

  if v_iteration_id is null then
    raise exception 'Case result % is not in an in-progress iteration', p_case_result_id;
  end if;

  insert into public.test_case_result_archives (test_case_result_id, iteration_id, archived_by, reason, snapshot)
  values (p_case_result_id, v_iteration_id, p_by, btrim(p_reason), v_snapshot);

  perform public.refresh_case_result_internal(p_case_result_id);

  update public.test_case_results
  set sync_kind = 'force_reset', synced_at = now(), synced_by = p_by
  where id = p_case_result_id;
end;
$function$;

-- ===== 20260924051359 authoring_functions =====
create or replace function public.slugify(p_text text)
 returns text
 language sql
 immutable
 set search_path to ''
as $function$
  select btrim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'), '-')
$function$;

-- Hard-delete a live test case and its children (FKs have no cascade).
-- Iteration snapshots keep their copy: test_case_results.test_case_id is set null.
create or replace function public.delete_test_case_rows(p_test_case_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  delete from public.test_remarks where test_step_id in (select id from public.test_steps where test_case_id = p_test_case_id);
  delete from public.expected_results where test_step_id in (select id from public.test_steps where test_case_id = p_test_case_id);
  delete from public.test_steps where test_case_id = p_test_case_id;
  delete from public.preconditions where test_case_id = p_test_case_id;
  delete from public.test_executions where test_case_id = p_test_case_id;
  delete from public.test_cases where id = p_test_case_id;
end;
$function$;
revoke execute on function public.delete_test_case_rows(uuid) from public, anon, authenticated;

-- Suites --------------------------------------------------------------------

create or replace function public.upsert_suite(
  p_id uuid default null,
  p_name text default null,
  p_code text default null,
  p_slug text default null,
  p_description text default null,
  p_by uuid default null
)
 returns public.testing_suites
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite public.testing_suites;
begin
  perform public.assert_can('author');

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Suite name is required';
  end if;

  if p_id is null then
    insert into public.testing_suites (name, code, slug, description, created_by)
    values (btrim(p_name), nullif(upper(btrim(p_code)), ''),
            coalesce(nullif(public.slugify(p_slug), ''), public.slugify(p_name)),
            coalesce(p_description, ''), p_by)
    returning * into v_suite;
  else
    perform public.assert_suite_editable(p_id);
    update public.testing_suites
    set name = btrim(p_name),
        code = nullif(upper(btrim(p_code)), ''),
        slug = coalesce(nullif(public.slugify(p_slug), ''), slug),
        description = coalesce(p_description, description)
    where id = p_id
    returning * into v_suite;
  end if;
  return v_suite;
end;
$function$;

-- Only Draft suites can be deleted (no iterations/results exist yet).
create or replace function public.delete_suite(p_suite_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_status public.suite_status;
  v_case_id uuid;
begin
  perform public.assert_can('author');

  select status into v_status from public.testing_suites where id = p_suite_id for update;
  if v_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_status <> 'draft' then
    raise exception 'Only draft suites can be deleted (current: %)', v_status;
  end if;

  for v_case_id in
    select tc.id from public.test_cases tc join public.sections s on s.id = tc.section_id where s.test_suite_id = p_suite_id
  loop
    perform public.delete_test_case_rows(v_case_id);
  end loop;
  delete from public.sections where test_suite_id = p_suite_id;
  delete from public.testing_suites where id = p_suite_id;
end;
$function$;

-- Sections ------------------------------------------------------------------

create or replace function public.upsert_section(
  p_suite_id uuid,
  p_id uuid default null,
  p_name text default null,
  p_slug text default null
)
 returns public.sections
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_section public.sections;
begin
  perform public.assert_can('author');
  perform public.assert_suite_editable(p_suite_id);

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Section name is required';
  end if;

  if p_id is null then
    insert into public.sections (test_suite_id, name, slug, order_index)
    values (p_suite_id, btrim(p_name),
            coalesce(nullif(public.slugify(p_slug), ''), public.slugify(p_name)),
            coalesce((select max(order_index) + 1 from public.sections where test_suite_id = p_suite_id), 0))
    returning * into v_section;
  else
    update public.sections
    set name = btrim(p_name),
        slug = coalesce(nullif(public.slugify(p_slug), ''), slug)
    where id = p_id and test_suite_id = p_suite_id
    returning * into v_section;
    if v_section.id is null then
      raise exception 'Section % not found in this suite', p_id;
    end if;
  end if;
  return v_section;
end;
$function$;

create or replace function public.delete_section(p_section_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
  v_status public.suite_status;
  v_case_id uuid;
begin
  perform public.assert_can('author');

  select test_suite_id into v_suite_id from public.sections where id = p_section_id;
  if v_suite_id is null then
    raise exception 'Section % not found', p_section_id;
  end if;
  v_status := public.assert_suite_editable(v_suite_id);

  for v_case_id in select id from public.test_cases where section_id = p_section_id loop
    perform public.delete_test_case_rows(v_case_id);
  end loop;
  delete from public.sections where id = p_section_id;

  if v_status = 'ready' then
    perform public.assert_suite_readiness(v_suite_id);
  end if;
end;
$function$;

create or replace function public.reorder_sections(p_suite_id uuid, p_section_ids uuid[])
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  perform public.assert_can('author');
  perform public.assert_suite_editable(p_suite_id);

  update public.sections s
  set order_index = o.ord - 1
  from unnest(p_section_ids) with ordinality as o(id, ord)
  where s.id = o.id and s.test_suite_id = p_suite_id;
end;
$function$;

-- Test cases ----------------------------------------------------------------

-- Atomic create/update of a test case with preconditions, steps and expected results.
-- Payload: { id?, section_id, title, description?, priority?, role_assignee?, created_by?,
--            preconditions: [{ id?, condition }],
--            steps: [{ id?, step, expected_results: [{ id?, result }] }] }
-- Items with an id are updated in place (keeps snapshot links); missing items are deleted.
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
    insert into public.test_cases (section_id, title, description, priority, role_assignee, created_by, order_index)
    values (
      v_section_id,
      btrim(p_payload->>'title'),
      coalesce(p_payload->>'description', ''),
      coalesce(nullif(p_payload->>'priority', '')::public.priority_level, 'medium'),
      nullif(p_payload->>'role_assignee', '')::public.role_assignee_type,
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

  -- A Ready suite must stay valid after every save.
  if v_status = 'ready' then
    perform public.assert_suite_readiness(v_suite_id);
  end if;

  return v_case_id;
end;
$function$;

create or replace function public.delete_test_case(p_test_case_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
  v_status public.suite_status;
begin
  perform public.assert_can('author');

  select s.test_suite_id into v_suite_id
  from public.test_cases tc join public.sections s on s.id = tc.section_id
  where tc.id = p_test_case_id;
  if v_suite_id is null then
    raise exception 'Test case % not found', p_test_case_id;
  end if;
  v_status := public.assert_suite_editable(v_suite_id);

  perform public.delete_test_case_rows(p_test_case_id);

  if v_status = 'ready' then
    perform public.assert_suite_readiness(v_suite_id);
  end if;
end;
$function$;

create or replace function public.reorder_test_cases(p_section_id uuid, p_test_case_ids uuid[])
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
begin
  perform public.assert_can('author');

  select test_suite_id into v_suite_id from public.sections where id = p_section_id;
  if v_suite_id is null then
    raise exception 'Section % not found', p_section_id;
  end if;
  perform public.assert_suite_editable(v_suite_id);

  update public.test_cases tc
  set order_index = o.ord - 1
  from unnest(p_test_case_ids) with ordinality as o(id, ord)
  where tc.id = o.id and tc.section_id = p_section_id;
end;
$function$;

-- ===== 20260924051455 recompute_case_status_directly =====
-- Shared derivation so the trigger and "reset to auto" use one rule.
create or replace function public.apply_derived_case_status(p_case_result_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_total int; v_failed int; v_blocked int; v_untested int; v_passed int;
  v_status public.test_case_status;
begin
  select count(*),
         count(*) filter (where status = 'Failed'),
         count(*) filter (where status = 'Blocked'),
         count(*) filter (where status = 'Untested'),
         count(*) filter (where status = 'Passed')
  into v_total, v_failed, v_blocked, v_untested, v_passed
  from public.test_step_results where test_case_result_id = p_case_result_id;

  if v_total = 0 then return; end if;

  v_status := case
    when v_failed > 0 then 'Failed'
    when v_blocked > 0 then 'Blocked'
    when v_untested = v_total then 'Untested'
    when v_untested > 0 then 'In Progress'
    when v_passed > 0 then 'Passed'
    else 'Untested'
  end;

  update public.test_case_results
  set status = v_status,
      completed_at = case when v_status in ('Passed', 'Failed', 'Blocked') then coalesce(completed_at, now()) else null end
  where id = p_case_result_id
    and not status_overridden
    and status is distinct from v_status;
end;
$function$;

create or replace function public.derive_case_result_status()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  perform public.apply_derived_case_status(coalesce(new.test_case_result_id, old.test_case_result_id));
  return null;
end;
$function$;

-- "Reset to auto": clear the override and recompute from steps.
create or replace function public.recompute_case_result_status(p_case_result_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  update public.test_case_results set status_overridden = false where id = p_case_result_id;
  perform public.apply_derived_case_status(p_case_result_id);
end;
$function$;

-- ===== 20260924051530 lock_down_internal_helpers =====
-- Internal helper: only reachable through the trigger and recompute_case_result_status.
alter function public.derive_case_result_status() security definer;
revoke execute on function public.apply_derived_case_status(uuid) from public, anon, authenticated;

-- ===== 20260925081037 add_role_assignee_readiness_check =====
create or replace function public.suite_readiness_issues(p_suite_id uuid)
returns table(test_case_id uuid, code text, title text, issue text)
language sql
stable
set search_path to ''
as $function$
  select null::uuid, null::text, null::text, 'no_test_cases'
  where not exists (
    select 1 from public.test_cases tc join public.sections s on s.id = tc.section_id
    where s.test_suite_id = p_suite_id
  )
  union all
  select tc.id, tc.code, tc.title, 'no_steps'
  from public.test_cases tc join public.sections s on s.id = tc.section_id
  where s.test_suite_id = p_suite_id
    and not exists (select 1 from public.test_steps ts where ts.test_case_id = tc.id)
  union all
  select distinct tc.id, tc.code, tc.title, 'step_without_expected_result'
  from public.test_cases tc
  join public.sections s on s.id = tc.section_id
  join public.test_steps ts on ts.test_case_id = tc.id
  where s.test_suite_id = p_suite_id
    and not exists (select 1 from public.expected_results er where er.test_step_id = ts.id)
  union all
  select tc.id, tc.code, tc.title, 'no_role_assignee'
  from public.test_cases tc join public.sections s on s.id = tc.section_id
  where s.test_suite_id = p_suite_id
    and tc.role_assignee is null
$function$;

-- ===== 20260925112651 fix_handle_new_user_stale_role_default =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'External')
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

-- ===== 20260925113621 test_case_endorsement =====
-- Ready = the vendor endorses (and in Ready, locks) the test cases handed to
-- the client. Only endorsed test cases are copied into iterations.
alter table public.test_cases
  add column endorsed_at timestamptz,
  add column endorsed_by uuid references public.profiles(id);
create index test_cases_endorsed_by_idx on public.test_cases (endorsed_by);

-- Why one test case isn't complete enough to endorse/test.
create or replace function public.test_case_issues(p_test_case_id uuid)
 returns setof text
 language sql
 stable
 set search_path to ''
as $function$
  select 'no_steps'
  where not exists (select 1 from public.test_steps ts where ts.test_case_id = p_test_case_id)
  union all
  select 'step_without_expected_result'
  where exists (
    select 1 from public.test_steps ts
    where ts.test_case_id = p_test_case_id
      and not exists (select 1 from public.expected_results er where er.test_step_id = ts.id)
  )
  union all
  select 'no_role_assignee'
  where exists (select 1 from public.test_cases tc where tc.id = p_test_case_id and tc.role_assignee is null)
$function$;

-- Completeness of every test case in a suite (drives the Test Cases tab markers and endorse eligibility).
create or replace function public.suite_test_case_issues(p_suite_id uuid)
 returns table(test_case_id uuid, code text, title text, issue text)
 language sql
 stable
 set search_path to ''
as $function$
  select tc.id, tc.code, tc.title, i.issue
  from public.test_cases tc
  join public.sections s on s.id = tc.section_id
  cross join lateral public.test_case_issues(tc.id) as i(issue)
  where s.test_suite_id = p_suite_id
$function$;

-- What blocks Ready: no endorsed test case, or an endorsed one that isn't complete.
-- Non-endorsed drafts never block.
create or replace function public.suite_readiness_issues(p_suite_id uuid)
 returns table(test_case_id uuid, code text, title text, issue text)
 language sql
 stable
 set search_path to ''
as $function$
  select null::uuid, null::text, null::text, 'no_endorsed_test_cases'
  where not exists (
    select 1 from public.test_cases tc join public.sections s on s.id = tc.section_id
    where s.test_suite_id = p_suite_id and tc.endorsed_at is not null
  )
  union all
  select tc.id, tc.code, tc.title, i.issue
  from public.test_cases tc
  join public.sections s on s.id = tc.section_id
  cross join lateral public.test_case_issues(tc.id) as i(issue)
  where s.test_suite_id = p_suite_id and tc.endorsed_at is not null
$function$;

create or replace function public.endorse_test_cases(p_test_case_ids uuid[], p_by uuid default null)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
  v_issues text;
begin
  perform public.assert_can('author');

  for v_suite_id in
    select distinct s.test_suite_id from public.test_cases tc join public.sections s on s.id = tc.section_id
    where tc.id = any(p_test_case_ids)
  loop
    perform public.assert_suite_editable(v_suite_id);
  end loop;

  select string_agg(coalesce(tc.code, tc.title) || ': ' || i.issue, ', ' order by tc.code)
  into v_issues
  from public.test_cases tc
  cross join lateral public.test_case_issues(tc.id) as i(issue)
  where tc.id = any(p_test_case_ids);

  if v_issues is not null then
    raise exception 'Only complete test cases can be endorsed: %', v_issues using hint = 'readiness';
  end if;

  update public.test_cases
  set endorsed_at = now(), endorsed_by = p_by
  where id = any(p_test_case_ids) and endorsed_at is null;
end;
$function$;

create or replace function public.unendorse_test_cases(p_test_case_ids uuid[])
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
  v_status public.suite_status;
begin
  perform public.assert_can('author');

  for v_suite_id in
    select distinct s.test_suite_id from public.test_cases tc join public.sections s on s.id = tc.section_id
    where tc.id = any(p_test_case_ids)
  loop
    v_status := public.assert_suite_editable(v_suite_id);

    update public.test_cases tc
    set endorsed_at = null, endorsed_by = null
    from public.sections s
    where s.id = tc.section_id and s.test_suite_id = v_suite_id and tc.id = any(p_test_case_ids);

    -- A Ready suite must keep a scope to hand over.
    if v_status = 'ready' then
      perform public.assert_suite_readiness(v_suite_id);
    end if;
  end loop;
end;
$function$;

-- Rounds only ever copy endorsed test cases.
create or replace function public.sync_iteration(p_iteration_id uuid, p_test_case_ids uuid[] default null)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
begin
  select testing_suite_id into v_suite_id
  from public.test_iterations
  where id = p_iteration_id and status = 'in_progress';

  if v_suite_id is null then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;

  with new_cases as (
    insert into public.test_case_results
      (iteration_id, test_case_id, code, title, section_name, section_slug, section_order, order_index, role_assignee, priority, preconditions, source_hash)
    select p_iteration_id, tc.id, tc.code, tc.title, s.name, s.slug, s.order_index, tc.order_index, tc.role_assignee, tc.priority,
      public.case_preconditions_json(tc.id), public.test_case_content_hash(tc.id)
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    where s.test_suite_id = v_suite_id
      and tc.endorsed_at is not null
      and (p_test_case_ids is null or tc.id = any(p_test_case_ids))
    on conflict (iteration_id, test_case_id) do nothing
    returning id, test_case_id
  )
  insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
  select nc.id, ts.id, ts.order_index, ts.step, public.step_expected_results_json(ts.id)
  from new_cases nc
  join public.test_steps ts on ts.test_case_id = nc.test_case_id;
end;
$function$;

-- The live side of the diff is the endorsed scope: newly endorsed = added,
-- un-endorsed (or deleted) = removed.
create or replace function public.get_iteration_changes(p_iteration_id uuid)
 returns table(change text, test_case_id uuid, test_case_result_id uuid, code text, title text, has_results boolean)
 language sql
 stable security definer
 set search_path to ''
as $function$
  with it as (
    select id, testing_suite_id from public.test_iterations where id = p_iteration_id
  ),
  live as (
    select tc.id, tc.code, tc.title
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    join it on it.testing_suite_id = s.test_suite_id
    where tc.endorsed_at is not null
  ),
  snap as (
    select cr.*,
      (cr.status <> 'Untested' or exists (
        select 1 from public.test_step_results sr
        where sr.test_case_result_id = cr.id
          and (sr.status <> 'Untested' or exists (select 1 from public.test_remarks r where r.test_step_result_id = sr.id))
      )) as has_results
    from public.test_case_results cr join it on it.id = cr.iteration_id
  )
  select 'added', l.id, null::uuid, l.code, l.title, false
  from live l where not exists (select 1 from snap where snap.test_case_id = l.id)
  union all
  select 'changed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results
  from snap join live l on l.id = snap.test_case_id
  where snap.source_hash is distinct from public.test_case_content_hash(snap.test_case_id)
  union all
  select 'removed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results
  from snap where snap.test_case_id is null or not exists (select 1 from live l where l.id = snap.test_case_id)
$function$;

-- Existing rounds already hold their scope: whatever was copied into an iteration counts as endorsed.
update public.test_cases tc
set endorsed_at = now()
where tc.endorsed_at is null
  and exists (select 1 from public.test_case_results cr where cr.test_case_id = tc.id);

-- ===== 20260925113711 endorsed_scope_lock =====
-- In Ready the endorsed scope is locked: endorsed test cases can't be edited,
-- moved out or deleted until they're un-endorsed (or the suite goes back to Draft).
create or replace function public.assert_test_case_unlocked(p_test_case_id uuid, p_status public.suite_status)
 returns void
 language plpgsql
 stable
 set search_path to ''
as $function$
begin
  if p_status = 'ready' and exists (select 1 from public.test_cases where id = p_test_case_id and endorsed_at is not null) then
    raise exception 'Endorsed test cases are locked while the suite is Ready. Un-endorse it or move the suite back to Draft first.';
  end if;
end;
$function$;

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
  v_issues text;
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
    insert into public.test_cases (section_id, title, description, priority, role_assignee, created_by, order_index)
    values (
      v_section_id,
      btrim(p_payload->>'title'),
      coalesce(p_payload->>'description', ''),
      coalesce(nullif(p_payload->>'priority', '')::public.priority_level, 'medium'),
      nullif(p_payload->>'role_assignee', '')::public.role_assignee_type,
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
    perform public.assert_test_case_unlocked(v_case_id, v_status);

    update public.test_cases
    set section_id = v_section_id,
        title = btrim(p_payload->>'title'),
        description = coalesce(p_payload->>'description', description),
        priority = coalesce(nullif(p_payload->>'priority', '')::public.priority_level, priority),
        role_assignee = nullif(p_payload->>'role_assignee', '')::public.role_assignee_type,
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

  -- An endorsed test case must stay complete (it's in, or headed for, the testers' scope).
  if exists (select 1 from public.test_cases where id = v_case_id and endorsed_at is not null) then
    select string_agg(i, ', ') into v_issues from public.test_case_issues(v_case_id) as i;
    if v_issues is not null then
      raise exception 'Endorsed test cases must stay complete: %', v_issues;
    end if;
  end if;

  -- A Ready suite must stay valid after every save.
  if v_status = 'ready' then
    perform public.assert_suite_readiness(v_suite_id);
  end if;

  return v_case_id;
end;
$function$;

create or replace function public.delete_test_case(p_test_case_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
  v_status public.suite_status;
begin
  perform public.assert_can('author');

  select s.test_suite_id into v_suite_id
  from public.test_cases tc join public.sections s on s.id = tc.section_id
  where tc.id = p_test_case_id;
  if v_suite_id is null then
    raise exception 'Test case % not found', p_test_case_id;
  end if;
  v_status := public.assert_suite_editable(v_suite_id);
  perform public.assert_test_case_unlocked(p_test_case_id, v_status);

  perform public.delete_test_case_rows(p_test_case_id);

  if v_status = 'ready' then
    perform public.assert_suite_readiness(v_suite_id);
  end if;
end;
$function$;

create or replace function public.delete_section(p_section_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
  v_status public.suite_status;
  v_case_id uuid;
begin
  perform public.assert_can('author');

  select test_suite_id into v_suite_id from public.sections where id = p_section_id;
  if v_suite_id is null then
    raise exception 'Section % not found', p_section_id;
  end if;
  v_status := public.assert_suite_editable(v_suite_id);

  if v_status = 'ready' and exists (select 1 from public.test_cases where section_id = p_section_id and endorsed_at is not null) then
    raise exception 'This section has endorsed test cases, which are locked while the suite is Ready. Un-endorse them or move the suite back to Draft first.';
  end if;

  for v_case_id in select id from public.test_cases where section_id = p_section_id loop
    perform public.delete_test_case_rows(v_case_id);
  end loop;
  delete from public.sections where id = p_section_id;

  if v_status = 'ready' then
    perform public.assert_suite_readiness(v_suite_id);
  end if;
end;
$function$;

-- Starting a round needs a scope to copy.
create or replace function public.start_iteration(
  p_suite_id uuid,
  p_created_by uuid default null,
  p_label text default null,
  p_planned_end_date date default null
)
 returns public.test_iterations
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_status public.suite_status;
  v_number int;
  v_iteration public.test_iterations;
begin
  perform public.assert_can('run_iteration');

  select status into v_suite_status from public.testing_suites where id = p_suite_id for update;
  if v_suite_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_suite_status not in ('ready', 'in_testing', 'signed_off') then
    raise exception 'Cannot start an iteration while the suite is %', v_suite_status;
  end if;
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status = 'in_progress') then
    raise exception 'An iteration is already in progress for this suite';
  end if;
  if not exists (
    select 1 from public.test_cases tc join public.sections s on s.id = tc.section_id
    where s.test_suite_id = p_suite_id and tc.endorsed_at is not null
  ) then
    raise exception 'Endorse at least one test case before starting an iteration';
  end if;

  -- Reopening a signed-off suite revokes (but keeps) its sign-off.
  if v_suite_status = 'signed_off' then
    update public.suite_sign_offs
    set revoked_at = now(), revoked_by = p_created_by
    where testing_suite_id = p_suite_id and revoked_at is null;
  end if;

  select coalesce(max(iteration_number), 0) + 1 into v_number
  from public.test_iterations
  where testing_suite_id = p_suite_id;

  insert into public.test_iterations (testing_suite_id, iteration_number, name, label, planned_end_date, created_by)
  values (p_suite_id, v_number, 'User Acceptance Test ' || lpad(v_number::text, 2, '0'),
          nullif(btrim(p_label), ''), p_planned_end_date, p_created_by)
  returning * into v_iteration;

  perform public.sync_iteration(v_iteration.id);

  update public.testing_suites set status = 'in_testing' where id = p_suite_id;
  return v_iteration;
end;
$function$;

-- ===== 20260925115832 scope_per_iteration_replaces_endorsement =====
-- Scope is chosen when an iteration starts (the round records what it
-- contains, who started it and when), so per-case endorsement is dropped.
drop function if exists public.endorse_test_cases(uuid[], uuid);
drop function if exists public.unendorse_test_cases(uuid[]);

-- Ready = at least one complete test case exists; incomplete cases just can't be picked.
create or replace function public.suite_readiness_issues(p_suite_id uuid)
 returns table(test_case_id uuid, code text, title text, issue text)
 language sql
 stable
 set search_path to ''
as $function$
  select null::uuid, null::text, null::text, 'no_complete_test_cases'
  where not exists (
    select 1 from public.test_cases tc join public.sections s on s.id = tc.section_id
    where s.test_suite_id = p_suite_id
      and not exists (select 1 from public.test_case_issues(tc.id))
  )
$function$;

-- Restore the unlocked save/delete (no Ready lock).
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
    insert into public.test_cases (section_id, title, description, priority, role_assignee, created_by, order_index)
    values (
      v_section_id,
      btrim(p_payload->>'title'),
      coalesce(p_payload->>'description', ''),
      coalesce(nullif(p_payload->>'priority', '')::public.priority_level, 'medium'),
      nullif(p_payload->>'role_assignee', '')::public.role_assignee_type,
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

create or replace function public.delete_test_case(p_test_case_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
  v_status public.suite_status;
begin
  perform public.assert_can('author');

  select s.test_suite_id into v_suite_id
  from public.test_cases tc join public.sections s on s.id = tc.section_id
  where tc.id = p_test_case_id;
  if v_suite_id is null then
    raise exception 'Test case % not found', p_test_case_id;
  end if;
  v_status := public.assert_suite_editable(v_suite_id);

  perform public.delete_test_case_rows(p_test_case_id);

  if v_status = 'ready' then
    perform public.assert_suite_readiness(v_suite_id);
  end if;
end;
$function$;

create or replace function public.delete_section(p_section_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
  v_status public.suite_status;
  v_case_id uuid;
begin
  perform public.assert_can('author');

  select test_suite_id into v_suite_id from public.sections where id = p_section_id;
  if v_suite_id is null then
    raise exception 'Section % not found', p_section_id;
  end if;
  v_status := public.assert_suite_editable(v_suite_id);

  for v_case_id in select id from public.test_cases where section_id = p_section_id loop
    perform public.delete_test_case_rows(v_case_id);
  end loop;
  delete from public.sections where id = p_section_id;

  if v_status = 'ready' then
    perform public.assert_suite_readiness(v_suite_id);
  end if;
end;
$function$;

drop function if exists public.assert_test_case_unlocked(uuid, public.suite_status);

-- Copies the given cases (or, when null, every complete case) into a running round.
create or replace function public.sync_iteration(p_iteration_id uuid, p_test_case_ids uuid[] default null)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
begin
  select testing_suite_id into v_suite_id
  from public.test_iterations
  where id = p_iteration_id and status = 'in_progress';

  if v_suite_id is null then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;

  with new_cases as (
    insert into public.test_case_results
      (iteration_id, test_case_id, code, title, section_name, section_slug, section_order, order_index, role_assignee, priority, preconditions, source_hash)
    select p_iteration_id, tc.id, tc.code, tc.title, s.name, s.slug, s.order_index, tc.order_index, tc.role_assignee, tc.priority,
      public.case_preconditions_json(tc.id), public.test_case_content_hash(tc.id)
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    where s.test_suite_id = v_suite_id
      and (p_test_case_ids is null or tc.id = any(p_test_case_ids))
      and not exists (select 1 from public.test_case_issues(tc.id))
    on conflict (iteration_id, test_case_id) do nothing
    returning id, test_case_id
  )
  insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
  select nc.id, ts.id, ts.order_index, ts.step, public.step_expected_results_json(ts.id)
  from new_cases nc
  join public.test_steps ts on ts.test_case_id = nc.test_case_id;
end;
$function$;

-- The vendor picks the round's scope; incomplete picks are refused.
drop function if exists public.start_iteration(uuid, uuid, text, date);
create function public.start_iteration(
  p_suite_id uuid,
  p_created_by uuid default null,
  p_label text default null,
  p_planned_end_date date default null,
  p_test_case_ids uuid[] default null
)
 returns public.test_iterations
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_status public.suite_status;
  v_number int;
  v_iteration public.test_iterations;
  v_issues text;
begin
  perform public.assert_can('run_iteration');

  select status into v_suite_status from public.testing_suites where id = p_suite_id for update;
  if v_suite_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_suite_status not in ('ready', 'in_testing', 'signed_off') then
    raise exception 'Cannot start an iteration while the suite is %', v_suite_status;
  end if;
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status = 'in_progress') then
    raise exception 'An iteration is already in progress for this suite';
  end if;

  if p_test_case_ids is not null then
    if cardinality(p_test_case_ids) = 0 then
      raise exception 'Pick at least one test case for this iteration';
    end if;
    if exists (
      select 1 from unnest(p_test_case_ids) x
      where not exists (
        select 1 from public.test_cases tc join public.sections s on s.id = tc.section_id
        where tc.id = x and s.test_suite_id = p_suite_id
      )
    ) then
      raise exception 'Every picked test case must belong to this suite';
    end if;
    select string_agg(coalesce(tc.code, tc.title) || ': ' || i.issue, ', ' order by tc.code)
    into v_issues
    from public.test_cases tc
    cross join lateral public.test_case_issues(tc.id) as i(issue)
    where tc.id = any(p_test_case_ids);
    if v_issues is not null then
      raise exception 'Only complete test cases can be tested: %', v_issues;
    end if;
  end if;

  -- Reopening a signed-off suite revokes (but keeps) its sign-off.
  if v_suite_status = 'signed_off' then
    update public.suite_sign_offs
    set revoked_at = now(), revoked_by = p_created_by
    where testing_suite_id = p_suite_id and revoked_at is null;
  end if;

  select coalesce(max(iteration_number), 0) + 1 into v_number
  from public.test_iterations
  where testing_suite_id = p_suite_id;

  insert into public.test_iterations (testing_suite_id, iteration_number, name, label, planned_end_date, created_by)
  values (p_suite_id, v_number, 'User Acceptance Test ' || lpad(v_number::text, 2, '0'),
          nullif(btrim(p_label), ''), p_planned_end_date, p_created_by)
  returning * into v_iteration;

  perform public.sync_iteration(v_iteration.id, p_test_case_ids);

  if not exists (select 1 from public.test_case_results where iteration_id = v_iteration.id) then
    raise exception 'No complete test cases to copy into the iteration';
  end if;

  update public.testing_suites set status = 'in_testing' where id = p_suite_id;
  return v_iteration;
end;
$function$;

-- Sync diff. Cases left out of the round on purpose aren't pending changes:
-- "added" is only complete cases created after the round started.
create or replace function public.get_iteration_changes(p_iteration_id uuid)
 returns table(change text, test_case_id uuid, test_case_result_id uuid, code text, title text, has_results boolean)
 language sql
 stable security definer
 set search_path to ''
as $function$
  with it as (
    select id, testing_suite_id, started_at from public.test_iterations where id = p_iteration_id
  ),
  live as (
    select tc.id, tc.code, tc.title, tc.created_at
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    join it on it.testing_suite_id = s.test_suite_id
  ),
  snap as (
    select cr.*,
      (cr.status <> 'Untested' or exists (
        select 1 from public.test_step_results sr
        where sr.test_case_result_id = cr.id
          and (sr.status <> 'Untested' or exists (select 1 from public.test_remarks r where r.test_step_result_id = sr.id))
      )) as has_results
    from public.test_case_results cr join it on it.id = cr.iteration_id
  )
  select 'added', l.id, null::uuid, l.code, l.title, false
  from live l, it
  where l.created_at > it.started_at
    and not exists (select 1 from snap where snap.test_case_id = l.id)
    and not exists (select 1 from public.test_case_issues(l.id))
  union all
  select 'changed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results
  from snap join live l on l.id = snap.test_case_id
  where snap.source_hash is distinct from public.test_case_content_hash(snap.test_case_id)
  union all
  select 'removed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results
  from snap where snap.test_case_id is null or not exists (select 1 from live l where l.id = snap.test_case_id)
$function$;

alter table public.test_cases drop column if exists endorsed_at, drop column if exists endorsed_by;

-- ===== 20260925163941 add_test_iterations_slug =====
-- Slug for test_iterations, matching sections' pattern: generated from the
-- name, unique per suite (not globally) since the suite is always the parent
-- path segment anyway.
alter table public.test_iterations add column slug text;

update public.test_iterations
set slug = public.slugify(name)
where slug is null;

alter table public.test_iterations alter column slug set not null;

alter table public.test_iterations
  add constraint test_iterations_suite_slug_key unique (testing_suite_id, slug);

create or replace function public.start_iteration(p_suite_id uuid, p_created_by uuid default null::uuid, p_label text default null::text, p_planned_end_date date default null::date, p_test_case_ids uuid[] default null::uuid[])
returns public.test_iterations
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_suite_status public.suite_status;
  v_number int;
  v_name text;
  v_iteration public.test_iterations;
  v_issues text;
begin
  perform public.assert_can('run_iteration');

  select status into v_suite_status from public.testing_suites where id = p_suite_id for update;
  if v_suite_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_suite_status not in ('ready', 'in_testing', 'signed_off') then
    raise exception 'Cannot start an iteration while the suite is %', v_suite_status;
  end if;
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status = 'in_progress') then
    raise exception 'An iteration is already in progress for this suite';
  end if;

  if p_test_case_ids is not null then
    if cardinality(p_test_case_ids) = 0 then
      raise exception 'Pick at least one test case for this iteration';
    end if;
    if exists (
      select 1 from unnest(p_test_case_ids) x
      where not exists (
        select 1 from public.test_cases tc join public.sections s on s.id = tc.section_id
        where tc.id = x and s.test_suite_id = p_suite_id
      )
    ) then
      raise exception 'Every picked test case must belong to this suite';
    end if;
    select string_agg(coalesce(tc.code, tc.title) || ': ' || i.issue, ', ' order by tc.code)
    into v_issues
    from public.test_cases tc
    cross join lateral public.test_case_issues(tc.id) as i(issue)
    where tc.id = any(p_test_case_ids);
    if v_issues is not null then
      raise exception 'Only complete test cases can be tested: %', v_issues;
    end if;
  end if;

  -- Reopening a signed-off suite revokes (but keeps) its sign-off.
  if v_suite_status = 'signed_off' then
    update public.suite_sign_offs
    set revoked_at = now(), revoked_by = p_created_by
    where testing_suite_id = p_suite_id and revoked_at is null;
  end if;

  select coalesce(max(iteration_number), 0) + 1 into v_number
  from public.test_iterations
  where testing_suite_id = p_suite_id;

  v_name := 'User Acceptance Test ' || lpad(v_number::text, 2, '0');

  insert into public.test_iterations (testing_suite_id, iteration_number, name, slug, label, planned_end_date, created_by)
  values (p_suite_id, v_number, v_name, public.slugify(v_name),
          nullif(btrim(p_label), ''), p_planned_end_date, p_created_by)
  returning * into v_iteration;

  perform public.sync_iteration(v_iteration.id, p_test_case_ids);

  if not exists (select 1 from public.test_case_results where iteration_id = v_iteration.id) then
    raise exception 'No complete test cases to copy into the iteration';
  end if;

  update public.testing_suites set status = 'in_testing' where id = p_suite_id;
  return v_iteration;
end;
$function$;

-- ===== 20260926070627 start_iteration_no_longer_forces_in_testing =====

create or replace function public.start_iteration(
  p_suite_id uuid,
  p_created_by uuid default null,
  p_label text default null,
  p_planned_end_date date default null,
  p_test_case_ids uuid[] default null
)
returns public.test_iterations
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_suite_status public.suite_status;
  v_number int;
  v_name text;
  v_iteration public.test_iterations;
  v_issues text;
begin
  perform public.assert_can('run_iteration');

  select status into v_suite_status from public.testing_suites where id = p_suite_id for update;
  if v_suite_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_suite_status not in ('ready', 'in_testing', 'signed_off') then
    raise exception 'Cannot start an iteration while the suite is %', v_suite_status;
  end if;
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status = 'in_progress') then
    raise exception 'An iteration is already in progress for this suite';
  end if;

  if p_test_case_ids is not null then
    if cardinality(p_test_case_ids) = 0 then
      raise exception 'Pick at least one test case for this iteration';
    end if;
    if exists (
      select 1 from unnest(p_test_case_ids) x
      where not exists (
        select 1 from public.test_cases tc join public.sections s on s.id = tc.section_id
        where tc.id = x and s.test_suite_id = p_suite_id
      )
    ) then
      raise exception 'Every picked test case must belong to this suite';
    end if;
    select string_agg(coalesce(tc.code, tc.title) || ': ' || i.issue, ', ' order by tc.code)
    into v_issues
    from public.test_cases tc
    cross join lateral public.test_case_issues(tc.id) as i(issue)
    where tc.id = any(p_test_case_ids);
    if v_issues is not null then
      raise exception 'Only complete test cases can be tested: %', v_issues;
    end if;
  end if;

  -- Reopening a signed-off suite revokes (but keeps) its sign-off. Planning a
  -- new round against a signed-off suite still invalidates that approval,
  -- even though creating the round no longer forces the suite into testing.
  if v_suite_status = 'signed_off' then
    update public.suite_sign_offs
    set revoked_at = now(), revoked_by = p_created_by
    where testing_suite_id = p_suite_id and revoked_at is null;
  end if;

  select coalesce(max(iteration_number), 0) + 1 into v_number
  from public.test_iterations
  where testing_suite_id = p_suite_id;

  v_name := 'User Acceptance Test ' || lpad(v_number::text, 2, '0');

  insert into public.test_iterations (testing_suite_id, iteration_number, name, slug, label, planned_end_date, created_by)
  values (p_suite_id, v_number, v_name, public.slugify(v_name),
          nullif(btrim(p_label), ''), p_planned_end_date, p_created_by)
  returning * into v_iteration;

  perform public.sync_iteration(v_iteration.id, p_test_case_ids);

  if not exists (select 1 from public.test_case_results where iteration_id = v_iteration.id) then
    raise exception 'No complete test cases to copy into the iteration';
  end if;

  -- Iteration creation is planning, not execution: it no longer forces the
  -- suite's status to in_testing. The suite stays wherever it already was
  -- (e.g. ready stays ready) until a separate execution step starts it.
  return v_iteration;
end;
$function$;

-- ===== 20260926075313 add_update_iteration_details =====

create or replace function public.update_iteration_details(
  p_iteration_id uuid,
  p_label text default null,
  p_planned_end_date date default null
)
returns public.test_iterations
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_iteration public.test_iterations;
begin
  perform public.assert_can('run_iteration');

  update public.test_iterations
  set label = nullif(btrim(p_label), ''),
      planned_end_date = p_planned_end_date
  where id = p_iteration_id
  returning * into v_iteration;

  if v_iteration.id is null then
    raise exception 'Test iteration % not found', p_iteration_id;
  end if;

  return v_iteration;
end;
$function$;

-- ===== 20260926105546 add_included_in_run_to_test_case_results =====
alter table test_case_results
  add column included_in_run boolean not null default true;
