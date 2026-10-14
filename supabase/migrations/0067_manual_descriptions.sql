-- Manual CMS: a short description under the title of each module and section.
alter table public.manual_modules  add column if not exists description text not null default '';
alter table public.manual_sections add column if not exists description text not null default '';
