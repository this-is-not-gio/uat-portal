-- Evidence attachments (#17, spec #15). File bytes live in a private B2 bucket; this table is the
-- index and the authority on who may see what. A draft (not yet linked to a remark) is visible
-- only to its uploader; a posted one (linked + ready) to anyone who can see the remark. There
-- are no direct write rules: every write goes through the security-definer RPCs below.
-- The remark link is nullable until Post (#18); more nullable parent links can be added later.

create type public.attachment_kind as enum ('image', 'pdf', 'video');
create type public.attachment_status as enum ('pending', 'ready');

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  object_key text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  kind public.attachment_kind not null,
  status public.attachment_status not null default 'pending',
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  test_step_result_id uuid not null references public.test_step_results (id) on delete cascade,
  remark_id uuid references public.test_remarks (id) on delete cascade
);

create index attachments_step_result_idx on public.attachments (test_step_result_id);
create index attachments_remark_idx on public.attachments (remark_id) where remark_id is not null;
create index attachments_uploaded_by_idx on public.attachments (uploaded_by);

alter table public.attachments enable row level security;

-- The remark lookup runs under test_remarks' own RLS, so "can see the remark" is exactly its read rule.
create policy "attachments: read" on public.attachments for select to authenticated
  using (
    uploaded_by = (select auth.uid())
    or (
      status = 'ready'
      and remark_id is not null
      and exists (select 1 from public.test_remarks r where r.id = attachments.remark_id)
    )
  );

revoke insert, update, delete on public.attachments from authenticated, anon;

-- Same visibility as the step result's read rule (0012 case results + step results chain).
create or replace function public.create_draft_attachment(
  p_step_result_id uuid,
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
    from public.test_step_results sr
    join public.test_case_results cr on cr.id = sr.test_case_result_id
    where sr.id = p_step_result_id
      and ((select public.can_see_all_results()) or cr.organization_id = (select public.current_org_id()))
  ) then
    raise exception 'forbidden: cannot see that step result' using errcode = '42501';
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

  insert into public.attachments (id, object_key, file_name, content_type, size_bytes, kind, uploaded_by, test_step_result_id)
  values (v_id, p_step_result_id::text || '/' || v_id::text, left(p_file_name, 255), p_content_type, p_size_bytes, v_kind, v_uid, p_step_result_id)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.mark_attachment_ready(p_attachment_id uuid)
returns public.attachments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.attachments;
begin
  update public.attachments
  set status = 'ready'
  where id = p_attachment_id and uploaded_by = (select auth.uid()) and remark_id is null
  returning * into v_row;

  if v_row.id is null then
    raise exception 'forbidden: not your draft attachment' using errcode = '42501';
  end if;
  return v_row;
end;
$$;

-- Returns the object key so the caller can remove the file from the bucket.
create or replace function public.delete_draft_attachment(p_attachment_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
begin
  delete from public.attachments
  where id = p_attachment_id and uploaded_by = (select auth.uid()) and remark_id is null
  returning object_key into v_key;

  if v_key is null then
    raise exception 'forbidden: not your unposted draft attachment' using errcode = '42501';
  end if;
  return v_key;
end;
$$;

revoke all on function public.create_draft_attachment(uuid, text, text, bigint) from public, anon;
revoke all on function public.mark_attachment_ready(uuid) from public, anon;
revoke all on function public.delete_draft_attachment(uuid) from public, anon;
grant execute on function public.create_draft_attachment(uuid, text, text, bigint) to authenticated;
grant execute on function public.mark_attachment_ready(uuid) to authenticated;
grant execute on function public.delete_draft_attachment(uuid) to authenticated;
