-- Storage cleanup (#21, spec #15). B2 must never keep files the app no longer references, with
-- no cron: every attachments row delete (direct, or a cascade from a remark / step result /
-- round reset / force refresh) queues its object key; a best-effort flush then removes the
-- objects from the bucket and dequeues them. A failed bucket delete leaves the key queued.

create table public.storage_deletions (
  object_key text primary key,
  queued_at timestamptz not null default now()
);

-- No policies and no grants: only the security-definer functions below touch it.
alter table public.storage_deletions enable row level security;
revoke all on public.storage_deletions from authenticated, anon;

create or replace function public.queue_attachment_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.storage_deletions (object_key) values (old.object_key) on conflict do nothing;
  return old;
end;
$$;

create trigger attachments_queue_deletion
after delete on public.attachments
for each row execute function public.queue_attachment_deletion();

-- Oldest first, so a backlog drains in order. Any signed-in user may flush: keys are opaque ids.
create or replace function public.pending_storage_deletions(p_limit int default 100)
returns setof text
language sql
security definer
set search_path = ''
as $$
  select d.object_key
  from public.storage_deletions d
  where (select auth.uid()) is not null
  order by d.queued_at
  limit greatest(least(p_limit, 500), 1);
$$;

-- Dequeues only keys the bucket delete reported done, and never one an attachment row still uses.
create or replace function public.complete_storage_deletions(p_keys text[])
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.storage_deletions d
  where (select auth.uid()) is not null
    and d.object_key = any (p_keys)
    and not exists (select 1 from public.attachments a where a.object_key = d.object_key);
$$;

-- The caller's own drafts (never linked to a remark) left for over an hour. Returns how many.
create or replace function public.clear_stale_drafts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_count int;
begin
  if v_uid is null then
    raise exception 'forbidden: sign in first' using errcode = '42501';
  end if;
  delete from public.attachments
  where uploaded_by = v_uid and remark_id is null and created_at < now() - interval '1 hour';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Admin backstop: everyone's stale drafts.
create or replace function public.clear_all_stale_drafts()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not (select public.is_admin()) then
    raise exception 'forbidden: admin only' using errcode = '42501';
  end if;
  delete from public.attachments
  where remark_id is null and created_at < now() - interval '1 hour';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.queue_attachment_deletion() from public, anon, authenticated;
revoke all on function public.pending_storage_deletions(int) from public, anon;
revoke all on function public.complete_storage_deletions(text[]) from public, anon;
revoke all on function public.clear_stale_drafts() from public, anon;
revoke all on function public.clear_all_stale_drafts() from public, anon;
grant execute on function public.pending_storage_deletions(int) to authenticated;
grant execute on function public.complete_storage_deletions(text[]) to authenticated;
grant execute on function public.clear_stale_drafts() to authenticated;
grant execute on function public.clear_all_stale_drafts() to authenticated;

-- Archive snapshot (from 0058) now also records each remark's attachment names and sizes, since
-- the files go with the reset.
create or replace function public.force_refresh_case_result_one(p_case_result_id uuid, p_by uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_iteration_id uuid;
  v_snapshot jsonb;
begin
  select cr.iteration_id,
         jsonb_build_object(
           'code', cr.code, 'title', cr.title, 'section_name', cr.section_name,
           'priority', cr.priority, 'test_role_id', cr.test_role_id,
           'role_assignee', (select t.name from public.test_roles t where t.id = cr.test_role_id),
           'tester_id', cr.tester_id,
           'preconditions', cr.preconditions, 'status', cr.status,
           'status_overridden', cr.status_overridden, 'executed_by', cr.executed_by,
           'completed_at', cr.completed_at, 'source_hash', cr.source_hash,
           'steps', coalesce((
             select jsonb_agg(jsonb_build_object(
               'step', sr.step, 'order_index', sr.order_index, 'status', sr.status,
               'expected_results', sr.expected_results,
               'remarks', coalesce((
                 select jsonb_agg(jsonb_build_object(
                   'remark', r.remark, 'created_by', r.created_by, 'created_at', r.created_at,
                   'attachments', coalesce((
                     select jsonb_agg(jsonb_build_object('file_name', a.file_name, 'size_bytes', a.size_bytes) order by a.created_at)
                     from public.attachments a where a.remark_id = r.id and a.status = 'ready'
                   ), '[]'::jsonb)
                 ) order by r.created_at)
                 from public.test_remarks r where r.test_step_result_id = sr.id
               ), '[]'::jsonb)
             ) order by sr.order_index)
             from public.test_step_results sr where sr.test_case_result_id = cr.id
           ), '[]'::jsonb)
         )
  into v_iteration_id, v_snapshot
  from public.test_case_results cr
  join public.test_iterations i on i.id = cr.iteration_id
  where cr.id = p_case_result_id and i.status = 'in_progress';

  if v_iteration_id is null then
    raise exception 'Case result % is not in an in-progress iteration', p_case_result_id;
  end if;

  if public.case_result_has_results(p_case_result_id) then
    insert into public.test_case_result_archives (test_case_result_id, iteration_id, archived_by, reason, snapshot)
    values (p_case_result_id, v_iteration_id, p_by, btrim(p_reason), v_snapshot);
  end if;

  perform public.refresh_case_result_internal(p_case_result_id);

  update public.test_case_results
  set sync_kind = 'force_reset', synced_at = now(), synced_by = p_by
  where id = p_case_result_id;
end;
$$;
revoke execute on function public.force_refresh_case_result_one(uuid, uuid, text) from public, anon, authenticated;
