-- RBAC Phase 3.2: organizations take part in an iteration, and each gets its own result rows.
-- One round, one set of test_case_results per participating org, each filtered by the case's
-- audience (org_sees_audience). Mid-round rules are unchanged, just per row: tested rows are
-- never wiped by sync, "changed" still compares source_hash, force refresh still archives.

-- Participants ----------------------------------------------------------------

-- submitted_at is set when an org hands in its results (Phase 6).
create table public.iteration_participants (
  iteration_id uuid not null references public.test_iterations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  submitted_at timestamptz,
  primary key (iteration_id, organization_id)
);
create index iteration_participants_organization_id_idx on public.iteration_participants (organization_id);

alter table public.iteration_participants enable row level security;
-- Writes only go through the security-definer RPCs below. Phase 4 narrows reads.
create policy "participants are readable by any authenticated user"
  on public.iteration_participants for select to authenticated using (true);

-- The round's picked cases (null = the whole suite), so an org added mid-round gets the same scope.
alter table public.test_iterations add column scope_test_case_ids uuid[];

-- Per-org result rows ---------------------------------------------------------

alter table public.test_case_results add column organization_id uuid;

-- Everything so far was tested by the client's staff.
do $$
declare
  v_client_id uuid;
begin
  select id into v_client_id from public.organizations where type = 'client' order by created_at limit 1;
  if v_client_id is null and exists (select 1 from public.test_iterations) then
    raise exception 'No client organization to assign existing iterations to';
  end if;

  insert into public.iteration_participants (iteration_id, organization_id)
  select id, v_client_id from public.test_iterations;

  update public.test_case_results set organization_id = v_client_id;
end $$;

-- Existing rounds keep exactly the cases they have.
update public.test_iterations i
set scope_test_case_ids = (
  select coalesce(array_agg(distinct cr.test_case_id), '{}')
  from public.test_case_results cr
  where cr.iteration_id = i.id and cr.test_case_id is not null
);

alter table public.test_case_results
  alter column organization_id set not null,
  -- A result row can only exist for an org that takes part in its round.
  add constraint test_case_results_participant_fkey
    foreign key (iteration_id, organization_id)
    references public.iteration_participants (iteration_id, organization_id) on delete cascade,
  drop constraint test_case_results_iteration_id_test_case_id_key,
  add constraint test_case_results_iteration_case_org_key unique (iteration_id, test_case_id, organization_id);
create index test_case_results_organization_id_idx on public.test_case_results (organization_id);

-- Audience filter ---------------------------------------------------------------

-- Whether an org of this type tests cases of this audience.
-- Placeholder: every org gets every case. 0007_audience_filter.sql replaces the body.
create or replace function public.org_sees_audience(p_org_type public.org_type, p_audience public.audience)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select true;
$$;

-- Copying cases into a round ----------------------------------------------------

-- Copies the suite's complete cases into the round for each participant (or just p_org_ids),
-- skipping cases the org's audience excludes and rows that already exist. Returns the new
-- test_case_results ids.
drop function public.sync_iteration(uuid, uuid[]);
create function public.sync_iteration(p_iteration_id uuid, p_test_case_ids uuid[] default null, p_org_ids uuid[] default null)
 returns setof uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
begin
  select testing_suite_id into v_suite_id
  from public.test_iterations
  where id = p_iteration_id and status = 'in_progress';

  if v_suite_id is null then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;

  return query
  with new_cases as (
    insert into public.test_case_results
      (iteration_id, organization_id, test_case_id, code, title, section_name, section_slug, section_order, order_index, role_assignee, priority, preconditions, source_hash)
    select p_iteration_id, p.organization_id, tc.id, tc.code, tc.title, s.name, s.slug, s.order_index, tc.order_index, tc.role_assignee, tc.priority,
      public.case_preconditions_json(tc.id), public.test_case_content_hash(tc.id)
    from public.iteration_participants p
    join public.organizations o on o.id = p.organization_id
    cross join public.test_cases tc
    join public.sections s on s.id = tc.section_id
    where p.iteration_id = p_iteration_id
      and (p_org_ids is null or p.organization_id = any(p_org_ids))
      and s.test_suite_id = v_suite_id
      and (p_test_case_ids is null or tc.id = any(p_test_case_ids))
      and public.org_sees_audience(o.type, tc.audience)
      and not exists (select 1 from public.test_case_issues(tc.id))
    on conflict (iteration_id, test_case_id, organization_id) do nothing
    returning id, test_case_id
  ),
  new_steps as (
    insert into public.test_step_results (test_case_result_id, test_step_id, order_index, step, expected_results)
    select nc.id, ts.id, ts.order_index, ts.step, public.step_expected_results_json(ts.id)
    from new_cases nc
    join public.test_steps ts on ts.test_case_id = nc.test_case_id
  )
  select nc.id from new_cases nc;
end;
$function$;

-- p_org_ids: the participating orgs; null = every client org (the old single-org behaviour).
drop function public.start_iteration(uuid, uuid, text, date, uuid[]);
create function public.start_iteration(p_suite_id uuid, p_created_by uuid default null, p_label text default null, p_planned_end_date date default null, p_test_case_ids uuid[] default null, p_org_ids uuid[] default null)
 returns public.test_iterations
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_status public.suite_status;
  v_number int;
  v_name text;
  v_iteration public.test_iterations;
  v_issues text;
  v_org_ids uuid[];
  v_empty_orgs text;
begin
  perform public.assert_can('run_iteration');

  select status into v_suite_status from public.testing_suites where id = p_suite_id for update;
  if v_suite_status is null then
    raise exception 'Testing suite % not found', p_suite_id;
  end if;
  if v_suite_status not in ('ready', 'in_testing', 'signed_off') then
    raise exception 'Cannot start an iteration while the suite is %', v_suite_status;
  end if;
  if exists (select 1 from public.test_iterations where testing_suite_id = p_suite_id and status = 'in_progress') then
    raise exception 'An iteration is already in progress for this suite';
  end if;

  if p_test_case_ids is not null then
    if cardinality(p_test_case_ids) = 0 then
      raise exception 'Pick at least one test case for this iteration';
    end if;
    if exists (
      select 1 from unnest(p_test_case_ids) x
      where not exists (
        select 1 from public.test_cases tc join public.sections s on s.id = tc.section_id
        where tc.id = x and s.test_suite_id = p_suite_id
      )
    ) then
      raise exception 'Every picked test case must belong to this suite';
    end if;
    select string_agg(coalesce(tc.code, tc.title) || ': ' || i.issue, ', ' order by tc.code)
    into v_issues
    from public.test_cases tc
    cross join lateral public.test_case_issues(tc.id) as i(issue)
    where tc.id = any(p_test_case_ids);
    if v_issues is not null then
      raise exception 'Only complete test cases can be tested: %', v_issues;
    end if;
  end if;

  if p_org_ids is null then
    select array_agg(id) into v_org_ids from public.organizations where type = 'client';
  else
    select array_agg(distinct x) into v_org_ids from unnest(p_org_ids) x;
  end if;
  if coalesce(cardinality(v_org_ids), 0) = 0 then
    raise exception 'Pick at least one participating organization';
  end if;
  if exists (select 1 from unnest(v_org_ids) x where not exists (select 1 from public.organizations where id = x)) then
    raise exception 'Every participating organization must exist';
  end if;

  -- Reopening a signed-off suite revokes (but keeps) its sign-off. Planning a
  -- new round against a signed-off suite still invalidates that approval,
  -- even though creating the round no longer forces the suite into testing.
  if v_suite_status = 'signed_off' then
    update public.suite_sign_offs
    set revoked_at = now(), revoked_by = p_created_by
    where testing_suite_id = p_suite_id and revoked_at is null;
  end if;

  select coalesce(max(iteration_number), 0) + 1 into v_number
  from public.test_iterations
  where testing_suite_id = p_suite_id;

  v_name := 'User Acceptance Test ' || lpad(v_number::text, 2, '0');

  insert into public.test_iterations (testing_suite_id, iteration_number, name, slug, label, planned_end_date, created_by, scope_test_case_ids)
  values (p_suite_id, v_number, v_name, public.slugify(v_name),
          nullif(btrim(p_label), ''), p_planned_end_date, p_created_by, p_test_case_ids)
  returning * into v_iteration;

  insert into public.iteration_participants (iteration_id, organization_id)
  select v_iteration.id, x from unnest(v_org_ids) x;

  perform public.sync_iteration(v_iteration.id, p_test_case_ids);

  if not exists (select 1 from public.test_case_results where iteration_id = v_iteration.id) then
    raise exception 'No complete test cases to copy into the iteration';
  end if;

  -- An org whose audience matches none of the picked cases would have nothing to test.
  select string_agg(o.name, ', ' order by o.name) into v_empty_orgs
  from public.iteration_participants p
  join public.organizations o on o.id = p.organization_id
  where p.iteration_id = v_iteration.id
    and not exists (select 1 from public.test_case_results cr where cr.iteration_id = v_iteration.id and cr.organization_id = p.organization_id);
  if v_empty_orgs is not null then
    raise exception 'No picked test cases are meant for: %', v_empty_orgs;
  end if;

  -- Iteration creation is planning, not execution: it no longer forces the
  -- suite's status to in_testing. The suite stays wherever it already was
  -- (e.g. ready stays ready) until a separate execution step starts it.
  return v_iteration;
end;
$function$;

-- Brings another org into a running round with the same scope as everyone else: the picked
-- cases (or the whole suite as it was at start), plus anything synced in since. Returns how
-- many result rows it created.
create function public.add_iteration_participant(p_iteration_id uuid, p_org_id uuid)
 returns integer
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_suite_id uuid;
  v_started_at timestamptz;
  v_scope uuid[];
  v_case_ids uuid[];
  v_count integer;
begin
  perform public.assert_can('run_iteration');

  select testing_suite_id, started_at, scope_test_case_ids into v_suite_id, v_started_at, v_scope
  from public.test_iterations
  where id = p_iteration_id and status = 'in_progress'
  for update;
  if v_suite_id is null then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;
  if not exists (select 1 from public.organizations where id = p_org_id) then
    raise exception 'Organization % not found', p_org_id;
  end if;

  insert into public.iteration_participants (iteration_id, organization_id)
  values (p_iteration_id, p_org_id)
  on conflict do nothing;
  if not found then
    raise exception 'This organization is already taking part in the iteration';
  end if;

  select coalesce(array_agg(tc.id), '{}') into v_case_ids
  from public.test_cases tc
  join public.sections s on s.id = tc.section_id
  where s.test_suite_id = v_suite_id
    and (
      (v_scope is null and tc.created_at <= v_started_at)
      or tc.id = any(coalesce(v_scope, '{}'))
      or exists (select 1 from public.test_case_results cr where cr.iteration_id = p_iteration_id and cr.test_case_id = tc.id)
    );

  select count(*) into v_count from public.sync_iteration(p_iteration_id, v_case_ids, array[p_org_id]);
  return v_count;
end;
$function$;

-- Mid-round sync ------------------------------------------------------------------

-- One row per (case, org). added: a participant is missing a case its audience includes that
-- is new since the round started or already in the round for another org (e.g. its audience
-- widened). changed: edited since copied. removed: gone from the suite, or its audience no
-- longer includes that org.
drop function public.get_iteration_changes(uuid);
create function public.get_iteration_changes(p_iteration_id uuid)
 returns table(change text, test_case_id uuid, test_case_result_id uuid, code text, title text, has_results boolean, organization_id uuid, organization_name text)
 language sql
 stable security definer
 set search_path to ''
as $function$
  with it as (
    select id, testing_suite_id, started_at from public.test_iterations where id = p_iteration_id
  ),
  parts as (
    select p.organization_id, o.name, o.type
    from public.iteration_participants p join public.organizations o on o.id = p.organization_id
    where p.iteration_id = p_iteration_id
  ),
  live as (
    select tc.id, tc.code, tc.title, tc.created_at, tc.audience
    from public.test_cases tc
    join public.sections s on s.id = tc.section_id
    join it on it.testing_suite_id = s.test_suite_id
  ),
  snap as (
    select cr.*,
      (cr.status <> 'Untested' or exists (
        select 1 from public.test_step_results sr
        where sr.test_case_result_id = cr.id
          and (sr.status <> 'Untested' or exists (select 1 from public.test_remarks r where r.test_step_result_id = sr.id))
      )) as has_results
    from public.test_case_results cr join it on it.id = cr.iteration_id
  )
  select 'added', l.id, null::uuid, l.code, l.title, false, parts.organization_id, parts.name
  from live l cross join parts cross join it
  where public.org_sees_audience(parts.type, l.audience)
    and not exists (select 1 from snap where snap.test_case_id = l.id and snap.organization_id = parts.organization_id)
    and (l.created_at > it.started_at or exists (select 1 from snap where snap.test_case_id = l.id))
    and not exists (select 1 from public.test_case_issues(l.id))
  union all
  select 'changed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results, parts.organization_id, parts.name
  from snap
  join parts on parts.organization_id = snap.organization_id
  join live l on l.id = snap.test_case_id
  where public.org_sees_audience(parts.type, l.audience)
    and snap.source_hash is distinct from public.test_case_content_hash(snap.test_case_id)
  union all
  select 'removed', snap.test_case_id, snap.id, snap.code, snap.title, snap.has_results, parts.organization_id, parts.name
  from snap
  join parts on parts.organization_id = snap.organization_id
  left join live l on l.id = snap.test_case_id
  where l.id is null or not public.org_sees_audience(parts.type, l.audience)
$function$;

-- p_add is test case ids: each is copied in for every participant that's missing it and whose
-- audience includes it.
create or replace function public.apply_iteration_sync(p_iteration_id uuid, p_by uuid default null, p_add uuid[] default '{}'::uuid[], p_refresh uuid[] default '{}'::uuid[], p_remove uuid[] default '{}'::uuid[])
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_new_ids uuid[];
  v_id uuid;
begin
  perform public.assert_can('sync');

  if not exists (select 1 from public.test_iterations where id = p_iteration_id and status = 'in_progress') then
    raise exception 'Iteration % is not in progress', p_iteration_id;
  end if;

  -- Collect the new ids first: an UPDATE in the same statement wouldn't see rows the function inserts.
  if cardinality(coalesce(p_add, '{}')) > 0 then
    select coalesce(array_agg(x), '{}') into v_new_ids from public.sync_iteration(p_iteration_id, p_add) x;
    update public.test_case_results
    set sync_kind = 'added', synced_at = now(), synced_by = p_by
    where id = any(v_new_ids);
  end if;

  foreach v_id in array coalesce(p_refresh, '{}') loop
    if not exists (select 1 from public.test_case_results where id = v_id and iteration_id = p_iteration_id) then
      raise exception 'Case result % does not belong to this iteration', v_id;
    end if;
    perform public.refresh_case_result(v_id); -- rejects rows with results
    update public.test_case_results
    set sync_kind = 'updated', synced_at = now(), synced_by = p_by
    where id = v_id;
  end loop;

  foreach v_id in array coalesce(p_remove, '{}') loop
    if not exists (select 1 from public.test_case_results where id = v_id and iteration_id = p_iteration_id) then
      raise exception 'Case result % does not belong to this iteration', v_id;
    end if;
    perform public.remove_case_result(v_id); -- rejects rows with results
  end loop;
end;
$function$;

-- Grants --------------------------------------------------------------------------
-- The new/recreated functions aren't callable by anon (the rest wait for Phase 4).
-- sync_iteration is internal: only the RPCs above call it.
revoke execute on function public.sync_iteration(uuid, uuid[], uuid[]) from public, anon, authenticated;
revoke execute on function public.start_iteration(uuid, uuid, text, date, uuid[], uuid[]) from public, anon;
revoke execute on function public.add_iteration_participant(uuid, uuid) from public, anon;
revoke execute on function public.get_iteration_changes(uuid) from public, anon;
revoke execute on function public.org_sees_audience(public.org_type, public.audience) from public, anon;
grant execute on function public.start_iteration(uuid, uuid, text, date, uuid[], uuid[]) to authenticated;
grant execute on function public.add_iteration_participant(uuid, uuid) to authenticated;
grant execute on function public.get_iteration_changes(uuid) to authenticated;
grant execute on function public.org_sees_audience(public.org_type, public.audience) to authenticated;
