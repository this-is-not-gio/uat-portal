-- RBAC Phase 4 (part 1): close the holes that don't depend on the permission matrix.
--   1. anon executes nothing; internal helpers and trigger functions aren't callable over the API.
--   2. anon has no table privileges; nobody gets TRUNCATE/REFERENCES/TRIGGER (TRUNCATE skips RLS).
--   3. handle_new_user stops trusting user_metadata: anyone calling auth.signUp controls it,
--      so `{ role: 'Admin' }` there made them an Admin. Role/org now come from app_metadata,
--      which only the service role can set. No app_metadata = External with no org (sees nothing).

-- 1. Functions ------------------------------------------------------------------

revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;

-- Only called from inside other security definer functions or as triggers.
revoke execute on function
  public.refresh_case_result(uuid),
  public.remove_case_result(uuid),
  public.refresh_case_result_internal(uuid),
  public.delete_test_case_rows(uuid),
  public.apply_derived_case_status(uuid),
  public.derive_case_result_status(),
  public.guard_completed_iteration(),
  public.handle_new_user(),
  public.set_updated_at(),
  public.test_cases_before_insert()
from authenticated;

alter default privileges for role postgres in schema public revoke execute on functions from anon, public;

-- 2. Tables ---------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;

-- 3. Sign-up ------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role, organization_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_app_meta_data->>'role')::public.user_role, 'External'),
    (new.raw_app_meta_data->>'organization_id')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
