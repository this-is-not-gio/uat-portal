-- Strict roll-up of per-tester copies (#10). A case in a round is run by several testers, each on
-- their own copy (test_case_results with a tester_id). The case's verdict comes from its copies:
--   any copy Failed                  -> Failed
--   else any copy Blocked            -> Blocked   (kept from the existing result vocabulary)
--   else every copy Passed           -> Passed
--   else every copy Untested         -> Untested  (nobody has started)
--   else                             -> In Progress (some copies still to finish)
-- rollup_case_status is the one place the rule lives. get_iteration_case_verdicts applies it per
-- (round, case) and per (round, case, organization) for the Test Results tab, round progress and the
-- sign-off report. get_suite_case_states.per_org now has one entry per organization (its testers'
-- copies rolled up) instead of one per copy.

create function public.rollup_case_status(p_statuses public.test_case_status[])
returns public.test_case_status
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(cardinality(p_statuses), 0) = 0 then null
    when 'Failed'::public.test_case_status = any(p_statuses) then 'Failed'
    when 'Blocked'::public.test_case_status = any(p_statuses) then 'Blocked'
    when 'Passed'::public.test_case_status = all(p_statuses) then 'Passed'
    when 'Untested'::public.test_case_status = all(p_statuses) then 'Untested'
    else 'In Progress'
  end::public.test_case_status
$$;

-- One row per case of the round across every copy the caller can see (organization_id null), plus one
-- per case and organization. Only copies that run (included_in_run); a planned round has none.
-- case_key matches get_iteration_changes: the case id, or code + title once the case was deleted.
-- Runs as the caller, so RLS decides which copies count (an org sees its own).
create function public.get_iteration_case_verdicts(p_iteration_id uuid)
returns table(case_key text, test_case_id uuid, organization_id uuid, verdict public.test_case_status,
              copies integer, passed integer, failed integer, blocked integer, in_progress integer, untested integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with copies as (
    select coalesce(cr.test_case_id::text, 'gone:' || coalesce(cr.code, '') || ':' || cr.title) as case_key,
           cr.test_case_id, cr.organization_id, cr.status
    from public.test_case_results cr
    where cr.iteration_id = p_iteration_id and cr.tester_id is not null and cr.included_in_run
  )
  select c.case_key,
         (array_agg(c.test_case_id))[1],
         c.organization_id,
         public.rollup_case_status(array_agg(c.status)),
         count(*)::int,
         (count(*) filter (where c.status = 'Passed'))::int,
         (count(*) filter (where c.status = 'Failed'))::int,
         (count(*) filter (where c.status = 'Blocked'))::int,
         (count(*) filter (where c.status = 'In Progress'))::int,
         (count(*) filter (where c.status = 'Untested'))::int
  from copies c
  group by grouping sets ((c.case_key), (c.case_key, c.organization_id))
$$;

create or replace function public.get_suite_case_states(p_suite_id uuid)
returns table(test_case_id uuid, status text, flags text[], result text, result_round_name text, open_round_name text, per_org jsonb)
language sql
stable security definer
set search_path = ''
as $$
  with me as (
    select public.can_see_all_results() as sees_all,
           public.current_org_id() as org_id
  ),
  open_round as (
    select i.id, i.name, i.status, i.started_at
    from public.test_iterations i
    where i.testing_suite_id = p_suite_id and i.status in ('not_started', 'in_progress')
  ),
  live as (
    select tc.id, tc.created_at, tc.section_id, s.slug as section_slug,
           public.test_case_content_hash(tc.id) as hash,
           exists (select 1 from public.test_case_issues(tc.id)) as incomplete
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    cross join me
    where s.test_suite_id = p_suite_id
      and (me.sees_all or public.org_has_case_role(me.org_id, tc.test_role_id))
  ),
  snap as (
    select cr.test_case_id, cr.organization_id, o.name as org_name, cr.status::text as res,
           cr.source_hash, cr.section_slug, i.id as iteration_id, i.name as round_name, i.status as round_status,
           row_number() over (
             partition by cr.test_case_id
             order by i.completed_at desc nulls last, i.iteration_number desc
           ) as completed_rank,
           (cr.status <> 'Untested' or exists (
             select 1 from public.test_step_results sr
             where sr.test_case_result_id = cr.id
               and (sr.status <> 'Untested' or exists (select 1 from public.test_remarks r where r.test_step_result_id = sr.id))
           )) as has_results
    from public.test_case_results cr
    join public.test_iterations i on i.id = cr.iteration_id
    left join public.organizations o on o.id = cr.organization_id
    cross join me
    where i.testing_suite_id = p_suite_id
      and cr.included_in_run
      and i.status in ('not_started', 'in_progress', 'completed')
      and (me.sees_all or cr.organization_id = me.org_id)
  ),
  tested_sections as (
    select distinct l.section_id
    from live l
    where exists (select 1 from snap s where s.section_slug = l.section_slug)
       or exists (select 1 from snap s join live l2 on l2.id = s.test_case_id where l2.section_id = l.section_id)
  ),
  last_completed as (
    select s.*
    from snap s
    where s.round_status = 'completed'
      and s.iteration_id = (
        select s2.iteration_id from snap s2
        where s2.test_case_id = s.test_case_id and s2.round_status = 'completed'
        order by s2.completed_rank limit 1
      )
  ),
  per_case as (
    select
      l.id,
      l.incomplete,
      l.hash,
      l.section_id,
      count(s.test_case_id) > 0 as in_any,
      bool_or(s.round_status = 'in_progress') filter (where s.round_status is not null) as in_running,
      bool_or(s.round_status = 'not_started') filter (where s.round_status is not null) as in_planned,
      bool_or(s.round_status = 'completed') filter (where s.round_status is not null) as in_completed,
      bool_or(s.round_status in ('in_progress', 'not_started') and s.source_hash is distinct from l.hash and not s.has_results) as open_update_pending,
      bool_or(s.round_status = 'in_progress' and s.source_hash is distinct from l.hash and s.has_results) as open_changed_after
    from live l
    left join snap s on s.test_case_id = l.id
    group by l.id, l.incomplete, l.hash, l.section_id
  ),
  with_last as (
    select pc.*,
      exists (
        select 1 from last_completed lc where lc.test_case_id = pc.id and lc.res not in ('Untested', 'In Progress')
      ) as last_tested
    from per_case pc
  ),
  classified as (
    select wl.*,
      case
        when coalesce(wl.in_running, false) then 'in_testing'
        when coalesce(wl.in_planned, false) then 'for_testing'
        when wl.incomplete then 'not_ready'
        when coalesce(wl.in_completed, false) and wl.last_tested then 'tested'
        else 'ready'
      end as status
    from with_last wl
  ),
  flagged as (
    select c.id, c.status,
      array_remove(array[
        case when c.status in ('in_testing', 'for_testing') and c.incomplete then 'incomplete' end,
        case when c.status = 'in_testing' and coalesce(c.open_changed_after, false) then 'changed_after_testing' end,
        case when c.status in ('in_testing', 'for_testing') and coalesce(c.open_update_pending, false) then 'update_pending' end,
        case when c.status = 'ready' and coalesce(c.in_completed, false) and not c.last_tested then 'skipped' end,
        case when c.status in ('tested', 'ready') and coalesce(c.in_completed, false) and exists (
          select 1 from last_completed lc where lc.test_case_id = c.id and lc.source_hash is distinct from c.hash
        ) then 'changed_since' end,
        case when not c.in_any and exists (select 1 from tested_sections ts where ts.section_id = c.section_id)
          then 'not_tested' end
      ], null) as flags
    from classified c
  ),
  result_rows as (
    select s.*
    from flagged f
    join snap s on s.test_case_id = f.id and s.round_status = 'in_progress'
    where f.status = 'in_testing'
    union all
    select lc.*
    from flagged f
    join last_completed lc on lc.test_case_id = f.id
    where f.status <> 'in_testing'
  ),
  org_rows as (
    -- One entry per organization: its testers' copies of the case rolled up (0059).
    select rr.test_case_id, rr.organization_id, min(rr.org_name) as org_name,
      public.rollup_case_status(array_agg(rr.res::public.test_case_status)) as res,
      bool_or(rr.has_results) as has_results,
      bool_or(rr.source_hash is distinct from (select l.hash from live l where l.id = rr.test_case_id)) as changed
    from result_rows rr
    group by rr.test_case_id, rr.organization_id
  ),
  results as (
    select rr.test_case_id,
      min(rr.round_name) as round_name,
      bool_or(rr.round_status = 'in_progress') as running,
      bool_or(rr.res = 'Failed') as any_failed,
      bool_or(rr.res = 'Blocked') as any_blocked,
      bool_or(rr.res in ('Untested', 'In Progress')) as any_untested,
      bool_and(rr.res in ('Untested', 'In Progress')) as all_untested,
      (select jsonb_agg(jsonb_build_object(
        'organizationId', o.organization_id,
        'organizationName', o.org_name,
        'result', o.res,
        'hasResults', o.has_results,
        'changed', o.changed
      ) order by o.org_name) from org_rows o where o.test_case_id = rr.test_case_id) as per_org
    from result_rows rr
    group by rr.test_case_id
  )
  select
    f.id,
    f.status,
    f.flags,
    case
      when r.test_case_id is null then null
      when r.any_failed then 'Failed'
      when r.any_blocked then 'Blocked'
      when r.running and r.any_untested then 'In progress'
      when r.all_untested then 'Untested'
      else 'Passed'
    end,
    r.round_name,
    (select o.name from open_round o limit 1),
    coalesce(r.per_org, '[]'::jsonb)
  from flagged f
  left join results r on r.test_case_id = f.id
$$;
