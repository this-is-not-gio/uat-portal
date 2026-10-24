-- Case-level remarks: overall feedback on a test case result, beside the per-step remarks.
-- A remark hangs off either a step result or a case result (or, for pre-iteration history, a template
-- step). Attachments follow the same split. Case remarks use the same rules as step remarks:
-- readable wherever the case result is, postable while the round is started, files go through the
-- same draft -> ready -> linked-on-post flow.

alter table public.test_remarks
  add column test_case_result_id uuid references public.test_case_results (id) on delete cascade;
create index test_remarks_case_result_idx on public.test_remarks (test_case_result_id) where test_case_result_id is not null;
alter table public.test_remarks
  add constraint test_remarks_one_result_parent check (test_case_result_id is null or test_step_result_id is null);

alter table public.attachments
  alter column test_step_result_id drop not null,
  add column test_case_result_id uuid references public.test_case_results (id) on delete cascade;
create index attachments_case_result_idx on public.attachments (test_case_result_id) where test_case_result_id is not null;
alter table public.attachments
  add constraint attachments_one_result_parent check ((test_step_result_id is null) <> (test_case_result_id is null));

-- Read: a case remark is visible with its case result (the lookup runs under that table's own RLS).
drop policy "remarks: read with step result" on public.test_remarks;
create policy "remarks: read with result" on public.test_remarks for select to authenticated
  using (
    (test_step_result_id is not null
      and exists (select 1 from public.test_step_results sr where sr.id = test_remarks.test_step_result_id))
    or (test_case_result_id is not null
      and exists (select 1 from public.test_case_results cr where cr.id = test_remarks.test_case_result_id))
    or (test_step_result_id is null and test_case_result_id is null and (select public.can_see_all_results()))
  );

drop policy "remarks: add on any visible step" on public.test_remarks;
create policy "remarks: add on any visible result" on public.test_remarks for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      exists (select 1 from public.test_step_results sr where sr.id = test_remarks.test_step_result_id)
      or exists (select 1 from public.test_case_results cr where cr.id = test_remarks.test_case_result_id)
    )
  );

-- Same "start the round first" rule the step-remark branch of guard_completed_iteration applies.
create or replace function public.guard_case_remark()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status public.iteration_status;
begin
  if new.test_case_result_id is null then return new; end if;
  select i.status into v_status
  from public.test_case_results cr
  join public.test_iterations i on i.id = cr.iteration_id
  where cr.id = new.test_case_result_id;
  if v_status = 'not_started' then
    raise exception 'Start the iteration before recording results';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_case_remark() from public, anon, authenticated;

create trigger guard_case_remark before insert on public.test_remarks
  for each row execute function public.guard_case_remark();

-- Draft attachment on a case result (mirror of create_draft_attachment, 0062).
create or replace function public.create_draft_case_attachment(
  p_case_result_id uuid,
  p_file_name text,
  p_content_type text,
  p_size_bytes bigint
)
returns public.attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_kind public.attachment_kind;
  v_id uuid := gen_random_uuid();
  v_row public.attachments;
begin
  if v_uid is null then
    raise exception 'forbidden: sign in first' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.test_case_results cr
    where cr.id = p_case_result_id
      and ((select public.can_see_all_results()) or cr.organization_id = (select public.current_org_id()))
  ) then
    raise exception 'forbidden: cannot see that case result' using errcode = '42501';
  end if;

  if p_content_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif') then
    v_kind := 'image';
  elsif p_content_type = 'application/pdf' then
    v_kind := 'pdf';
  else
    raise exception 'Only PNG, JPEG, WebP, GIF and PDF files can be attached.' using errcode = '22023';
  end if;

  if p_size_bytes is null or p_size_bytes <= 0 then
    raise exception 'That file is empty.' using errcode = '22023';
  end if;
  if p_size_bytes > 10485760 then
    raise exception 'Files can be at most 10 MB.' using errcode = '22023';
  end if;
  if coalesce(btrim(p_file_name), '') = '' then
    raise exception 'A file name is required.' using errcode = '22023';
  end if;

  insert into public.attachments (id, object_key, file_name, content_type, size_bytes, kind, uploaded_by, test_case_result_id)
  values (v_id, p_case_result_id::text || '/' || v_id::text, left(p_file_name, 255), p_content_type, p_size_bytes, v_kind, v_uid, p_case_result_id)
  returning * into v_row;

  return v_row;
end;
$$;

-- Post a case remark and link the caller's ready drafts in one transaction (mirror of 0063).
create or replace function public.post_case_remark_with_attachments(
  p_case_result_id uuid,
  p_remark text,
  p_attachment_ids uuid[] default '{}'
)
returns table (id uuid, remark text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ids uuid[] := coalesce((select array_agg(distinct a) from unnest(p_attachment_ids) a), '{}');
  v_remark public.test_remarks;
  v_linked int;
begin
  if v_uid is null then
    raise exception 'forbidden: sign in first' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.test_case_results cr
    where cr.id = p_case_result_id
      and (cr.organization_id = (select public.current_org_id()) or (select public.is_admin()))
  ) then
    raise exception 'forbidden: cannot remark on that case result' using errcode = '42501';
  end if;

  if coalesce(btrim(p_remark), '') = '' and cardinality(v_ids) = 0 then
    raise exception 'A remark needs text or a file.' using errcode = '22023';
  end if;
  if cardinality(v_ids) > 5 then
    raise exception 'A remark can have at most 5 files.' using errcode = '22023';
  end if;

  insert into public.test_remarks (test_case_result_id, remark, created_by)
  values (p_case_result_id, coalesce(btrim(p_remark), ''), v_uid)
  returning * into v_remark;

  if cardinality(v_ids) > 0 then
    update public.attachments a
    set remark_id = v_remark.id
    where a.id = any (v_ids)
      and a.uploaded_by = v_uid
      and a.status = 'ready'
      and a.remark_id is null
      and a.test_case_result_id = p_case_result_id;
    get diagnostics v_linked = row_count;
    if v_linked <> cardinality(v_ids) then
      raise exception 'Some files are not ready or cannot be attached to this remark.' using errcode = '22023';
    end if;
  end if;

  return query select v_remark.id, v_remark.remark, v_remark.created_at;
end;
$$;

revoke all on function public.create_draft_case_attachment(uuid, text, text, bigint) from public, anon;
revoke all on function public.post_case_remark_with_attachments(uuid, text, uuid[]) from public, anon;
grant execute on function public.create_draft_case_attachment(uuid, text, text, bigint) to authenticated;
grant execute on function public.post_case_remark_with_attachments(uuid, text, uuid[]) to authenticated;
