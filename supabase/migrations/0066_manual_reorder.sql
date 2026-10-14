-- Manual CMS drag-to-reorder. Each RPC takes the full ordered id list of one parent and
-- rewrites sort_order. Admin only; ids must be exactly that parent's rows (no strangers, no gaps).

create or replace function public.reorder_manual_modules(p_module_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can reorder manual modules.' using errcode = '42501';
  end if;
  if cardinality(p_module_ids) is distinct from (select count(*) from public.manual_modules)
     or exists (select 1 from unnest(p_module_ids) as u(id) where not exists (select 1 from public.manual_modules m where m.id = u.id))
     or cardinality(p_module_ids) <> (select count(distinct id) from unnest(p_module_ids) as d(id)) then
    raise exception 'The ids must be every module exactly once.' using errcode = '22023';
  end if;
  update public.manual_modules m set sort_order = o.ord - 1
  from unnest(p_module_ids) with ordinality as o(id, ord)
  where m.id = o.id;
end;
$$;

create or replace function public.reorder_manual_sections(p_module_id uuid, p_section_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can reorder manual sections.' using errcode = '42501';
  end if;
  if cardinality(p_section_ids) is distinct from (select count(*) from public.manual_sections where module_id = p_module_id)
     or exists (select 1 from unnest(p_section_ids) as u(id) where not exists (select 1 from public.manual_sections s where s.id = u.id and s.module_id = p_module_id))
     or cardinality(p_section_ids) <> (select count(distinct id) from unnest(p_section_ids) as d(id)) then
    raise exception 'The ids must be every section of the module exactly once.' using errcode = '22023';
  end if;
  update public.manual_sections s set sort_order = o.ord - 1
  from unnest(p_section_ids) with ordinality as o(id, ord)
  where s.id = o.id and s.module_id = p_module_id;
end;
$$;

-- p_section_id null = the module's own blocks.
create or replace function public.reorder_manual_blocks(p_module_id uuid, p_section_id uuid, p_block_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can reorder manual blocks.' using errcode = '42501';
  end if;
  if cardinality(p_block_ids) is distinct from (
       select count(*) from public.manual_blocks
       where module_id = p_module_id and section_id is not distinct from p_section_id)
     or exists (
       select 1 from unnest(p_block_ids) as u(id)
       where not exists (
         select 1 from public.manual_blocks b
         where b.id = u.id and b.module_id = p_module_id and b.section_id is not distinct from p_section_id))
     or cardinality(p_block_ids) <> (select count(distinct id) from unnest(p_block_ids) as d(id)) then
    raise exception 'The ids must be every block of the container exactly once.' using errcode = '22023';
  end if;
  update public.manual_blocks b set sort_order = o.ord - 1
  from unnest(p_block_ids) with ordinality as o(id, ord)
  where b.id = o.id;
end;
$$;

revoke all on function public.reorder_manual_modules(uuid[]) from public, anon;
revoke all on function public.reorder_manual_sections(uuid, uuid[]) from public, anon;
revoke all on function public.reorder_manual_blocks(uuid, uuid, uuid[]) from public, anon;
grant execute on function public.reorder_manual_modules(uuid[]) to authenticated;
grant execute on function public.reorder_manual_sections(uuid, uuid[]) to authenticated;
grant execute on function public.reorder_manual_blocks(uuid, uuid, uuid[]) to authenticated;
