-- Exit criteria: "max high-priority failed" becomes "max failed" (every failed case counts).
-- Priority is never really set (import always writes medium), so the old criterion measured nothing.

alter table public.testing_suites
  alter column exit_criteria set default
    '{"minPassRate":95,"maxFailed":0,"maxBlocked":0,"requireAllOrgsSubmitted":true}';

-- lock_exit_criteria rejects changes once a suite is past ready; this is a one-off key rename.
-- The old threshold carries over, so suites already in testing keep their bar.
alter table public.testing_suites disable trigger lock_exit_criteria;
update public.testing_suites
  set exit_criteria = (exit_criteria - 'maxHighFailed')
    || jsonb_build_object('maxFailed', coalesce(exit_criteria->'maxHighFailed', '0'::jsonb))
  where exit_criteria ? 'maxHighFailed';
alter table public.testing_suites enable trigger lock_exit_criteria;
