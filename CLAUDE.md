# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Architecture

UAT Portal: a Next.js App Router app for running UAT testing suites (sections → test cases → testing rounds/iterations → results → sign-off), backed by Supabase (Postgres) with role-based access.

- **Route groups**: pages live under two route groups — `app/(app)/` (the signed-in app: `dashboard`, `testingsuite/[testingSuiteSlug]/...`, `admin/{organizations,users}`, `exports`) and `app/(auth)/` (`login`, `set-password`). Route groups don't appear in URLs but **do** appear in import paths: import suite-local files as `@/app/(app)/testingsuite/[testingSuiteSlug]/components/...`, not `@/app/testingsuite/...`.
- **Data flow**: do data fetching/mutations in `lib/supabase/*.ts` (e.g. `test-suite.ts`, `sign-off-report.ts`) and server actions, not in components. Supabase row shapes are shaped into app types at that boundary. Related logic: `lib/import/*` (CSV/XLSX test case import parsing) and `lib/report/*` (sign-off report building).
- **Two Supabase clients**: `lib/supabase/client.ts` (`createBrowserClient`, for Client Components) vs `lib/supabase/server.ts` (`createServerClient`, async, for Server Components/route handlers/actions). Use the one matching the component type. `lib/supabase/database.types.ts` holds generated DB types.
- **UI components** (`components/ui/`): shadcn/ui components (style `base-nova`, base color `stone`, icon library `lucide`) generated per `components.json`. Unused sub-exports in these files are normal — don't trim them. Path aliases: `@/components`, `@/lib`, `@/hooks`, `@/components/ui` all map to their literal directories (see `tsconfig.json`'s `@/*` → `./*`).
- **Drag and drop**: `@dnd-kit` is used for the section tree and row reordering in `DataTable`. The old Kanban board / epic workspace has been removed.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Context budget

- Read files with `Read` + `offset`/`limit`, or `graphify query`, not `cat` of whole files.
- Never use `rtk proxy` unless the condensed output was empty, garbled, or contradicted the exit code.
- Get DB schema from `lib/supabase/database.types.ts` and `supabase/migrations/`; don't introspect via `execute_sql`. Use SQL only for data checks or applying migrations.
- For `/implement`: read the spec, the ticket and the planning notes file first; don't re-explore files the notes already cover.
- If context passes ~150K, stop, summarise progress into the ticket, and tell me to `/compact` or `/clear`.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `this-is-not-gio/uat-portal` (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
