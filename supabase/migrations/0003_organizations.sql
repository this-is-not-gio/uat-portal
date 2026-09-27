-- RBAC Phase 2: every user belongs to an organization.
create type public.org_type as enum ('vendor', 'client', 'external');

create table public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    type public.org_type not null,
    created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- Nullable: a dashboard-created user with no metadata must still get a profile.
alter table public.profiles
    add column organization_id uuid references public.organizations(id) on delete restrict;
create index profiles_organization_id_idx on public.profiles(organization_id);

-- Own org for everyone; vendor/client staff see all orgs. Phase 4 revisits this with the helper fns.
create policy "users read their own org; staff read all" on public.organizations
    for select to authenticated
    using (
        id = (select organization_id from public.profiles where id = (select auth.uid()))
        or exists (
            select 1 from public.profiles
            where id = (select auth.uid()) and role in ('Admin', 'Internal')
        )
    );

-- The old update policy let a user change their own role/org; only the display name is self-editable.
revoke update on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

insert into public.organizations (name, type) values
    ('Dev Team', 'vendor'),
    ('IC Licensing Team', 'client'),
    ('Company A', 'external'),
    ('Company B', 'external');

-- Dev test accounts (see memory note project_rbac_progress).
update public.profiles p set
    role = v.role::public.user_role,
    organization_id = (select id from public.organizations where name = v.org)
from auth.users u
join (values
    ('gio.talingdan@whitecloak.com',   'Admin',    'Dev Team'),
    ('gio.talingdan+1@whitecloak.com', 'Internal', 'IC Licensing Team'),
    ('gio.talingdan+2@whitecloak.com', 'External', 'Company A'),
    ('gio.talingdan+3@whitecloak.com', 'External', 'Company B')
) as v(email, role, org) on v.email = u.email
where p.id = u.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, full_name, role, organization_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'External'),
    (new.raw_user_meta_data->>'organization_id')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
