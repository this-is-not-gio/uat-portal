-- Replies: a reply is a sign_off_comments row pointing at a top-level comment (parent_id). It copies the
-- parent's page and quote so it stays inside the same thread; the UI only anchors top-level comments.
-- Deleting a comment deletes its replies. Edit/delete RPCs (0070, 0071) already work on replies.

alter table public.sign_off_comments
  add column parent_id uuid references public.sign_off_comments (id) on delete cascade;

create index sign_off_comments_parent_idx on public.sign_off_comments (parent_id);

create or replace function public.reply_sign_off_comment(p_parent_id uuid, p_body text)
returns public.sign_off_comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent public.sign_off_comments;
  v_row public.sign_off_comments;
begin
  perform public.assert_can('sign_off');

  select * into v_parent from public.sign_off_comments where id = p_parent_id and parent_id is null;
  if not found then
    raise exception 'That comment no longer exists.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.suite_sign_offs where id = v_parent.sign_off_id and status = 'issued') then
    raise exception 'Replies can only be added while the sign-off is awaiting your decision.' using errcode = '22023';
  end if;

  insert into public.sign_off_comments (sign_off_id, page, quote, prefix, suffix, body, created_by, parent_id)
  values (v_parent.sign_off_id, v_parent.page, v_parent.quote, v_parent.prefix, v_parent.suffix, btrim(p_body), (select auth.uid()), v_parent.id)
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function public.reply_sign_off_comment(uuid, text) from public, anon;
grant execute on function public.reply_sign_off_comment(uuid, text) to authenticated;
