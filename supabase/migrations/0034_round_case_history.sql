-- Planning flags for a round that hasn't started: for each case in it, how it did in its latest
-- completed round (stopped rounds and unticked rows don't count, same as 0021/0033).
--   last_result     Failed | Blocked | Untested (skipped) | Passed, rolled up across orgs like 0021;
--                   null = never in a counted round ("Not tested yet")
--   changed_since   live case edited since that round's snapshot
create or replace function public.get_round_case_history(p_iteration_id uuid)
returns table (test_case_id uuid, last_round_name text, last_result text, changed_since boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with it as (
    select id, testing_suite_id from public.test_iterations where id = p_iteration_id
  ),
  me as (
    select public.can_see_all_results() as sees_all, public.current_org_id() as org_id
  ),
  cases as (
    select distinct cr.test_case_id
    from public.test_case_results cr
    where cr.iteration_id = p_iteration_id and cr.test_case_id is not null
  ),
  prev as (
    select cr.test_case_id, cr.status::text as res, cr.source_hash, i.name as round_name,
           dense_rank() over (
             partition by cr.test_case_id
             order by i.completed_at desc nulls last, i.iteration_number desc
           ) as rnk
    from public.test_case_results cr
    join public.test_iterations i on i.id = cr.iteration_id
    join it on it.testing_suite_id = i.testing_suite_id
    cross join me
    where i.id <> p_iteration_id
      and i.status = 'completed'
      and cr.included_in_run
      and cr.test_case_id in (select c.test_case_id from cases c)
      and (me.sees_all or cr.organization_id = me.org_id)
  )
  select
    c.test_case_id,
    min(p.round_name),
    case
      when count(p.test_case_id) = 0 then null
      when bool_or(p.res = 'Failed') then 'Failed'
      when bool_or(p.res = 'Blocked') then 'Blocked'
      when bool_and(p.res in ('Untested', 'In Progress')) then 'Untested'
      else 'Passed'
    end,
    coalesce(bool_or(p.source_hash is distinct from public.test_case_content_hash(c.test_case_id)), false)
  from cases c
  left join prev p on p.test_case_id = c.test_case_id and p.rnk = 1
  group by c.test_case_id
$$;

revoke execute on function public.get_round_case_history(uuid) from anon, public;
grant execute on function public.get_round_case_history(uuid) to authenticated;
