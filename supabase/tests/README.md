# SQL scenario tests

Scenario scripts that prove database behaviour (RPCs, RLS) by acting as real users.
Each `NNN_*.sql` file is run in a single transaction that is **always rolled back**, so it
can be pointed at a Supabase branch (or the dev project) without leaving data behind.

## Run

```bash
SUPABASE_PROJECT_REF=<branch or project ref> \
SUPABASE_ACCESS_TOKEN=<personal access token> \
node scripts/run-sql-scenarios.mjs                 # every scenario
node scripts/run-sql-scenarios.mjs 001             # scenarios whose file name contains "001"
node scripts/run-sql-scenarios.mjs --pre supabase/migrations/0060_x.sql 004
                                                   # apply an unapplied migration first (also rolled back)
```

The token is a Supabase personal access token (Dashboard → Account → Access tokens). The
runner uses the Management API's query endpoint, so no local Postgres client is needed.
It prints ✓/✗ per assertion and exits non-zero on any failure.

## Writing a scenario

`_helpers.sql` is prepended to every scenario. Seed as postgres (RLS bypassed), then act as
users through the `_as` helpers (RLS applies):

| Helper | Does |
| --- | --- |
| `t_org(name, type)` | organization (`vendor` / `client` / `external`) |
| `t_test_role(name)`, `t_org_role(org, test_role)` | catalog role (found by normalized name or created) / its instance in an org |
| `t_role(org, name)` | shorthand for `t_org_role(org, t_test_role(name))` |
| `t_user(label, user_role, org, org_role)` | auth user + profile, optionally holding a test role |
| `t_suite(name)`, `t_section(suite, name)`, `t_case(section, title, role)` | suite content (cases are complete: one step, one expected result) |
| `t_count_as(user, sql)`, `t_rows_as(user, sql)` | read as a user |
| `t_succeeds_as(label, user, sql)`, `t_fails_as(label, user, sql, like)` | write as a user and assert the outcome |
| `t_touches_nothing_as(label, user, sql)` | an `update/delete … returning 1` that RLS should silently filter |
| `t_ok(label, bool)`, `t_eq(label, actual, expected)` | assertions |

Write a scenario as one `do $$ … $$;` block. Assert outcomes (rows visible, writes accepted
or rejected, values returned), not function internals.
