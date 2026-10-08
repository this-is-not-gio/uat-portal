-- Sign-off as its own lifecycle (replaces 0026/0040's issue-in-one-step):
--   create_sign_off (vendor)      -> drafting      vendor-only; the suite stays in_testing
--   issue_sign_off (vendor)       -> issued        suite sign_off_issued; the client is asked to sign off
--   acknowledge_sign_off (client) -> acknowledged  suite signed_off
--   reject_sign_off (client)      -> rejected      suite sign_off_rejected, locked until the vendor
--                                                  reopens testing (set_suite_status -> in_testing)
--                                                  or creates a new draft (create_sign_off)
--   withdrawn: an issued or acknowledged sign-off superseded by a newer round (the old revoked_at).
-- Discarding a draft deletes it; planning a round deletes an open draft.

create type public.sign_off_status as enum ('drafting', 'issued', 'acknowledged', 'rejected', 'withdrawn');

alter table public.suite_sign_offs
  add column status public.sign_off_status not null default 'issued',
  add column rejected_at timestamptz,
  add column rejected_by uuid references public.profiles (id),
  add column rejection_reason text;

update public.suite_sign_offs
set status = case
  when revoked_at is not null then 'withdrawn'
  when acknowledged_at is not null then 'acknowledged'
  else 'issued'
end::public.sign_off_status;

alter table public.suite_sign_offs alter column status set default 'drafting';

-- One open sign-off (being drafted or waiting on the client) per suite.
create unique index suite_sign_offs_one_open on public.suite_sign_offs (testing_suite_id) where status in ('drafting', 'issued');

-- Drafts are the vendor's until issued.
drop policy "sign-offs: staff read" on public.suite_sign_offs;
create policy "sign-offs: staff read" on public.suite_sign_offs for select to authenticated
using ((select public.can_see_all_results()) and (status <> 'drafting' or (select public.current_role_()) = 'Admin'));

-- The round a sign-off is based on: the latest completed one, once no round is planned or running.
create or replace function public.sign_off_iteration(p_suite_id uuid)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_iteration_id uuid;
begin
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status in ('not_started', 'in_progress')) then
    raise exception 'Every test iteration must be finished before the sign-off';
  end if;
  select id into v_iteration_id
  from public.test_iterations
  where testing_suite_id = p_suite_id and status = 'completed'
  order by iteration_number desc
  limit 1;
  if v_iteration_id is null then
    raise exception 'At least one completed iteration is required for the sign-off';
  end if;
  return v_iteration_id;
end;
$$;

revoke execute on function public.sign_off_iteration(uuid) from public, anon, authenticated;

create or replace function public.create_sign_off(p_suite_id uuid, p_by uuid default null)
returns public.suite_sign_offs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.suite_status;
  v_sign_off public.suite_sign_offs;
begin
  perform public.assert_can('issue_sign_off');

  select status into v_status from public.testing_suites where id = p_suite_id for update;
  if v_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_status not in ('in_testing', 'sign_off_rejected') then
    raise exception 'A sign-off can only be created while the suite is in testing (current: %)', v_status;
  end if;
  if exists (select 1 from public.suite_sign_offs where testing_suite_id = p_suite_id and status = 'drafting') then
    raise exception 'This suite already has a sign-off being drafted';
  end if;

  insert into public.suite_sign_offs (testing_suite_id, iteration_id, signed_off_by, status)
  values (p_suite_id, public.sign_off_iteration(p_suite_id), p_by, 'drafting')
  returning * into v_sign_off;

  -- A new report answers a rejection: the suite is back in testing while it's drafted.
  update public.testing_suites set status = 'in_testing' where id = p_suite_id and status = 'sign_off_rejected';
  return v_sign_off;
end;
$$;

-- Saves the vendor's work on a draft (note, and the report preview with any observations).
create or replace function public.save_sign_off_draft(p_sign_off_id uuid, p_note text default null, p_report jsonb default null)
returns public.suite_sign_offs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sign_off public.suite_sign_offs;
begin
  perform public.assert_can('issue_sign_off');

  update public.suite_sign_offs
  set note = nullif(btrim(p_note), ''), report = p_report
  where id = p_sign_off_id and status = 'drafting'
  returning * into v_sign_off;
  if v_sign_off.id is null then
    raise exception 'This sign-off is no longer a draft';
  end if;
  return v_sign_off;
end;
$$;

create or replace function public.discard_sign_off_draft(p_sign_off_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can('issue_sign_off');

  delete from public.suite_sign_offs where id = p_sign_off_id and status = 'drafting';
  if not found then
    raise exception 'This sign-off is no longer a draft';
  end if;
end;
$$;

-- Same arguments as 0040's issue_sign_off(p_suite_id, ...), so it has to be dropped, not replaced.
drop function if exists public.issue_sign_off(uuid, uuid, text, jsonb);

-- Issues the draft on the latest completed round (re-checked here) and freezes its report.
create function public.issue_sign_off(p_sign_off_id uuid, p_by uuid default null, p_note text default null, p_report jsonb default null)
returns public.suite_sign_offs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suite_id uuid;
  v_status public.suite_status;
  v_iteration_id uuid;
  v_counts jsonb;
  v_sign_off public.suite_sign_offs;
begin
  perform public.assert_can('issue_sign_off');

  select testing_suite_id into v_suite_id from public.suite_sign_offs where id = p_sign_off_id;
  if v_suite_id is null then
    raise exception 'Sign-off % not found', p_sign_off_id;
  end if;
  select status into v_status from public.testing_suites where id = v_suite_id for update;
  if v_status <> 'in_testing' then
    raise exception 'Only a suite in testing can be issued for sign-off (current: %)', v_status;
  end if;

  v_iteration_id := public.sign_off_iteration(v_suite_id);
  select jsonb_build_object(
           'total', count(*),
           'passed', count(*) filter (where status = 'Passed'),
           'failed', count(*) filter (where status = 'Failed'),
           'blocked', count(*) filter (where status = 'Blocked'),
           'in_progress', count(*) filter (where status = 'In Progress'),
           'untested', count(*) filter (where status = 'Untested')
         )
  into v_counts
  from public.test_case_results where iteration_id = v_iteration_id;

  update public.suite_sign_offs
  set status = 'issued', iteration_id = v_iteration_id, signed_off_by = p_by, signed_off_at = now(),
      note = nullif(btrim(p_note), ''), exceptions = v_counts, report = p_report
  where id = p_sign_off_id and status = 'drafting'
  returning * into v_sign_off;
  if v_sign_off.id is null then
    raise exception 'Only a sign-off being drafted can be issued';
  end if;

  update public.testing_suites set status = 'sign_off_issued' where id = v_suite_id;
  return v_sign_off;
end;
$$;

create or replace function public.acknowledge_sign_off(p_suite_id uuid, p_by uuid default null)
returns public.suite_sign_offs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.suite_status;
  v_sign_off public.suite_sign_offs;
begin
  perform public.assert_can('sign_off');

  select status into v_status from public.testing_suites where id = p_suite_id for update;
  if v_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_status <> 'sign_off_issued' then
    raise exception 'There is no issued sign-off to acknowledge (current: %)', v_status;
  end if;

  update public.suite_sign_offs
  set status = 'acknowledged', acknowledged_at = now(), acknowledged_by = p_by
  where testing_suite_id = p_suite_id and status = 'issued'
  returning * into v_sign_off;
  if v_sign_off.id is null then
    raise exception 'There is no issued sign-off to acknowledge';
  end if;

  update public.testing_suites set status = 'signed_off' where id = p_suite_id;
  return v_sign_off;
end;
$$;

create or replace function public.reject_sign_off(p_suite_id uuid, p_by uuid default null, p_reason text default null)
returns public.suite_sign_offs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.suite_status;
  v_sign_off public.suite_sign_offs;
begin
  perform public.assert_can('sign_off');

  if nullif(btrim(p_reason), '') is null then
    raise exception 'Give a reason for rejecting the sign-off';
  end if;
  select status into v_status from public.testing_suites where id = p_suite_id for update;
  if v_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_status <> 'sign_off_issued' then
    raise exception 'There is no issued sign-off to reject (current: %)', v_status;
  end if;

  update public.suite_sign_offs
  set status = 'rejected', rejected_at = now(), rejected_by = p_by, rejection_reason = btrim(p_reason)
  where testing_suite_id = p_suite_id and status = 'issued'
  returning * into v_sign_off;
  if v_sign_off.id is null then
    raise exception 'There is no issued sign-off to reject';
  end if;

  update public.testing_suites set status = 'sign_off_rejected' where id = p_suite_id;
  return v_sign_off;
end;
$$;

revoke execute on function public.create_sign_off(uuid, uuid) from public, anon;
revoke execute on function public.save_sign_off_draft(uuid, text, jsonb) from public, anon;
revoke execute on function public.discard_sign_off_draft(uuid) from public, anon;
revoke execute on function public.issue_sign_off(uuid, uuid, text, jsonb) from public, anon;
revoke execute on function public.acknowledge_sign_off(uuid, uuid) from public, anon;
revoke execute on function public.reject_sign_off(uuid, uuid, text) from public, anon;
grant execute on function public.create_sign_off(uuid, uuid) to authenticated;
grant execute on function public.save_sign_off_draft(uuid, text, jsonb) to authenticated;
grant execute on function public.discard_sign_off_draft(uuid) to authenticated;
grant execute on function public.issue_sign_off(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.acknowledge_sign_off(uuid, uuid) to authenticated;
grant execute on function public.reject_sign_off(uuid, uuid, text) to authenticated;

-- After a rejection the vendor can reopen testing instead of drafting a new report.
create or replace function public.set_suite_status(p_suite_id uuid, p_status public.suite_status)
returns public.testing_suites
language plpgsql
security definer
set search_path = ''
as $$
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
  elsif v_suite.status = 'sign_off_rejected' and p_status = 'in_testing' then
    perform public.assert_can('issue_sign_off');
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
$$;

-- A rejected suite stays locked until the vendor decides what happens next.
create or replace function public.assert_suite_editable(p_suite_id uuid)
returns public.suite_status
language plpgsql
stable
set search_path = ''
as $$
declare
  v_status public.suite_status;
begin
  select status into v_status from public.testing_suites where id = p_suite_id;
  if v_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_status in ('sign_off_issued', 'sign_off_rejected', 'signed_off', 'archived') then
    raise exception 'Testing suite is % and can no longer be edited', v_status;
  end if;
  return v_status;
end;
$$;

-- Planning a round supersedes the sign-off: an open draft is dropped, an issued or acknowledged
-- one is withdrawn (kept as history). A rejected suite has to be reopened first.
create or replace function public.start_iteration(p_suite_id uuid, p_created_by uuid default null, p_name text default null, p_planned_end_date date default null)
returns public.test_iterations
language plpgsql
security definer
set search_path = ''
as $$
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
  if v_suite_status not in ('ready', 'in_testing', 'sign_off_issued', 'signed_off') then
    raise exception 'Cannot start an iteration while the suite is %', v_suite_status;
  end if;
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status in ('not_started', 'in_progress')) then
    raise exception 'An iteration is already planned or in progress for this suite';
  end if;

  delete from public.suite_sign_offs where testing_suite_id = p_suite_id and status = 'drafting';
  update public.suite_sign_offs
  set status = 'withdrawn', revoked_at = now(), revoked_by = p_created_by
  where testing_suite_id = p_suite_id and status in ('issued', 'acknowledged');

  select coalesce(max(iteration_number), 0) + 1 into v_number
  from public.test_iterations
  where testing_suite_id = p_suite_id;

  insert into public.test_iterations (testing_suite_id, iteration_number, name, slug, planned_end_date, created_by, scope_test_case_ids, status)
  values (p_suite_id, v_number,
          coalesce(nullif(btrim(p_name), ''), 'Untitled_Iteration_' || v_number),
          'iteration-' || lpad(v_number::text, 2, '0'),
          p_planned_end_date, p_created_by, '{}', 'not_started')
  returning * into v_iteration;

  return v_iteration;
end;
$$;

-- Internal also sees a suite whose sign-off it rejected.
create or replace function public.get_sidebar_suites()
returns table(suite_id uuid, name text, slug text, code text, status public.suite_status, open_iteration_number integer, open_iteration_name text, open_iteration_status public.iteration_status, open_planned_end date, my_in_open_round boolean, my_submitted_at timestamptz, my_remaining integer, my_ever_participated boolean)
language sql
stable
set search_path = ''
as $$
  with open_round as (
    select i.id, i.testing_suite_id, i.iteration_number, i.name, i.status, i.planned_end_date
    from public.test_iterations i
    where i.status in ('not_started', 'in_progress')
  ),
  my_open as (
    select p.iteration_id, p.submitted_at
    from public.iteration_participants p
    where p.organization_id = public.current_org_id()
  ),
  my_remaining as (
    select cr.iteration_id, count(*)::int as remaining
    from public.test_case_results cr
    where cr.organization_id = public.current_org_id()
      and cr.status in ('Untested', 'In Progress')
    group by cr.iteration_id
  ),
  base as (
    select
      s.id as suite_id,
      s.name,
      s.slug,
      s.code,
      s.status,
      o.iteration_number as open_iteration_number,
      o.name as open_iteration_name,
      o.status as open_iteration_status,
      o.planned_end_date as open_planned_end,
      (mo.iteration_id is not null) as my_in_open_round,
      mo.submitted_at as my_submitted_at,
      coalesce(mr.remaining, 0) as my_remaining,
      exists (
        select 1
        from public.iteration_participants p
        join public.test_iterations i on i.id = p.iteration_id
        where i.testing_suite_id = s.id
          and p.organization_id = public.current_org_id()
      ) as my_ever_participated
    from public.testing_suites s
    left join open_round o on o.testing_suite_id = s.id
    left join my_open mo on mo.iteration_id = o.id
    left join my_remaining mr on mr.iteration_id = o.id
  )
  select *
  from base
  where case
    when public.current_role_() = 'Admin' then true
    when public.current_role_() = 'Internal' then status in ('in_testing', 'sign_off_issued', 'sign_off_rejected', 'signed_off', 'archived')
    when public.current_role_() = 'External' then my_ever_participated
  end
  order by name;
$$;
