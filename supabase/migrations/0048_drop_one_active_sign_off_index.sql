-- A rejected sign-off is history but never revoked, so "one unrevoked sign-off per suite" blocked
-- every new report after a rejection. 0047's suite_sign_offs_one_open (one draft or issued
-- sign-off per suite) is the rule now.
drop index if exists public.suite_sign_offs_one_active_per_suite;

create index if not exists suite_sign_offs_rejected_by_idx on public.suite_sign_offs (rejected_by);
