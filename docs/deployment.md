# Environments, deploys and releases

## Environments

| Env | Git branch | App (Vercel) | Database (Supabase) | Migrations applied by |
|---|---|---|---|---|
| Local | any | `npm run dev` | staging DB (`uat-portal-dev`, `xmipygezrjhogjelasct`) | you, via PR |
| **Staging** | `dev` | Vercel Preview / branch domain for `dev` | `uat-portal-dev` | GitHub Action on push to `dev` |
| **Production** | `main` | Vercel Production | `uat-portal-prod` (`vpzwsbonhwrqdpxocufz`) | GitHub Action on push to `main`, after a reviewer approves |

Staging and local share one database: don't leave data there you need.
Keep each env's variables separate (`.env.example` lists them): never put prod keys in Preview, or dev keys in Production.

## Pipeline

- **App checks and deploys: Vercel Git integration.** Every push builds (`npm run build` is the check); PRs get preview deployments, `dev` deploys to staging, `main` to production. There is no GitHub CI for lint/typecheck.
- **Database migrations: `.github/workflows/migrate.yml`.**
  1. **migrate-staging** (push to `dev`): `node scripts/migrate.mjs` against the staging DB.
  2. **migrate-production** (push to `main`): same against prod, gated by the `production` GitHub Environment's required reviewer.
  Vercel deploys and migrations run in parallel with no ordering, so migrations must be backward-compatible: old code must keep working on the new schema, and new code should tolerate the schema arriving a little later.

## Migrations

- Add `supabase/migrations/00NN_short_name.sql` (next free number). Keep names `00NN_short_name`, numbers unique, and no seed data (test emails, `profiles` inserts); `scripts/check-migrations.mjs` checks this, run it locally. Put seed data in `supabase/seed.*.sql`, never in migrations.
- The runner tracks applied files by name in `repo_ops.applied_migrations` (not in `supabase_migrations`, whose stamps differ from our file names). Each file runs in one transaction together with its tracking row.
- Preview pending: `SUPABASE_PROJECT_REF=... SUPABASE_ACCESS_TOKEN=... node scripts/migrate.mjs --dry-run`.
- Don't apply migrations by hand. Anything applied outside the pipeline is invisible to it, so the next run would re-run it: only merge files through a PR to `dev`.
- Regenerate `lib/supabase/database.types.ts` after schema changes.
- The repo rebuilds an empty database from scratch: `0000_baseline_core.sql` + `0000b_baseline_iterations.sql` (dev's history before `0001`, in two files because enum values added by `ADD VALUE` can't be used in the same transaction) then `0001` onward. A new empty project: `node scripts/migrate.mjs --init-empty`. Verified 2026-10-14: prod was rebuilt this way and matches dev (tables, columns, constraints, indexes, enums, policies, grants, triggers, and every function body ignoring comments).
- Never edit an applied migration file in place to fix a change: add a new file, or dev/prod will silently diverge (this is how `0064` once went unapplied on dev).
- To compare two databases, fingerprint `information_schema.columns`, `pg_constraint`, `pg_indexes`, `pg_proc` (`pg_get_functiondef`, comments and whitespace stripped), `pg_policies` and the ACLs on both and diff.

## One-time setup (manual)

**GitHub**
1. Settings -> Secrets and variables -> Actions: repository secret `SUPABASE_ACCESS_TOKEN` (personal access token from supabase.com/dashboard/account/tokens).
2. Settings -> Environments: create `staging` (variable `SUPABASE_PROJECT_REF` = `xmipygezrjhogjelasct`) and `production` (variable `SUPABASE_PROJECT_REF` = `vpzwsbonhwrqdpxocufz`, **Required reviewers** = you, deployment branches = `main`).
3. Settings -> Branches: protect `main` and `dev`: require PR.
4. Baseline staging once (it already has all 72 files): run locally `SUPABASE_PROJECT_REF=xmipygezrjhogjelasct SUPABASE_ACCESS_TOKEN=... node scripts/migrate.mjs --baseline`.

**Vercel**
1. Environment variables (Settings -> Environment Variables), per `.env.example`: **Production** -> prod Supabase/B2/Groq; **Preview** -> staging (dev) Supabase/B2/Groq.
2. Settings -> Domains: add a stable staging domain and assign it to the `dev` branch.
3. Settings -> Deployment Protection: Vercel Authentication on Preview.
4. Production Branch = `main`.
5. Supabase Auth on each project: Site URL + redirect URLs = that env's app URL (staging domain for dev project, production URL for prod).

## Release flow

feature branch -> PR into `dev` (Vercel preview build) -> merge: staging deploys + staging DB migrates -> smoke test on staging -> PR `dev` -> `main` -> merge: approve the `production` migration job; Vercel deploys production.
Rollback: redeploy the previous Vercel deployment; for DB, add a new forward migration (no down migrations).
