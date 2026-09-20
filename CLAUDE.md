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

UAT Portal: a Next.js App Router app for tracking UAT epics and their test cases, backed by Supabase (Postgres).

- **Data flow**: Server Components fetch data via `lib/supabase/test-cases.ts` (uses the server Supabase client from `lib/supabase/server.ts`, which reads/writes auth cookies via `next/headers`). Data is shaped into the app's domain types (`components/types.ts`) at the fetch boundary — e.g. `getTestCasesByEpicId` selects a nested Supabase query (`sections`, `preconditions`, `test_steps` → `expected_results`/`test_remarks`) and flattens/sorts it into `TestCase[]` via `toTestCase`. Do new data fetching in `lib/supabase/*.ts`, not in components.
- **Two Supabase clients**: `lib/supabase/client.ts` (`createBrowserClient`, for Client Components) vs `lib/supabase/server.ts` (`createServerClient`, async, for Server Components/route handlers). Use the one matching the component type. `lib/supabase/database.types.ts` holds generated DB types.
- **Routing**: `app/layout.tsx` is a Server Component that loads all epics (`getAllEpics`) for the sidebar nav on every page. `app/[epicId]/page.tsx` looks up one epic by slug, fetches its test cases, and calls `notFound()` if missing. It's an async Server Component wrapped in `Suspense` — the actual data fetching/rendering lives in an inner `EpicContent` async component so the route can show a skeleton fallback.
- **Epic workspace** (`components/epic-workspace.tsx`, Client Component): owns `testCases` state (seeded from server-fetched `initialTestCases`) and toggles between two views of the same data:
  - **Board** (`components/board/board.tsx`): Kanban view using `@dnd-kit`. Lanes come from `LANES` in `components/types.ts` (`Untested`/`Passed`/`Failed`). Drag-and-drop reorders `TestCase.order` and reassigns `status` client-side only — there is currently no persistence of drag changes back to Supabase.
  - **Table** (`components/table/data-table.tsx` + `uat-ticket-columns.tsx`): TanStack Table view; clicking a row opens `TestCaseSheet` (`components/testcasesheet/`) with the full test case detail, including Markdown fields rendered via `react-markdown`/`remark-gfm`.
- **Domain model** (`components/types.ts`): a `TestCase` has `preconditions`, `stepsToExecute` (each `TestStep` has `expectedResults` and optional `remarks`), `priority`, `roleAssignee`, `section`, and a `status`/`order` pair used for Kanban placement. This is the shape all UI components consume; Supabase row shapes are private to `lib/supabase/test-cases.ts`.
- **UI components** (`components/ui/`): shadcn/ui components (style `base-nova`, base color `stone`, icon library `lucide`) generated per `components.json`. Path aliases: `@/components`, `@/lib`, `@/hooks`, `@/components/ui` all map to their literal directories (see `tsconfig.json`'s `@/*` → `./*`).
- **Auth**: login/auth gating was previously added then removed (see git history) — the app currently has no auth gate in front of pages, but the Supabase server/browser clients are still wired for cookie-based auth sessions.
