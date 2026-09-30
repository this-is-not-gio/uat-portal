-- Internal orgs submit their results too (replaces D4: the client's "done" was only Complete round).
-- 1. assert_can: 'submit' allows Internal as well as External. submit/withdraw_participation and
--    0014's lock already work per org, so nothing else in them changes.
-- 2. complete_iteration: an Internal caller whose org takes part in the round must have submitted
--    first. Admin can still complete regardless.

create or replace function public.assert_can(p_action text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role public.user_role := public.current_role_();
  v_allowed boolean;
begin
  case p_action
    when 'author' then v_allowed := v_role = 'Admin';
    when 'archive' then v_allowed := v_role = 'Admin';
    when 'sync' then v_allowed := v_role = 'Admin'; -- its my own judgment and dont change it
    when 'run_iteration' then v_allowed := v_role in ('Admin', 'Internal');
    when 'sign_off' then v_allowed := v_role = 'Internal';
    when 'submit' then v_allowed := v_role in ('Internal', 'External');
    else v_allowed := false;
  end case;
  if not coalesce(v_allowed, false) then
    raise exception 'forbidden: %', p_action using errcode = '42501';
  end if;
end;
$$;

create or replace function public.complete_iteration(p_iteration_id uuid)
returns public.test_iterations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iteration public.test_iterations;
begin
  perform public.assert_can('run_iteration');

  if public.current_role_() = 'Internal' and exists (
    select 1
    from public.iteration_participants
    where iteration_id = p_iteration_id
      and organization_id = public.current_org_id()
      and submitted_at is null
  ) then
    raise exception 'Submit your organization''s results before completing the round';
  end if;

  update public.test_iterations
  set status = 'completed', completed_at = now()
  where id = p_iteration_id and status = 'in_progress'
  returning * into v_iteration;

  if v_iteration.id is null then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;
  return v_iteration;
end;
$$;
