-- An iteration has one user-facing name now (0027 made it settable). Existing labels become
-- the name; a label repeated within a suite keeps the round number so the names stay distinct.
-- The label column stays (nulled) so selects/types don't break; nothing writes it anymore.
-- Slugs are untouched: routing uses iteration_number, and renaming never regenerates them.

with labelled as (
  select id, iteration_number, btrim(label) as label,
         count(*) over (partition by testing_suite_id, btrim(label)) as dupes
  from public.test_iterations
  where nullif(btrim(label), '') is not null
)
update public.test_iterations i
set name = case when l.dupes > 1 then l.label || ' ' || lpad(l.iteration_number::text, 2, '0') else l.label end,
    label = null
from labelled l
where i.id = l.id;

update public.test_iterations set label = null where label is not null;

-- Edit Iteration now renames the round; a blank name falls back like start_iteration does.
drop function public.update_iteration_details(uuid, text, date);

create function public.update_iteration_details(p_iteration_id uuid, p_name text default null, p_planned_end_date date default null)
returns public.test_iterations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iteration public.test_iterations;
begin
  perform public.assert_can('run_iteration');

  update public.test_iterations
  set name = coalesce(nullif(btrim(p_name), ''), 'Untitled_Iteration_' || iteration_number),
      planned_end_date = p_planned_end_date
  where id = p_iteration_id
  returning * into v_iteration;

  if v_iteration.id is null then
    raise exception 'Test iteration % not found', p_iteration_id;
  end if;

  return v_iteration;
end;
$$;

revoke execute on function public.update_iteration_details(uuid, text, date) from public, anon;
grant execute on function public.update_iteration_details(uuid, text, date) to authenticated;
