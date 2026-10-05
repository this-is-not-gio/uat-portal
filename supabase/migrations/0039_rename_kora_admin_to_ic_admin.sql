-- Rename the "Kora-Admin" role to "IC Admin". Renaming the enum value updates
-- every row that uses it (test_cases and the test_case_results snapshots).
--
-- test_case_content_hash() includes the role text, so the rename changes the
-- hash of every IC Admin case. Snapshots that were in sync before the rename
-- get their source_hash recomputed, so sync doesn't report them as changed.
-- Snapshots in completed rounds are locked by guard_completed_iteration and
-- keep their old hash.

create temp table _in_sync_kora_snapshots as
  select cr.id, cr.test_case_id
  from public.test_case_results cr
  join public.test_cases tc on tc.id = cr.test_case_id
  join public.test_iterations ti on ti.id = cr.iteration_id
  where tc.role_assignee = 'Kora-Admin'
    and ti.status <> 'completed'
    and cr.source_hash = public.test_case_content_hash(cr.test_case_id);

alter type public.role_assignee_type rename value 'Kora-Admin' to 'IC Admin';

update public.test_case_results cr
  set source_hash = public.test_case_content_hash(s.test_case_id)
  from _in_sync_kora_snapshots s
  where cr.id = s.id;

drop table _in_sync_kora_snapshots;
