# UAT Portal: Project Overview

## 1. Overview

**What it is.** UAT Portal is a web app for running User Acceptance Testing (UAT) end to end in one place. A vendor team builds a *testing suite* for a client's product, testers execute it, and the client signs off on the result, all inside the portal.

**The gist.**

- A **testing suite** is organised into **sections**, and each section holds **test cases**.
- Testers run the suite in **testing rounds** (iterations). Each case gets a result (pass / fail / blocked, with remarks and evidence files).
- A suite moves through a clear lifecycle: **Draft → Ready → In Testing → For Sign-off → Signed off → Archived**.
- At the end, the portal builds a **sign-off report** from the actual results. The client issues it, then acknowledges or rejects it.
- Access is **role-based**: Admin (vendor), Internal (client staff) and External (the client's customers or testers) each see only what they need.
- Test cases can be **imported** from CSV/XLSX, evidence can be **attached** to remarks, and a **Manual** (a shared knowledge base) can be linked to suites.

**Stack.** Next.js (App Router), Supabase (Postgres, auth, row-level security), deployed on Vercel.

## 2. Problem

UAT is usually run on spreadsheets, shared documents and chat threads. That is cheap to start but breaks down quickly:

| Pain point | What happens in practice |
|---|---|
| **Scattered artifacts** | Test cases live in one file, results in copies of it, screenshots in chat, and sign-off in an email. Nobody is sure which version is current. |
| **No round history** | Re-testing overwrites old results, so you can't show what failed in round 1 and how it was fixed in round 2. |
| **Weak evidence** | Screenshots and recordings are detached from the case they prove, so a "pass" or "fail" can't be verified later. |
| **Manual reporting** | The sign-off report is assembled by hand from the spreadsheet. It is slow, error-prone and easy to bend. |
| **Unclear accountability** | No firm trail of who tested what, who approved, and whether the client accepted or rejected the outcome. |
| **Access is all-or-nothing** | Sharing a spreadsheet exposes everything to everyone, including internal notes and other clients' data. |
| **Inconsistent process** | Each project invents its own format, so quality depends on who ran it. |

**Why it matters.** UAT is the last gate before release and often the point where payment, contractual acceptance or go-live is decided. If the record is messy, disputes about "was this tested and who agreed?" are costly, releases get delayed, and defects escape to production.

## 3. Solution

UAT Portal replaces the spreadsheet-and-email workflow with a single structured system.

| Problem | How the portal addresses it |
|---|---|
| Scattered artifacts | One source of truth: suite → sections → cases → results → report, all in the same database. |
| No round history | Testing **rounds** keep each iteration's results separately, so re-tests build history instead of overwriting it. |
| Weak evidence | **Attachments** sit on the tester's remarks for a case, and a failed verdict carries its evidence. |
| Manual reporting | The **sign-off report** is generated from recorded results (objective figures first, with optional AI-assisted theme drafting that a person reviews). |
| Unclear accountability | A defined **lifecycle**: Create draft → For Sign-off → Issue → Acknowledge / Reject. Each step is a recorded state change. |
| All-or-nothing access | **Role-based access** enforced by Supabase row-level security across the three audiences. |
| Inconsistent process | A repeatable structure, **CSV/XLSX import** for existing cases, and a linked **Manual** so testers follow the same guidance. |

**How effective it is.** Effectiveness comes from structure rather than speed alone:

- **Traceable.** Every verdict is tied to a case, a round, a tester and its evidence.
- **Enforced.** The lifecycle and role rules are enforced in the database, so a suite cannot be signed off from the wrong state or by the wrong role.
- **Faster to close.** Report building and result roll-ups are automatic, which removes the hand-assembly step.
- **Auditable.** The sign-off outcome (acknowledged or rejected) lives next to the data it refers to.

> Measured figures are not yet collected. See the *Measurement plan* below for how to turn these claims into numbers.

## 4. Impact

### Old way vs. UAT Portal

| Aspect | Old way (spreadsheets, docs, chat) | With UAT Portal |
|---|---|---|
| Source of truth | Multiple files and copies | One suite record |
| Re-testing | Overwrites or duplicates sheets | Rounds with preserved history |
| Evidence | Loose screenshots in chat or email | Attached to the case remark, travels with the verdict |
| Report creation | Manual, copy-paste from the sheet | Generated from recorded results |
| Sign-off | Email thread, hard to prove | In-app Issue → Acknowledge / Reject |
| Access control | Whole file shared | Role-based, per-suite visibility |
| Onboarding a tester | Explain the sheet each time | Guided by the suite Overview, test accounts and Manual |
| Consistency across projects | Varies by author | Same structure every time |

### Expected outcomes

- **Less time spent on admin.** Less consolidating, formatting and chasing files; more time actually testing.
- **Fewer disputes.** A client acceptance backed by evidence and a recorded decision is harder to contest.
- **Better defect visibility.** Failures and their evidence are visible per round, so fix-and-retest cycles are clear.
- **Safer data sharing.** Clients and testers only see their own scope.
- **Reusable assets.** Imported cases, Overview content and the Manual carry across suites.

### Measurement plan

To prove the improvement against the old process, record a baseline on one past UAT cycle and compare it with a pilot run in the portal:

| Metric | How to measure |
|---|---|
| Time to produce the sign-off report | Hours from "testing done" to "report issued" |
| Time to set up a suite | Hours from kickoff to "Ready" (with and without import) |
| Re-test traceability | % of failed cases with evidence attached and a recorded re-test |
| Sign-off turnaround | Days from issue to acknowledge / reject |
| Defects escaped to production | Count in the first N weeks after release |
| Tester feedback | Short survey on clarity and effort |

Fill the results into this table after the pilot:

| Metric | Old way | UAT Portal | Change |
|---|---|---|---|
| Report time | _TBD_ | _TBD_ | _TBD_ |
| Suite setup time | _TBD_ | _TBD_ | _TBD_ |
| Failed cases with evidence | _TBD_ | _TBD_ | _TBD_ |
| Sign-off turnaround | _TBD_ | _TBD_ | _TBD_ |
