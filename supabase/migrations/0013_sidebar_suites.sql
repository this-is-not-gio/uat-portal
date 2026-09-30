-- Sidebar: the suites the current user may open, with the live round and "my org" progress.
-- The role filter lives here, not in the component: sidebar props are serialized into every
-- page's HTML, so a suite hidden only in JSX would still leak.
-- security invoker: the caller's RLS (0012) still applies underneath this filter.

create or replace function public.get_sidebar_suites()
returns table (
  suite_id uuid,
  name text,
  slug text,
  code text,
  status public.suite_status,
  open_iteration_number int,
  open_iteration_name text,
  open_iteration_status public.iteration_status,
  open_planned_end date,
  my_in_open_round boolean,
  my_submitted_at timestamptz,
  my_remaining int,
  my_ever_participated boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  with open_round as (
    -- At most one open round per suite (unique index from 0009).
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
    when public.current_role_() = 'Internal' then status in ('in_testing', 'signed_off', 'archived')
    when public.current_role_() = 'External' then my_ever_participated
  end -- TODO(you) #1: the role filter (Admin: all / Internal: in_testing, signed_off, archived / External: my_ever_participated)
  order by name;
$$;

revoke execute on function public.get_sidebar_suites() from public, anon;
grant execute on function public.get_sidebar_suites() to authenticated;
