-- Test roles inside an organization (org type -> org -> role), e.g.
--   Internal -> IC Licensing Division -> Action-Officer
-- Admin manages them on /admin/organizations. A user holds at most one, from their own org.
-- A role's name is matched against test_cases.role_assignee to pre-filter the tester's
-- Test Cases tab; it doesn't restrict what they can execute.

create table public.organization_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (btrim(name) <> ''),
  created_at timestamptz not null default now(),
  -- Target of the composite FK below, so a profile's role must belong to its org.
  unique (id, organization_id)
);

create unique index organization_roles_org_name_key
  on public.organization_roles (organization_id, lower(btrim(name)));

alter table public.profiles add column org_role_id uuid;
alter table public.profiles
  add constraint profiles_org_role_fkey
  foreign key (org_role_id, organization_id)
  references public.organization_roles (id, organization_id)
  on delete set null (org_role_id);

create index profiles_org_role_id_idx on public.profiles (org_role_id);

-- RLS: same visibility as organizations; only Admin writes.
alter table public.organization_roles enable row level security;

create policy "org roles: own, vendor, or staff" on public.organization_roles
  for select to authenticated
  using (
    organization_id = (select public.current_org_id())
    or organization_id in (select o.id from public.organizations o where o.type = 'vendor')
    or (select public.can_see_all_results())
  );

create policy "org roles: admin insert" on public.organization_roles
  for insert to authenticated with check ((select public.is_admin()));
create policy "org roles: admin update" on public.organization_roles
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "org roles: admin delete" on public.organization_roles
  for delete to authenticated using ((select public.is_admin()));

revoke all on public.organization_roles from anon;
grant select, insert, update, delete on public.organization_roles to authenticated;

-- Seed every client (Internal) org with the internal Role Assignee values.
insert into public.organization_roles (organization_id, name)
select o.id, r.name
from public.organizations o
cross join (values
  ('IC Admin'), ('Kora-Workflow'), ('Action-Officer'), ('Supervisor'),
  ('Division-Manager'), ('Deputy-Commissioner'), ('Insurance Commissioner')
) as r(name)
where o.type = 'client'
on conflict do nothing;
