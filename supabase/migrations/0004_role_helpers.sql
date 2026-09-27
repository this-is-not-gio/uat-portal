-- RBAC Phase 2: who-am-I helpers for RLS and assert_can (Phase 4 rewrites the policies to use them).
-- All are `stable security definer` with an empty search_path: they read profiles without tripping
-- its RLS, so every name must be schema-qualified.

create or replace function public.current_role_()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

-- Null when logged out or not yet assigned to an org.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select organization_id from public.profiles where id = (select auth.uid());
$$;

-- Vendor staff only; coalesce so logged-out callers get false, not null.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role_() = 'Admin', false);
$$;

-- Redefined to mean client staff only. Admins no longer pass is_internal(); Phase 4 policies use
-- is_admin() / can_see_all_results() where vendor staff should also be let through.
create or replace function public.is_internal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_role_() = 'Internal', false);
$$;

-- Admin and Internal see every org's results; External sees only its own (enforced in Phase 4).
create or replace function public.can_see_all_results()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() or public.is_internal();
$$;
