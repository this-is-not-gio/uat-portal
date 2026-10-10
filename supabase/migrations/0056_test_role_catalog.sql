-- Test roles become one global catalog (spec #2, ticket #4). "Approver" is defined once in
-- test_roles; an org that has it gets an organization_roles row pointing at it (its
-- instance), and the instance's display name is the catalog name. Profiles keep pointing at
-- their org's instance (composite FK from 0051), so a user still holds at most one role
-- from their own org.

create table public.test_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> '' and public.norm_role_name(name) is not null),
  created_at timestamptz not null default now()
);

-- "Action-Officer", "action officer" and "ACTION OFFICER" are the same role.
create unique index test_roles_norm_name_key on public.test_roles (public.norm_role_name(name));

alter table public.test_roles enable row level security;

-- Role names aren't sensitive; every signed-in user can read the catalog. Only Admin writes.
create policy "test roles: read" on public.test_roles
  for select to authenticated using (true);
create policy "test roles: admin insert" on public.test_roles
  for insert to authenticated with check ((select public.is_admin()));
create policy "test roles: admin update" on public.test_roles
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "test roles: admin delete" on public.test_roles
  for delete to authenticated using ((select public.is_admin()));

revoke all on public.test_roles from anon;
grant select, insert, update, delete on public.test_roles to authenticated;

-- Data: the existing org role names become the starting catalog (the earliest spelling of
-- each normalized name wins), and every org role is mapped onto its catalog entry.
insert into public.test_roles (name)
select distinct on (public.norm_role_name(name)) btrim(name)
from public.organization_roles
where public.norm_role_name(name) is not null
order by public.norm_role_name(name), created_at;

alter table public.organization_roles
  add column test_role_id uuid references public.test_roles(id) on delete cascade;

update public.organization_roles r
set test_role_id = t.id
from public.test_roles t
where public.norm_role_name(t.name) = public.norm_role_name(r.name);

-- Two spellings of one role in the same org collapse into the older instance; its holders move over.
with ranked as (
  select id, first_value(id) over (partition by organization_id, test_role_id order by created_at, id) as keep
  from public.organization_roles
)
update public.profiles p
set org_role_id = r.keep
from ranked r
where p.org_role_id = r.id and r.id <> r.keep;

with ranked as (
  select id, first_value(id) over (partition by organization_id, test_role_id order by created_at, id) as keep
  from public.organization_roles
)
delete from public.organization_roles o
using ranked r
where o.id = r.id and r.id <> r.keep;

do $$
begin
  if exists (select 1 from public.organization_roles where test_role_id is null) then
    raise exception 'An org role has no catalog match';
  end if;
end $$;

alter table public.organization_roles alter column test_role_id set not null;
alter table public.organization_roles
  add constraint organization_roles_org_test_role_key unique (organization_id, test_role_id);
create index organization_roles_test_role_id_idx on public.organization_roles (test_role_id);

drop index public.organization_roles_org_name_key;
alter table public.organization_roles drop column name;

-- Name matching (until cases reference the catalog, #6) now reads the catalog name.
create or replace function public.participant_tests_case(p_iteration_id uuid, p_org_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.organizations o where o.id = p_org_id and o.type = 'vendor')
    or exists (
      select 1
      from public.iteration_participant_roles pr
      join public.organization_roles r on r.id = pr.role_id
      join public.test_roles t on t.id = r.test_role_id
      where pr.iteration_id = p_iteration_id and pr.organization_id = p_org_id
        and public.norm_role_name(t.name) = public.norm_role_name(p_role)
    );
$$;

create or replace function public.org_has_case_role(p_org_id uuid, p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_roles r
    join public.test_roles t on t.id = r.test_role_id
    where r.organization_id = p_org_id
      and public.norm_role_name(t.name) = public.norm_role_name(p_role)
  );
$$;

-- Creates a catalog role and its instances in the given orgs, in one go.
create or replace function public.create_test_role(p_name text, p_org_ids uuid[] default '{}')
returns public.test_roles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.test_roles;
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin' using errcode = '42501';
  end if;

  insert into public.test_roles (name) values (btrim(p_name)) returning * into v_role;
  perform public.set_test_role_orgs(v_role.id, p_org_ids);
  return v_role;
exception when unique_violation then
  raise exception '"%" is already in the role catalog', btrim(p_name) using errcode = '23505';
end;
$$;

-- Ticks exactly these orgs for a catalog role: missing instances are created, unticked ones
-- are removed (their holders keep their org but lose the role, 0051's FK sets it null).
create or replace function public.set_test_role_orgs(p_test_role_id uuid, p_org_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin' using errcode = '42501';
  end if;
  if not exists (select 1 from public.test_roles where id = p_test_role_id) then
    raise exception 'Test role % not found', p_test_role_id;
  end if;
  if exists (
    select 1 from unnest(coalesce(p_org_ids, '{}')) as x(id)
    left join public.organizations o on o.id = x.id
    where o.id is null or o.type = 'vendor'
  ) then
    raise exception 'Test roles can only be given to Internal or External organizations' using errcode = 'P0001';
  end if;

  delete from public.organization_roles
  where test_role_id = p_test_role_id and not (organization_id = any(coalesce(p_org_ids, '{}')));

  insert into public.organization_roles (organization_id, test_role_id)
  select x.id, p_test_role_id from unnest(coalesce(p_org_ids, '{}')) as x(id)
  on conflict (organization_id, test_role_id) do nothing;
end;
$$;

revoke execute on function public.create_test_role(text, uuid[]) from public, anon;
revoke execute on function public.set_test_role_orgs(uuid, uuid[]) from public, anon;
grant execute on function public.create_test_role(text, uuid[]) to authenticated;
grant execute on function public.set_test_role_orgs(uuid, uuid[]) to authenticated;
