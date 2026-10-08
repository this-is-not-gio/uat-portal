-- Create draft moves the suite to for_sign_off (was: stayed in_testing while drafted).
--   create_sign_off          in_testing | sign_off_rejected -> for_sign_off
--   discard_sign_off_draft   for_sign_off -> in_testing ("Back to Testing")
--   issue_sign_off           for_sign_off -> sign_off_issued
-- for_sign_off locks authoring and blocks new rounds (start_iteration already only allows
-- ready/in_testing/sign_off_issued/signed_off), so the vendor goes Back to Testing first.

-- Suites drafted under 0047 move to the new status.
update public.testing_suites s set status = 'for_sign_off'
where s.status = 'in_testing'
  and exists (select 1 from public.suite_sign_offs so where so.testing_suite_id = s.id and so.status = 'drafting');

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

  -- Also answers a rejection: the new report is drafted in for_sign_off.
  update public.testing_suites set status = 'for_sign_off' where id = p_suite_id;
  return v_sign_off;
end;
$$;

-- Back to Testing: drops the draft and reopens the suite for rounds and authoring.
create or replace function public.discard_sign_off_draft(p_sign_off_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suite_id uuid;
begin
  perform public.assert_can('issue_sign_off');

  delete from public.suite_sign_offs where id = p_sign_off_id and status = 'drafting'
  returning testing_suite_id into v_suite_id;
  if v_suite_id is null then
    raise exception 'This sign-off is no longer a draft';
  end if;

  update public.testing_suites set status = 'in_testing' where id = v_suite_id and status = 'for_sign_off';
end;
$$;

-- Issues the draft on the latest completed round (re-checked here) and freezes its report.
create or replace function public.issue_sign_off(p_sign_off_id uuid, p_by uuid default null, p_note text default null, p_report jsonb default null)
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
  if v_status <> 'for_sign_off' then
    raise exception 'Only a suite for sign-off can be issued (current: %)', v_status;
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

-- Drafting the sign-off locks authoring too.
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
  if v_status in ('for_sign_off', 'sign_off_issued', 'sign_off_rejected', 'signed_off', 'archived') then
    raise exception 'Testing suite is % and can no longer be edited', v_status;
  end if;
  return v_status;
end;
$$;

-- Internal keeps seeing a suite while the vendor drafts its sign-off (the draft itself stays hidden).
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
    when public.current_role_() = 'Internal' then status in ('in_testing', 'for_sign_off', 'sign_off_issued', 'sign_off_rejected', 'signed_off', 'archived')
    when public.current_role_() = 'External' then my_ever_participated
  end
  order by name;
$$;
