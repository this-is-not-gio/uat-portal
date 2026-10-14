-- Authors can reword their own comment while the report is still awaiting a decision.
create or replace function public.update_sign_off_comment(p_comment_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can('sign_off');

  update public.sign_off_comments c
  set body = btrim(p_body)
  where c.id = p_comment_id
    and c.created_by = (select auth.uid())
    and exists (select 1 from public.suite_sign_offs so where so.id = c.sign_off_id and so.status = 'issued');
  if not found then
    raise exception 'That comment can no longer be edited.' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.update_sign_off_comment(uuid, text) from public, anon;
grant execute on function public.update_sign_off_comment(uuid, text) to authenticated;
