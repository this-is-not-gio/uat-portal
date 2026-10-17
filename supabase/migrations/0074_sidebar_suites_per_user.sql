-- The dashboard's "mine" data (my_in_open_round / my_submitted_at / my_remaining) is now per user.
-- 0058 read it per org: my_submitted_at only appeared once every active tester of the org had
-- submitted, and my_remaining counted every tester's copies in the org. Since 0060 results are
-- per tester (tester_id) and since 0069 submission is per tester, so one tester who submitted
-- still saw the round as "to test" until their teammates did too. my_ever_participated stays
-- org-level: it only decides which suites an External org can see at all.

create or replace function public.get_sidebar_suites()
returns table(suite_id uuid, name text, slug text, code text, status public.suite_status, open_iteration_number integer, open_iteration_name text, open_iteration_status public.iteration_status, open_planned_end date, my_in_open_round boolean, my_submitted_at timestamptz, my_remaining integer, my_ever_participated boolean)
language sql
stable security definer
set search_path = ''
as $$
  with open_round as (
    select i.id, i.testing_suite_id, i.iteration_number, i.name, i.status, i.planned_end_date
    from public.test_iterations i
    where i.status in ('not_started', 'in_progress')
  ),
  my_open as (
    select t.iteration_id, t.submitted_at
    from public.iteration_testers t
    where t.user_id = (select auth.uid()) and t.status = 'active'
  ),
  my_remaining as (
    select cr.iteration_id, count(*)::int as remaining
    from public.test_case_results cr
    where cr.tester_id = (select auth.uid())
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
        from public.iteration_testers t
        join public.test_iterations i on i.id = t.iteration_id
        where i.testing_suite_id = s.id
          and t.organization_id = public.current_org_id()
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
