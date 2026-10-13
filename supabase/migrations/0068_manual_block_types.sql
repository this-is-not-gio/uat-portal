-- Manual CMS: typed blocks. header/body keep their meaning; `data` holds type-specific fields
-- (icon blocks: { icon }, table blocks: { columns, rows }).
alter table public.manual_blocks add column if not exists block_type text not null default 'general'
  check (block_type in ('header', 'icon', 'table', 'content', 'general'));
alter table public.manual_blocks add column if not exists data jsonb not null default '{}'::jsonb;
