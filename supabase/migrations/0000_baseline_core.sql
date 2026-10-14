-- Baseline schema (part 1 of 2): dev migration history before repo 0001, replayed in order.
-- Source: supabase_migrations.schema_migrations on dev
-- (initial_schema_from_prod .. add_included_in_run_to_test_case_results).
-- The three temp_allow_anon_* entries are omitted; 0001 drops any TEMP policies that remain.

-- ===== 20260918055724 initial_schema_from_prod =====

-- enums
create type public.user_role as enum ('internal','client');
create type public.test_case_lifecycle as enum ('new','updated');
create type public.priority_level as enum ('low','medium','high');
create type public.role_assignee_type as enum ('Kora-Admin','Kora-Workflow','Action-Officer','Supervisor','Division-Manager','Deputy-Commissioner','Insurance Commissioner','Company Admin');
create type public.test_case_lane as enum ('backlog','pass','fail');
create type public.execution_status as enum ('not_run','passed','skipped','failed');
create type public.test_step_status as enum ('pass','fail','skipped','blocked');

-- tables
create table public.profiles (
  id uuid primary key references auth.users(id),
  full_name text not null default '',
  role user_role not null default 'client',
  created_at timestamptz not null default now()
);

create table public.epics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  slug text not null unique,
  code text unique
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  epic_id uuid not null references public.epics(id),
  name text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table public.test_cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  lifecycle_status test_case_lifecycle not null default 'new',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text unique,
  description text not null default '',
  priority priority_level not null default 'medium',
  role_assignee role_assignee_type,
  lane test_case_lane not null default 'backlog',
  order_index int not null default 0,
  section_id uuid not null references public.sections(id)
);

create table public.test_steps (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid not null references public.test_cases(id),
  step text not null,
  order_index int not null default 0,
  status test_step_status,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expected_results (
  id uuid primary key default gen_random_uuid(),
  test_step_id uuid not null references public.test_steps(id),
  result text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table public.preconditions (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid not null references public.test_cases(id),
  condition text not null,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table public.test_executions (
  id uuid primary key default gen_random_uuid(),
  test_case_id uuid not null references public.test_cases(id),
  cycle_label text not null default 'Cycle 1',
  status execution_status not null default 'not_run',
  defect_remarks text not null default '',
  executed_by uuid references public.profiles(id),
  executed_at timestamptz not null default now()
);

create table public.test_remarks (
  id uuid primary key default gen_random_uuid(),
  test_step_id uuid not null references public.test_steps(id),
  remark text not null,
  order_index int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- rls
alter table public.profiles enable row level security;
alter table public.epics enable row level security;
alter table public.sections enable row level security;
alter table public.test_cases enable row level security;
alter table public.test_steps enable row level security;
alter table public.expected_results enable row level security;
alter table public.preconditions enable row level security;
alter table public.test_executions enable row level security;
alter table public.test_remarks enable row level security;

-- functions
create or replace function public.is_internal()
returns boolean
language sql stable security definer set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'internal'
  );
$function$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'client')
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql set search_path to 'public'
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create or replace function public.generate_test_case_code(p_epic_id uuid)
returns text
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_prefix text;
  v_next int;
begin
  select coalesce(code, upper(regexp_replace(slug, '[^a-zA-Z0-9]+', '-', 'g')))
    into v_prefix
    from public.epics
    where id = p_epic_id;

  if v_prefix is null then
    raise exception 'Epic % not found', p_epic_id;
  end if;

  select coalesce(max(substring(tc.code from '(\d+)$')::int), 0) + 1
    into v_next
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    where s.epic_id = p_epic_id
      and tc.code ~ ('^' || v_prefix || '-\d+$');

  return v_prefix || '-' || lpad(v_next::text, 3, '0');
end;
$function$;

create or replace function public.test_cases_before_insert()
returns trigger
language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_epic_id uuid;
begin
  if new.code is null then
    select epic_id into v_epic_id from public.sections where id = new.section_id;
    new.code := public.generate_test_case_code(v_epic_id);
  end if;
  return new;
end;
$function$;

-- triggers
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger trg_test_cases_before_insert before insert on public.test_cases
  for each row execute function public.test_cases_before_insert();

create trigger trg_test_cases_updated_at before update on public.test_cases
  for each row execute function public.set_updated_at();

create trigger trg_test_steps_updated_at before update on public.test_steps
  for each row execute function public.set_updated_at();

-- policies
create policy "epics are readable by any authenticated user" on public.epics for select using (true);
create policy "only internal users manage epics" on public.epics for all using (is_internal()) with check (is_internal());

create policy "expected results are readable by any authenticated user" on public.expected_results for select using (true);
create policy "only internal users manage expected results" on public.expected_results for all using (is_internal()) with check (is_internal());

create policy "preconditions are readable by any authenticated user" on public.preconditions for select using (true);
create policy "only internal users manage preconditions" on public.preconditions for all using (is_internal()) with check (is_internal());

create policy "profiles are readable by any authenticated user" on public.profiles for select using (auth.role() = 'authenticated');
create policy "users can update their own display name" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "sections are readable by any authenticated user" on public.sections for select using (true);
create policy "only internal users manage sections" on public.sections for all using (is_internal()) with check (is_internal());

create policy "test cases are readable by any authenticated user" on public.test_cases for select using (true);
create policy "only internal users manage test cases" on public.test_cases for all using (is_internal()) with check (is_internal());

create policy "executions are readable by any authenticated user" on public.test_executions for select using (true);
create policy "any authenticated user can record an execution" on public.test_executions for insert with check (auth.role() = 'authenticated');
create policy "only the executor or internal can amend an execution" on public.test_executions for update using (executed_by = auth.uid() or is_internal()) with check (executed_by = auth.uid() or is_internal());

create policy "remarks are readable by any authenticated user" on public.test_remarks for select using (true);
create policy "any authenticated user can add a remark" on public.test_remarks for insert with check (auth.role() = 'authenticated');
create policy "only the author or internal can amend a remark" on public.test_remarks for update using (created_by = auth.uid() or is_internal()) with check (created_by = auth.uid() or is_internal());
create policy "only internal users delete remarks" on public.test_remarks for delete using (is_internal());

create policy "test steps are readable by any authenticated user" on public.test_steps for select using (true);
create policy "only internal users manage test steps" on public.test_steps for all using (is_internal()) with check (is_internal());
create policy "any authenticated user can record step status" on public.test_steps for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ===== 20260918120018 rename_epics_to_testing_suites =====
alter table public.epics rename to testing_suites;

-- Drift fix: dev renamed sections.epic_id to test_suite_id outside the recorded history.
alter table public.sections rename column epic_id to test_suite_id;

create or replace function public.generate_test_case_code(p_epic_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_prefix text;
  v_next int;
begin
  select coalesce(code, upper(regexp_replace(slug, '[^a-zA-Z0-9]+', '-', 'g')))
    into v_prefix
    from public.testing_suites
    where id = p_epic_id;

  if v_prefix is null then
    raise exception 'Epic % not found', p_epic_id;
  end if;

  select coalesce(max(substring(tc.code from '(\d+)$')::int), 0) + 1
    into v_next
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    where s.epic_id = p_epic_id
      and tc.code ~ ('^' || v_prefix || '-\d+$');

  return v_prefix || '-' || lpad(v_next::text, 3, '0');
end;
$function$;

-- ===== 20260919104054 add_updated_at_to_sections =====
alter table public.sections
  add column updated_at timestamptz not null default now();

update public.sections set updated_at = created_at;

-- ===== 20260919104145 add_updated_at_trigger_to_sections =====
create trigger trg_sections_updated_at
before update on public.sections
for each row
execute function set_updated_at();

-- ===== 20260919112905 fix_epic_id_refs_in_test_case_code_functions =====
CREATE OR REPLACE FUNCTION public.generate_test_case_code(p_epic_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_prefix text;
  v_next int;
begin
  select coalesce(code, upper(regexp_replace(slug, '[^a-zA-Z0-9]+', '-', 'g')))
    into v_prefix
    from public.testing_suites
    where id = p_epic_id;

  if v_prefix is null then
    raise exception 'Epic % not found', p_epic_id;
  end if;

  select coalesce(max(substring(tc.code from '(\d+)$')::int), 0) + 1
    into v_next
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    where s.test_suite_id = p_epic_id
      and tc.code ~ ('^' || v_prefix || '-\d+$');

  return v_prefix || '-' || lpad(v_next::text, 3, '0');
end;
$function$;

CREATE OR REPLACE FUNCTION public.test_cases_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_epic_id uuid;
begin
  if new.code is null then
    select test_suite_id into v_epic_id from public.sections where id = new.section_id;
    new.code := public.generate_test_case_code(v_epic_id);
  end if;
  return new;
end;
$function$;

-- ===== 20260919163053 rename_lane_to_status =====
ALTER TYPE public.test_case_lane RENAME VALUE 'backlog' TO 'Untested';
ALTER TYPE public.test_case_lane RENAME VALUE 'pass' TO 'Passed';
ALTER TYPE public.test_case_lane RENAME VALUE 'fail' TO 'Failed';
ALTER TYPE public.test_case_lane RENAME TO test_case_status;
ALTER TABLE public.test_cases RENAME COLUMN lane TO status;

-- ===== 20260919170213 add_in_progress_to_test_case_status =====
ALTER TYPE public.test_case_status ADD VALUE 'In Progress' AFTER 'Untested';

-- ===== 20260919173313 update_test_step_status_enum =====
ALTER TYPE public.test_step_status RENAME VALUE 'pass' TO 'Passed';
ALTER TYPE public.test_step_status RENAME VALUE 'fail' TO 'Failed';
ALTER TYPE public.test_step_status RENAME VALUE 'skipped' TO 'Skipped';
ALTER TYPE public.test_step_status RENAME VALUE 'blocked' TO 'Blocked';
ALTER TYPE public.test_step_status ADD VALUE 'Untested' BEFORE 'Passed';
