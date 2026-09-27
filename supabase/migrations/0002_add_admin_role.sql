-- RBAC Phase 2: vendor staff get their own role.
-- Separate migration: a new enum value can't be used in the transaction that adds it.
alter type public.user_role add value if not exists 'Admin';
