# Dev log

Running recap of development sessions, newest entries appended at the bottom.

---

## Thu 2026-10-08 (committed early Fri 10-09, 02:35)

No commits are dated 10-08 itself; these three commits (stamped 02:35 on 10-09) are the end of the Thursday-night session.

### 1. Sign-off workflow backend: `3617f4a` (12 files, +1126/−51)
- Migrations 0046–0050: `rejected` and `for_sign_off` statuses, Draft → Issue → Acknowledge/Reject workflow, dropped the one-active-sign-off unique index.
- Report details data in `lib/report/report-details.ts` (custom sections, "From Overview" source).
- Sign-off queries/actions extended in `sign-off-report.ts`, `iteration-actions.ts`, `overview.ts`, `test-iterations.ts`; `database.types.ts` regenerated.

### 2. Sign-off tab UI: `6028c10` (31 files, +1951/−283)
- New route `/testsuite/[slug]/sign-off` with the Google-Docs-style canvas document (`sign-off-document.tsx`).
- Workflow buttons (Draft, Issue report, Back to Testing), notice, status badge and info panel.
- Report tables: case results, change list, editable report sections editor.
- A4 print styles; sidebar, header and dashboard know the new sign-off statuses; added `Switch` UI component.
- Removed the old `[testingSuiteSlug]/sign-off/.../report` page and old sign-off tab.

### 3. Retired the old `testingsuite` route: `37378b1` (38 files, +523/−1084)
- Shared suite components moved to `components/testsuite-layout/shared` (sync dialog, participant picker, start-iteration dialog, submission bar, etc.).
- `testsuite/[slug]/layout.tsx` now owns the suite header; old `[[...section]]/page.tsx`, `page-tab.tsx`, `suite-header-menu` removed.
- Follow-up updates to test cases, test results and the test case sheet.
- Suite restructure complete (~560 fewer lines net).

### Context
- Wed 10-07: `(auth)`/`(app)` route split, sidebar shell, Kanban/canvas removal, new suite routes, dashboard rebuild.
- Fri 10-09 (later): org test roles (0051), admin Organizations/Users rebuild, Roles page.

### Not verified
Sign-off flow (0046–0050) is on the dev DB only; no click-test recorded.

---

## Weekly recap: Thu 2026-10-08 → Thu 2026-10-15

Source: `git log --all` for the window. Dates are commit dates (+0800). No commits on 10-08 or 10-15; Thursday's work is the 10-09 02:35 batch above.

### Fri 10-09: Org test roles and admin rebuild
- Org test roles, migration 0051 (`a3fe411`).
- Admin Organizations/Users pages rebuilt with role editing (`8bf1f20`); new admin Roles page (`30d480d`).
- Polish pass on admin, sign-off and set-password screens; invite email template (`483bdcb`).

### Sat 10-10: Role enforcement spec #2, tickets #3–#14
- Agent docs (issue tracker, triage labels, domain) and skills lock (`fbe205b`).
- Bind test cases, test accounts and participants to org test roles, 0052–0054 (`b292bb5`).
- SQL scenario test harness for RPC/RLS behaviour (#3, `dfdfd1d`).
- Removed the retired audience field, 0055 (#5, `5d25acf`).
- Test roles became a global catalog managed from the Roles page, 0056 (#4, `cd36e5f`).
- Copy and mask test account credentials on the Overview card (#14, `b9c797c`).
- Test cases and test accounts reference the role catalog, 0057 (#6, `a94f4cc`).
- Import maps unmatched role names to the catalog (#7, `48270ea`).
- Round roster, coverage panel and per-tester copies, 0058 (#8, `5d6e26e`).

### Sun 10-11: Role enforcement finish, attachments, dashboard
- Cases-first round creation wizard (#11); strict roll-up of per-tester copies with per-tester breakdown, 0059 (#10); testers can only record results on their own copies, 0060 (#9); labels on step result buttons; roster changes in the Sync dialog, 0061 (#12).
- **Evidence attachments (spec #15, Backblaze B2), tickets #17–#22:**
  - Upload pipeline: B2 module, attachments table, draft RPCs, 0062 (#17).
  - Paperclip upload on remarks, atomic post RPC, thumbnails, 0063 (#18).
  - Paste, drag-drop, WebP compression, per-file progress, cancel/delete of drafts (#19).
  - Image lightbox, session-cached signed links, friendly unavailable message (#20).
  - Storage cleanup: deletion queue, stale drafts, admin "Clean up storage", 0064 (#21).
  - Sign-off report freezes attachments, with thumbnails and a print file list (#22).
- Dashboard: Active Iteration Table component and progress tracking (`fc1ea23`).

### Mon 10-12: Invite flow and Manual groundwork
- Invite flow verifies the token on password submit; localhost `invite.dev.html` template pointing at the dev portal.
- Manual: legacy pages moved to `/manual/guide`, manual shown to all roles, demo sidebar groups dropped (#25).

### Tue 10-13: Manual CMS (spec #24, tickets #25–#31)
- Modules tracer bullet: schema, RLS, tree, module page, New module, 0065 (#26).
- Publish/unpublish toggle (#30); content blocks with read/add/edit/delete and TOC (#27); sections with create dialog, collapsible nodes and section pages (#28); rename/delete modules and sections (#29); drag-to-reorder modules, sections and blocks, 0066 (#31).
- Module/section descriptions and typed blocks (header, icon, table, content, general), 0067–0068.
- Dashboard "Your testing" table and dismissible notice.

### Wed 10-14: Sign-off comments, CI/CD and infra
- Manual sidebar: controlled module collapsibles to stop the Base UI `defaultOpen` warning.
- Per-tester submission, iteration sections tables and sign-off comments, 0069–0072 (45 files, +2320/−725); lint fixes after.
- CI/CD:
  - Staging/prod pipeline and migration runner (#32 lockfile/`npm ci` fixes, #33 Vercel deploy).
  - Baseline schema so the repo can rebuild the database from scratch (#34).
  - dev → main promotion (#35).
  - Restricted Vercel to main and dev branches (#36).
  - Final shape (#39): Vercel owns checks and deploys; the GitHub Action only runs DB migrations.
- README tweaks (#37, #38) and local run instructions restored.

### Totals and caveats
- About 70 non-merge commits; migrations 0051–0072 added this week.
- Per your memory notes, 0061 is on dev and not click-tested; the sign-off flow (0046–0050) and the 0069–0072 sign-off comments are also unverified by click-test as far as the notes show.
- Open: #16 prod bucket and Vercel env for attachments, then close spec #15.
