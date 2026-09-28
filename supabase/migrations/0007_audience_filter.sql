-- RBAC Phase 3.2 (pair spot): which orgs test which cases.
-- Replaces 0006's pass-through placeholder. sync_iteration, add_iteration_participant and
-- get_iteration_changes all call this, so this one rule decides who gets which result rows.

create or replace function public.org_sees_audience(p_org_type public.org_type, p_audience public.audience)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- vendor tests everything; 'both' goes to every org; otherwise the org type must match the audience.
  select case
    when p_org_type = 'vendor' then true
    when p_audience = 'both' then true
    when p_org_type = 'client' and p_audience = 'internal' then true
    when p_org_type = 'client' and p_audience = 'external' then false
    when p_org_type = 'external' and p_audience = 'external' then true
    when p_org_type = 'external' and p_audience = 'internal' then false
  end;
$$;
