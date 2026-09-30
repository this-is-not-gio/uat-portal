-- Admin ticks/unticks which cases a round runs (included_in_run). Before this the app updated
-- test_case_results directly, but RLS only allows updating your own org's rows, so an Admin's
-- change to a client/external org's row silently matched 0 rows.
-- Rules: Admin only (same as sync), and only while the round is planned (not_started): once it
-- starts, which cases it runs is fixed (content edits still reach it through Sync). The
-- "has results" guard is a backstop in case results ever exist on a planned round; it matches
-- get_suite_case_states (0021).

create or replace function public.set_case_inclusion(p_case_result_ids uuid[], p_included boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocked text;
begin
  perform public.assert_can('sync');

  if exists (
    select 1 from public.test_case_results cr
    join public.test_iterations i on i.id = cr.iteration_id
    where cr.id = any(p_case_result_ids) and i.status <> 'not_started'
  ) then
    raise exception 'This round has already started, so the test cases it runs are locked.' using errcode = 'P0001';
  end if;

  if not p_included then
    select string_agg(distinct coalesce(cr.code, cr.title), ', ') into v_blocked
    from public.test_case_results cr
    where cr.id = any(p_case_result_ids)
      and cr.included_in_run
      and (cr.status <> 'Untested' or exists (
        select 1 from public.test_step_results sr
        where sr.test_case_result_id = cr.id
          and (sr.status <> 'Untested' or exists (select 1 from public.test_remarks r where r.test_step_result_id = sr.id))
      ));
    if v_blocked is not null then
      raise exception 'Already has results, so it can''t be removed from this round: %. Use Force refresh or wait for the next round.', v_blocked
        using errcode = 'P0001';
    end if;
  end if;

  update public.test_case_results
  set included_in_run = p_included
  where id = any(p_case_result_ids);
end;
$$;

revoke execute on function public.set_case_inclusion(uuid[], boolean) from anon, public;
grant execute on function public.set_case_inclusion(uuid[], boolean) to authenticated;
