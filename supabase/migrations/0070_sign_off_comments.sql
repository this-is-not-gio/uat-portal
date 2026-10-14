-- Sign-off comments: the client (sign_off) highlights text in an issued report and comments on it;
-- the vendor reads them. A comment anchors to a quote inside one report page (section), with a
-- little text around it so the same words elsewhere on the page can be told apart.
-- No direct writes: add/delete go through the security-definer RPCs below.

create table public.sign_off_comments (
  id uuid primary key default gen_random_uuid(),
  sign_off_id uuid not null references public.suite_sign_offs (id) on delete cascade,
  page smallint not null check (page >= 0),
  quote text not null check (char_length(quote) between 1 and 500),
  prefix text not null default '' check (char_length(prefix) <= 64),
  suffix text not null default '' check (char_length(suffix) <= 64),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index sign_off_comments_sign_off_idx on public.sign_off_comments (sign_off_id, created_at);
create index sign_off_comments_created_by_idx on public.sign_off_comments (created_by);

alter table public.sign_off_comments enable row level security;

-- Same reach as the sign-off itself (its own RLS hides drafts from non-admins).
create policy "sign-off comments: read" on public.sign_off_comments for select to authenticated
  using (exists (select 1 from public.suite_sign_offs so where so.id = sign_off_comments.sign_off_id));

revoke insert, update, delete on public.sign_off_comments from authenticated, anon;

-- Comment while the report is awaiting the client's decision.
create or replace function public.add_sign_off_comment(
  p_sign_off_id uuid,
  p_page integer,
  p_quote text,
  p_prefix text,
  p_suffix text,
  p_body text
)
returns public.sign_off_comments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.sign_off_comments;
begin
  perform public.assert_can('sign_off');

  if not exists (select 1 from public.suite_sign_offs where id = p_sign_off_id and status = 'issued') then
    raise exception 'Comments can only be added while the sign-off is awaiting your decision.' using errcode = '22023';
  end if;

  insert into public.sign_off_comments (sign_off_id, page, quote, prefix, suffix, body, created_by)
  values (p_sign_off_id, p_page, p_quote, coalesce(p_prefix, ''), coalesce(p_suffix, ''), btrim(p_body), (select auth.uid()))
  returning * into v_row;
  return v_row;
end;
$$;

-- Authors can take a comment back while the report is still awaiting a decision.
create or replace function public.delete_sign_off_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_can('sign_off');

  delete from public.sign_off_comments c
  where c.id = p_comment_id
    and c.created_by = (select auth.uid())
    and exists (select 1 from public.suite_sign_offs so where so.id = c.sign_off_id and so.status = 'issued');
  if not found then
    raise exception 'That comment can no longer be deleted.' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.add_sign_off_comment(uuid, integer, text, text, text, text) from public, anon;
revoke execute on function public.delete_sign_off_comment(uuid) from public, anon;
grant execute on function public.add_sign_off_comment(uuid, integer, text, text, text, text) to authenticated;
grant execute on function public.delete_sign_off_comment(uuid) to authenticated;
