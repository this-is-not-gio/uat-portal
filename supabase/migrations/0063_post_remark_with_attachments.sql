-- Post a remark and link the caller's ready drafts in one transaction (#18, spec #15).
-- Visibility check is the same as the "remarks: add on own org, or any as admin" insert rule.
-- Any bad draft (not ready, not the caller's, other step result, already posted) raises, which
-- rolls back the remark insert too, so a remark is never saved half-done.

create or replace function public.post_remark_with_attachments(
  p_step_result_id uuid,
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
    from public.test_step_results sr
    join public.test_case_results cr on cr.id = sr.test_case_result_id
    where sr.id = p_step_result_id
      and (cr.organization_id = (select public.current_org_id()) or (select public.is_admin()))
  ) then
    raise exception 'forbidden: cannot remark on that step result' using errcode = '42501';
  end if;

  if coalesce(btrim(p_remark), '') = '' and cardinality(v_ids) = 0 then
    raise exception 'A remark needs text or a file.' using errcode = '22023';
  end if;
  if cardinality(v_ids) > 5 then
    raise exception 'A remark can have at most 5 files.' using errcode = '22023';
  end if;

  insert into public.test_remarks (test_step_result_id, remark, created_by)
  values (p_step_result_id, coalesce(btrim(p_remark), ''), v_uid)
  returning * into v_remark;

  if cardinality(v_ids) > 0 then
    update public.attachments a
    set remark_id = v_remark.id
    where a.id = any (v_ids)
      and a.uploaded_by = v_uid
      and a.status = 'ready'
      and a.remark_id is null
      and a.test_step_result_id = p_step_result_id;
    get diagnostics v_linked = row_count;
    if v_linked <> cardinality(v_ids) then
      raise exception 'Some files are not ready or cannot be attached to this remark.' using errcode = '22023';
    end if;
  end if;

  return query select v_remark.id, v_remark.remark, v_remark.created_at;
end;
$$;

revoke all on function public.post_remark_with_attachments(uuid, text, uuid[]) from public, anon;
grant execute on function public.post_remark_with_attachments(uuid, text, uuid[]) to authenticated;
