# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server (Next.js 16, Turbopack by default)
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (flat config, eslint.config.mjs)
```

There is no test runner configured in this repo.

## Architecture

UAT Portal: a Next.js App Router app for running UAT testing suites (sections → test cases → testing rounds/iterations → results → sign-off), backed by Supabase (Postgres) with role-based access.

- **Route groups**: pages live under two route groups — `app/(app)/` (the signed-in app: `dashboard`, `testingsuite/[testingSuiteSlug]/...`, `admin/{organizations,users}`, `exports`) and `app/(auth)/` (`login`, `set-password`). Route groups don't appear in URLs but **do** appear in import paths: import suite-local files as `@/app/(app)/testingsuite/[testingSuiteSlug]/components/...`, not `@/app/testingsuite/...`.
- **Root layout** (`app/layout.tsx`): renders the sidebar (`components/app-sidebar.tsx` → `nav-main`, `nav-secondary`, `nav-suites.ts`), `site-header`, and wraps the app in `CurrentUserProvider` (`components/current-user-provider.tsx`, read via `useCurrentUser`) so client components know the signed-in user/role.
- **Testing suite page** (`app/(app)/testingsuite/[testingSuiteSlug]/[[...section]]/page.tsx`): Server Component that loads the suite and passes server-rendered tab slots into the client `PageTab` (`page-tab.tsx`): Overview, Test Cases (`TestCasesTab` for authors, `TesterTestCasesTab` for testers), Test Results, and Sign-off. Suite-specific components live next to it in `[testingSuiteSlug]/components/`; the sign-off report page is `sign-off/[signOffId]/report/page.tsx`.
- **Data flow**: do data fetching/mutations in `lib/supabase/*.ts` (e.g. `test-suite.ts`, `sign-off-report.ts`) and server actions, not in components. Supabase row shapes are shaped into app types at that boundary. Related logic: `lib/import/*` (CSV/XLSX test case import parsing) and `lib/report/*` (sign-off report building).
- **Two Supabase clients**: `lib/supabase/client.ts` (`createBrowserClient`, for Client Components) vs `lib/supabase/server.ts` (`createServerClient`, async, for Server Components/route handlers/actions). Use the one matching the component type. `lib/supabase/database.types.ts` holds generated DB types.
- **Shared components** (`components/`):
  - `table/`: TanStack `DataTable` (`data-table.tsx`, feature flags in `data-table-features.ts`) plus one column-definition file per view (`columns`, `test-result-columns`, `iteration-test-cases-columns`, `iteration-participant-columns`, `import-review-columns`).
  - `testcasesheet/`: `TestCaseSheet` — test case detail + step result entry, Markdown via `react-markdown`/`remark-gfm`.
  - `sign-off-report/`: sign-off report view, picker and its tables.
  - Misc: `markdown-editor`, `audience-badge`, `suite-status-badge` (suite lifecycle/status mapping), `scope-of-testing`, `suite-dialog`, `sign-out-button`.
- **Domain types** (`components/types.ts`): `TestCase` (with `preconditions`, `stepsToExecute` → `TestStep.expectedResults`/`remarks`, `priority`, `roleAssignee`, `section`, `status`, `order`) used by the test cases tab and `lib/supabase/test-suite.ts`.
- **UI components** (`components/ui/`): shadcn/ui components (style `base-nova`, base color `stone`, icon library `lucide`) generated per `components.json`. Unused sub-exports in these files are normal — don't trim them. Path aliases: `@/components`, `@/lib`, `@/hooks`, `@/components/ui` all map to their literal directories (see `tsconfig.json`'s `@/*` → `./*`).
- **Drag and drop**: `@dnd-kit` is used for the section tree and row reordering in `DataTable`. The old Kanban board / epic workspace has been removed.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `this-is-not-gio/uat-portal` (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
