-- Edit and delete defects (spec #52, ticket #56). Staff only, like create_defect (0080); there are
-- still no direct writes on the tables. Deleting a defect cascades to its saved remark copies.

create or replace function public.update_defect(
  p_defect_id uuid,
  p_summary text,
  p_description text,
  p_severity public.defect_severity,
  p_status public.defect_status,
  p_jira_url text
)
returns public.defects
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jira text := nullif(btrim(coalesce(p_jira_url, '')), '');
  v_defect public.defects;
begin
  if (select auth.uid()) is null or not (select public.can_see_all_results()) then
    raise exception 'forbidden: only staff can edit defects' using errcode = '42501';
  end if;
  if coalesce(btrim(p_summary), '') = '' then
    raise exception 'A summary is required.' using errcode = '22023';
  end if;
  if char_length(btrim(p_summary)) > 200 then
    raise exception 'The summary can be at most 200 characters.' using errcode = '22023';
  end if;
  if v_jira is not null and v_jira !~* '^https?://[^\s/]+\.[^\s]+$' then
    raise exception 'The Jira link must be a valid URL.' using errcode = '22023';
  end if;

  update public.defects
  set summary = btrim(p_summary),
      description = coalesce(p_description, ''),
      severity = coalesce(p_severity, severity),
      status = coalesce(p_status, status),
      jira_url = v_jira,
      updated_at = now()
  where id = p_defect_id
  returning * into v_defect;
  if not found then
    raise exception 'That defect no longer exists.' using errcode = '22023';
  end if;
  return v_defect;
end;
$$;

create or replace function public.delete_defect(p_defect_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select public.can_see_all_results()) then
    raise exception 'forbidden: only staff can delete defects' using errcode = '42501';
  end if;
  delete from public.defects where id = p_defect_id;
end;
$$;

revoke all on function public.update_defect(uuid, text, text, public.defect_severity, public.defect_status, text) from public, anon;
grant execute on function public.update_defect(uuid, text, text, public.defect_severity, public.defect_status, text) to authenticated;
revoke all on function public.delete_defect(uuid) from public, anon;
grant execute on function public.delete_defect(uuid) to authenticated;
