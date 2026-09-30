-- Admin authoring view: one Status + flags + rolled-up Result per live test case
-- (spec: ~/.claude/plans/admin-authoring-status-result.md).
-- security definer so it can read every org's rows; the org filter mirrors get_iteration_changes:
-- Admin/Internal see all orgs, anyone else only their own org and the cases their org can see.
-- A suite has at most one open round (0009), so In testing and For Testing never overlap.

create or replace function public.get_suite_case_states(p_suite_id uuid)
returns table (
  test_case_id uuid,
  status text,            -- in_testing | for_testing | not_ready | tested | ready
  flags text[],           -- highest priority first, see flag_rank below
  result text,            -- Passed | Failed | Blocked | In progress | Untested | null (never executed)
  result_round_name text, -- round the result comes from
  open_round_name text,   -- running/planned round, for the "New · not in UAT 0X" flag
  per_org jsonb           -- [{organizationId, organizationName, result, hasResults, changed}] for the result round
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select public.can_see_all_results() as sees_all,
           public.current_org_id() as org_id,
           (select o.type from public.organizations o where o.id = public.current_org_id()) as org_type
  ),
  open_round as (
    select i.id, i.name, i.status, i.started_at
    from public.test_iterations i
    where i.testing_suite_id = p_suite_id and i.status in ('not_started', 'in_progress')
  ),
  live as (
    select tc.id, tc.created_at,
           public.test_case_content_hash(tc.id) as hash,
           exists (select 1 from public.test_case_issues(tc.id)) as incomplete
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    cross join me
    where s.test_suite_id = p_suite_id
      and (me.sees_all or public.org_sees_audience(me.org_type, tc.audience))
  ),
  snap as (
    -- included_in_run = false means "not in that round", so those rows are dropped here.
    select cr.test_case_id, cr.organization_id, o.name as org_name, cr.status::text as res,
           cr.source_hash, i.id as iteration_id, i.name as round_name, i.status as round_status,
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
    join public.organizations o on o.id = cr.organization_id
    cross join me
    where i.testing_suite_id = p_suite_id
      and cr.included_in_run
      and i.status in ('not_started', 'in_progress', 'completed') -- stopped rounds don't count
      and (me.sees_all or cr.organization_id = me.org_id)
  ),
  last_completed as (
    -- The case's latest completed round (every org row in it).
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
      l.created_at,
      bool_or(s.round_status = 'in_progress') filter (where s.round_status is not null) as in_running,
      bool_or(s.round_status = 'not_started') filter (where s.round_status is not null) as in_planned,
      bool_or(s.round_status = 'completed') filter (where s.round_status is not null) as in_completed,
      -- open round: edited since snapshot, split by whether that org already recorded anything
      bool_or(s.round_status in ('in_progress', 'not_started') and s.source_hash is distinct from l.hash and not s.has_results) as open_update_pending,
      bool_or(s.round_status = 'in_progress' and s.source_hash is distinct from l.hash and s.has_results) as open_changed_after
    from live l
    left join snap s on s.test_case_id = l.id
    group by l.id, l.incomplete, l.hash, l.created_at
  ),
  classified as (
    select pc.*,
      case
        when coalesce(pc.in_running, false) then 'in_testing'
        when coalesce(pc.in_planned, false) then 'for_testing'
        when pc.incomplete then 'not_ready'
        when coalesce(pc.in_completed, false) then 'tested'
        else 'ready'
      end as status
    from per_case pc
  ),
  flagged as (
    select c.id, c.status,
      array_remove(array[
        case when c.status in ('in_testing', 'for_testing') and c.incomplete then 'incomplete' end,
        case when c.status = 'in_testing' and coalesce(c.open_changed_after, false) then 'changed_after_testing' end,
        case when c.status in ('in_testing', 'for_testing') and coalesce(c.open_update_pending, false) then 'update_pending' end,
        case when c.status = 'tested' and not exists (
          select 1 from last_completed lc where lc.test_case_id = c.id and lc.res not in ('Untested', 'In Progress')
        ) then 'skipped' end,
        case when c.status = 'tested' and exists (
          select 1 from last_completed lc where lc.test_case_id = c.id and lc.source_hash is distinct from c.hash
        ) then 'changed_since' end,
        case when c.status in ('ready', 'not_ready') and exists (
          select 1 from open_round r where r.status = 'in_progress' and c.created_at > r.started_at
        ) then 'new' end
      ], null) as flags
    from classified c
  ),
  result_rows as (
    -- Running round if the case is in it, otherwise its latest completed round.
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
  results as (
    select rr.test_case_id,
      min(rr.round_name) as round_name,
      bool_or(rr.round_status = 'in_progress') as running,
      bool_or(rr.res = 'Failed') as any_failed,
      bool_or(rr.res = 'Blocked') as any_blocked,
      bool_or(rr.res in ('Untested', 'In Progress')) as any_untested,
      bool_and(rr.res in ('Untested', 'In Progress')) as all_untested,
      jsonb_agg(jsonb_build_object(
        'organizationId', rr.organization_id,
        'organizationName', rr.org_name,
        'result', rr.res,
        'hasResults', rr.has_results,
        'changed', rr.source_hash is distinct from (select l.hash from live l where l.id = rr.test_case_id)
      ) order by rr.org_name) as per_org
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
      else 'Passed' -- completed round: orgs that skipped it don't drag the result down (hover shows them)
    end,
    r.round_name,
    (select o.name from open_round o limit 1),
    coalesce(r.per_org, '[]'::jsonb)
  from flagged f
  left join results r on r.test_case_id = f.id
$$;

revoke execute on function public.get_suite_case_states(uuid) from anon, public;
grant execute on function public.get_suite_case_states(uuid) to authenticated;
