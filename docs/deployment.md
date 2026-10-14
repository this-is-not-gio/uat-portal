# Environments, CI/CD and releases

## Environments

| Env | Git branch | App (Vercel) | Database (Supabase) | Migrations applied by |
|---|---|---|---|---|
| Local | any | `npm run dev` | staging DB (`uat-portal-dev`, `xmipygezrjhogjelasct`) | you, via PR |
| **Staging** | `dev` | Vercel Preview / branch domain for `dev` | `uat-portal-dev` | GitHub Action on push to `dev` |
| **Production** | `main` | Vercel Production | `uat-portal-prod` (`vpzwsbonhwrqdpxocufz`) | GitHub Action on push to `main`, after a reviewer approves |

Staging and local share one database: don't leave data there you need.
Keep each env's variables separate (`.env.example` lists them): never put prod keys in Preview, or dev keys in Production.

## Pipeline (`.github/workflows/ci.yml`)

1. **verify** (every PR and push to `dev`/`main`): `npm ci`, lint, `tsc --noEmit`, `scripts/check-migrations.mjs`, `npm run build` with placeholder env.
2. **migrate-staging** (push to `dev`, after verify): `node scripts/migrate.mjs` against the staging DB.
3. **migrate-production** (push to `main`, after verify): same against prod, gated by the `production` GitHub Environment's required reviewer.
4. **deploy-staging / deploy-production** (after the matching migrate job): build with the Vercel CLI (`vercel pull` + `build` + `deploy --prebuilt`) using that env's Vercel variables. The Vercel Git integration is switched off for `dev` and `main` in `vercel.json`, so nothing deploys unless verify and the migration passed. PRs still get Vercel preview deployments. Order is always: checks -> schema -> code, but migrations must still be backward-compatible, so a failed deploy leaves the old code running on the new schema.

## Migrations

- Add `supabase/migrations/00NN_short_name.sql` (next free number). CI rejects bad names, duplicate numbers and seed data (test emails, `profiles` inserts). Put seed data in `supabase/seed.*.sql`, never in migrations.
- The runner tracks applied files by name in `repo_ops.applied_migrations` (not in `supabase_migrations`, whose stamps differ from our file names). Each file runs in one transaction together with its tracking row.
- Preview pending: `SUPABASE_PROJECT_REF=... SUPABASE_ACCESS_TOKEN=... node scripts/migrate.mjs --dry-run`.
- Don't apply migrations by hand. Anything applied outside the pipeline is invisible to it, so the next run would re-run it: only merge files through a PR to `dev`.
- Regenerate `lib/supabase/database.types.ts` after schema changes.
- Known gap: the repo has no base schema (see `~/.claude/plans/infra-hardening.md` I1), so prod can't be rebuilt from the repo yet. Prod must be brought to the same state before the first `main` run.

## One-time setup (manual)

**GitHub**
1. Settings -> Secrets and variables -> Actions: repository secret `SUPABASE_ACCESS_TOKEN` (personal access token from supabase.com/dashboard/account/tokens).
2. Settings -> Environments: create `staging` (variable `SUPABASE_PROJECT_REF` = `xmipygezrjhogjelasct`) and `production` (variable `SUPABASE_PROJECT_REF` = `vpzwsbonhwrqdpxocufz`, **Required reviewers** = you, deployment branches = `main`).
3. Settings -> Branches: protect `main` and `dev`: require PR, require the `verify` check.
4. Baseline staging once (it already has all 72 files): run locally `SUPABASE_PROJECT_REF=xmipygezrjhogjelasct SUPABASE_ACCESS_TOKEN=... node scripts/migrate.mjs --baseline`.

**Vercel + GitHub secrets for deploys**
0. Repo secrets: `VERCEL_TOKEN` (vercel.com/account/tokens), `VERCEL_ORG_ID` (team Settings -> General -> Team ID), `VERCEL_PROJECT_ID` (`prj_2ahw13lbIYfzTNOqSnKvvyIfgAzF`). Optional repo variable `STAGING_DOMAIN` (the stable staging domain, aliased on each staging deploy).
1. Environment variables (Settings -> Environment Variables), per `.env.example`: **Production** -> prod Supabase/B2/Groq; **Preview** -> staging (dev) Supabase/B2/Groq.
2. Settings -> Domains: add a stable staging domain and put it in the `STAGING_DOMAIN` variable (CLI deploys are aliased to it; branch assignment doesn't apply).
3. Settings -> Deployment Protection: Vercel Authentication on Preview.
4. Production Branch = `main`.
5. Supabase Auth on each project: Site URL + redirect URLs = that env's app URL (staging domain for dev project, production URL for prod).

## Release flow

feature branch -> PR into `dev` (CI runs) -> merge: staging deploys + staging DB migrates -> smoke test on staging -> PR `dev` -> `main` (CI runs) -> merge: approve the `production` migration job; Vercel deploys production.
Rollback: redeploy the previous Vercel deployment; for DB, add a new forward migration (no down migrations).
