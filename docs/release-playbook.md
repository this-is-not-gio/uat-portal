# Release playbook

How to ship features and fixes to the live UAT Portal. The pipeline lives in `.github/workflows/` (`ci.yml`, `release-pr.yml`, `migrate.yml`).

```
feature/xyz ──┐
fix/abc ──────┼──► dev ──(auto Release PR)──► main
              │     │                           │
              │     ├ CI check                  ├ Migrate (needs approval) → prod DB
              │     ├ migrate Preview DB        └ Vercel → production site
              │     └ Vercel Preview site
```

- **`main`** is production. It's protected: no direct pushes, and only the Release PR (or a hotfix PR) goes in.
- **`dev`** is staging. Everything lands here first and is tested on the Preview URL against the dev database.
- **Short-lived branches** (`feature/…`, `fix/…`, `hotfix/…`) hold work in progress, so unfinished code never sits on `dev`.

## 1. A new feature

```bash
git checkout dev && git pull
git checkout -b feature/export-pdf
# ...code, commit often...
```

If it needs a DB change, add the next numbered file in `supabase/migrations/` (e.g. `0078_….sql`) and keep it **additive**: new tables, nullable or defaulted columns, new functions. Don't drop or rename anything the current prod code still uses. Never apply it to prod by hand.

CI doesn't run on feature branches, so check locally before merging:

```bash
npm run lint && npx tsc --noEmit
```

Then merge into `dev`:

```bash
git checkout dev && git pull
git merge feature/export-pdf
git push origin dev
git branch -d feature/export-pdf
```

Pushing runs CI, migrates the dev DB and deploys the Preview. **Click-test on the Preview URL.**

For a big feature shipped in pieces, merge it to `dev` behind a flag (an env var such as `NEXT_PUBLIC_FEATURE_X`, or an admin-only check) so users don't see it until it's switched on.

## 2. Releasing to users

1. When `dev` is green, the **"Release: dev to main"** PR opens automatically.
2. Read its file list. Every commit on `dev` ships together, so anything not ready must not be there.
3. **Merge** it. Vercel starts deploying prod.
4. **Straight away: Actions → Migrate → Review deployments → `production` → Approve and deploy.** Without this, prod code runs against a DB that's missing its migrations.
5. Smoke-test the live site.

Release when usage is low, and tell users when behaviour changes.

## 3. Bug fixes

**Normal bug:** same as a feature, using `fix/…` off `dev`, then `dev`, then the Release PR.

**Urgent prod bug while `dev` holds unfinished work:**

- If `dev` is releasable, fix it on `dev` and release.
- If not, branch from `main`:

  ```bash
  git checkout main && git pull
  git checkout -b hotfix/login-crash
  # fix, commit, push, open a PR into main (CI runs on PRs to main)
  ```

  Merge it, approve Migrate if needed, then bring the fix back into `dev`:

  ```bash
  git checkout dev && git pull && git merge main && git push
  ```

## 4. When a release goes wrong

- **Code:** in Vercel, open the previous production deployment and **Promote / Instant Rollback**. It takes seconds and needs no git.
- **DB:** additive migrations mean older code still works against the newer schema, so a code rollback is safe. Fix forward with a new migration. Never edit a migration that has already shipped.

## 5. Rules (from the 2026-10-24 incident)

1. **Prod DB changes only go through the Migrate workflow.** `scripts/migrate.mjs` tracks applied files in `repo_ops.applied_migrations`. A migration applied by hand without its tracking row makes the next run fail with "already exists". If a hand-apply is ever unavoidable, insert the tracking row too:

   ```sql
   insert into repo_ops.applied_migrations (name) values ('00XX_name.sql') on conflict do nothing;
   ```

2. **Approve Migrate right after merging** a Release PR.
3. **Set secrets on GitHub's web settings page** (Settings → Secrets and variables → Actions). `gh secret set` run through a non-interactive shell saves an **empty** value.
4. **Track the `SUPABASE_ACCESS_TOKEN` expiry date.** An expired token fails every migration with `Invalid access token`, for both the Preview and prod databases. Each migration file runs as one transaction, so a failed run leaves the DB unchanged.
