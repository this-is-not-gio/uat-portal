import { createClient } from "@/lib/supabase/server";
import type { expectedResult, preCondition, profile, testCase, testCaseStatus } from "./test-cases";
import { compareOrganizations, type organization } from "./organizations";

// not_started (planned) -> in_progress -> completed | stopped (ended early; never used for sign-off).
export type iterationStatus = "not_started" | "in_progress" | "completed" | "stopped";

// Planned or running: the one round per suite that can still be synced/scoped.
export const OPEN_ITERATION_STATUSES = ["not_started", "in_progress"] as const satisfies iterationStatus[];

export type testIteration = {
    id: string;
    name: string;
    slug: string;
    iterationNumber: number;
    status: iterationStatus;
    startedAt: string;
    completedAt: string | null;
    plannedEndDate: string | null;
};

// How a row got into (or was changed within) a running iteration by vendor sync.
// removed / audience_changed: taken out mid-round by Sync, see isRemovedFromRound (0036).
export type syncKind = "added" | "updated" | "force_reset" | "removed" | "audience_changed";

// One rostered tester (0058): fixed at Start with their catalog role and org. Each gets their
// own copy of every in-scope case of their role. dropped: reserved for roster sync (#12).
export type iterationTester = {
    userId: string;
    fullName: string | null;
    testRole: { id: string; name: string };
    status: "active" | "dropped";
};

// An org taking part in a round: its rostered testers grouped by org. Submission is still per
// org (stamped on every active tester). Every query below takes an optional `orgId`: omit it to
// get all rows, pass it for a single org's view.
// roles: catalog roles its testers hold. withdrawnAt: last withdrawal, cleared on resubmit (0031).
export type iterationParticipant = {
    organization: organization;
    roles: { id: string; name: string }[];
    testers: iterationTester[];
    submittedAt: string | null;
    withdrawnAt: string | null;
};

// What a round's scope needs (get_iteration_coverage / get_round_coverage, 0058): the roles its
// cases need with the orgs and users holding each (ticked unless staff unticked them), and what
// blocks Start.
export type coverageUser = { userId: string; fullName: string | null; ticked: boolean };
export type coverageOrg = { organizationId: string; name: string; type: organization["type"]; users: coverageUser[] };
export type coverageRole = { testRoleId: string; name: string; caseCount: number; availableCount: number; tickedCount: number; orgs: coverageOrg[] };
export type roundCoverage = {
    roles: coverageRole[];
    casesWithoutRole: { testCaseId: string; code: string | null; title: string }[];
    rolesWithoutUsers: { testRoleId: string; name: string }[];
    rolesWithoutTesters: { testRoleId: string; name: string }[];
    canStart: boolean;
};

// Results wiped by a vendor force refresh, kept as a frozen copy.
export type resultArchive = {
    id: string;
    reason: string;
    archivedAt: string;
    archivedBy?: string;
    snapshot: {
        status: testCaseStatus;
        steps: { step: string; status: string; remarks: { remark: string; created_at: string }[] }[];
    };
};

// A difference between the running iteration and the live suite.
// added: live case not in the round; changed: edited since it was copied;
// removed: copied case no longer exists live, or its role is no longer the one its testers
// were rostered for. One row per case (sync applies to every tester's copy, 0058).
// hasResults (any copy has results) needs a vendor force refresh.
// incomplete (changed rows only): the live case has test_case_issues, so
// neither sync nor force refresh will copy it until it's fixed.
export type iterationChange = {
    change: "added" | "changed" | "removed";
    testCaseId: string | null;
    testCaseResultId: string | null;
    code: string | null;
    title: string;
    hasResults: boolean;
    incomplete: boolean;
    // removed rows only: the case still exists but now belongs to another role.
    audienceChanged: boolean;
};

// A test case as it was frozen into one iteration. `id` is the
// test_case_results id (unique per iteration); `testCaseId` points back to
// the live test case and is null once that case has been deleted.
export type testResultRow = testCase & {
    testCaseId: string | null;
    // The tester whose copy this is and their org; both null on a planned round's scope rows.
    testerId: string | null;
    organizationId: string | null;
    sectionName: string | null;
    sectionSlug: string | null;
    executor?: profile;
    completedAt: string | null;
    // true when a tester set the case result by hand instead of it being derived from steps.
    statusOverridden: boolean;
    // Whether this case is currently checked to be tested in this round.
    includedInRun: boolean;
    syncKind: syncKind | null;
    // Result of the same live test case in the previous iteration, if it was in it.
    previousStatus: testCaseStatus | null;
    // Newest first.
    archives: resultArchive[];
    // Set by the Test Results tab from getIterationChanges while the round runs.
    pendingChange?: iterationChange["change"];
};

const ITERATION_SELECT = "id, name, slug, iteration_number, status, started_at, completed_at, planned_end_date" as const;

const RESULT_SELECT = `
  id,
  test_case_id,
  tester_id,
  organization_id,
  code,
  title,
  section_name,
  section_slug,
  section_order,
  order_index,
  test_role_id,
  test_role:test_roles ( name ),
  priority,
  preconditions,
  status,
  status_overridden,
  included_in_run,
  sync_kind,
  completed_at,
  executor:profiles!test_case_results_executed_by_fkey ( id, full_name, role ),
  test_case_result_archives ( id, reason, archived_at, snapshot, archiver:profiles ( full_name ) ),
  test_step_results (
    id,
    step,
    order_index,
    status,
    expected_results,
    test_remarks ( id, remark, created_at, profile:profiles ( id, full_name, role ) )
  )
` as const;

type IterationRow = {
    id: string;
    name: string;
    slug: string;
    iteration_number: number;
    status: iterationStatus;
    started_at: string;
    completed_at: string | null;
    planned_end_date: string | null;
};

function toIteration(row: IterationRow): testIteration {
    return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        iterationNumber: row.iteration_number,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        plannedEndDate: row.planned_end_date,
    };
}

// test_case_id -> status in the iteration just before this one, for the "Last round" badge.
async function getPreviousRoundStatuses(iterationId: string, orgId?: string): Promise<Map<string, testCaseStatus>> {
    const supabase = await createClient();
    const { data: current, error: currentError } = await supabase
        .from("test_iterations")
        .select("testing_suite_id, iteration_number")
        .eq("id", iterationId)
        .single();
    if (currentError) throw currentError;

    const { data: previous, error: previousError } = await supabase
        .from("test_iterations")
        .select("id")
        .eq("testing_suite_id", current.testing_suite_id)
        .lt("iteration_number", current.iteration_number)
        .order("iteration_number", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (previousError) throw previousError;
    if (!previous) return new Map();

    let rowsQuery = supabase
        .from("test_case_results")
        .select("test_case_id, status")
        .eq("iteration_id", previous.id)
        .not("test_case_id", "is", null);
    if (orgId) rowsQuery = rowsQuery.eq("organization_id", orgId);
    const { data: rows, error: rowsError } = await rowsQuery;
    if (rowsError) throw rowsError;

    return new Map(rows.map((row) => [row.test_case_id as string, row.status]));
}

// Newest first, so the dropdown and the default selection lead with the latest round.
export async function getIterationsBySuiteId(testSuiteId: string): Promise<testIteration[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_iterations")
        .select(ITERATION_SELECT)
        .eq("testing_suite_id", testSuiteId)
        .order("iteration_number", { ascending: false });

    if (error) throw error;
    return data.map(toIteration);
}

// The suite's open round (not_started or in_progress) — at most one exists.
export async function getActiveIteration(testSuiteId: string): Promise<testIteration | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_iterations")
        .select(ITERATION_SELECT)
        .eq("testing_suite_id", testSuiteId)
        .in("status", OPEN_ITERATION_STATUSES)
        .maybeSingle();

    if (error) throw error;
    return data ? toIteration(data) : null;
}

// resultIds: every test_case_results row in this section for this
// iteration — the ids apply_iteration_sync's `remove` argument needs to pull
// the whole section back out of the round (it rejects rows with results).
// includedCount/totalCount count each test case once, even though every org has its own row.
// testedCount: included cases with a Passed/Failed/Blocked result. Scoped to orgId's rows
// when given; otherwise a case counts once every participant has tested it.
export type iterationSection = { slug: string; name: string; includedCount: number; totalCount: number; testedCount: number; resultIds: string[] };

// Lightweight per-iteration section list — just enough to build the sidebar's
// Iteration → Section tree without loading every iteration's full result set
// (getIterationResults) up front.
export async function getSectionsByIteration(testSuiteId: string, orgId?: string): Promise<Map<string, iterationSection[]>> {
    const supabase = await createClient();
    const { data: iterations, error: iterationsError } = await supabase
        .from("test_iterations")
        .select("id")
        .eq("testing_suite_id", testSuiteId);
    if (iterationsError) throw iterationsError;
    if (!iterations.length) return new Map();

    let query = supabase
        .from("test_case_results")
        .select("id, iteration_id, test_case_id, section_slug, section_name, section_order, included_in_run, status")
        .in("iteration_id", iterations.map((i) => i.id));
    if (orgId) query = query.eq("organization_id", orgId);
    const { data, error } = await query.order("section_order", { ascending: true });
    if (error) throw error;

    const map = new Map<string, iterationSection[]>();
    const caseIds = new Map<iterationSection, { all: Set<string>; included: Set<string>; untested: Set<string> }>();
    for (const row of data) {
        if (!row.section_slug) continue;
        const sections = map.get(row.iteration_id) ?? [];
        let section = sections.find((s) => s.slug === row.section_slug);
        if (!section) {
            section = { slug: row.section_slug, name: row.section_name ?? row.section_slug, includedCount: 0, totalCount: 0, testedCount: 0, resultIds: [] };
            sections.push(section);
            caseIds.set(section, { all: new Set(), included: new Set(), untested: new Set() });
        }
        // Rows of a since-deleted case have no test_case_id; count those rows on their own.
        const caseKey = row.test_case_id ?? row.id;
        const ids = caseIds.get(section)!;
        ids.all.add(caseKey);
        if (row.included_in_run) {
            ids.included.add(caseKey);
            if (row.status !== "Passed" && row.status !== "Failed" && row.status !== "Blocked") ids.untested.add(caseKey);
        }
        section.resultIds.push(row.id);
        map.set(row.iteration_id, sections);
    }
    for (const [section, ids] of caseIds) {
        section.totalCount = ids.all.size;
        section.includedCount = ids.included.size;
        section.testedCount = ids.included.size - ids.untested.size;
    }
    return map;
}

export type iterationTestSection = { slug: string; name: string; testCases: testResultRow[] };

// Section -> its test cases, as they were snapshotted into this one
// iteration (test_case_results) — same grouping shape as
// getTestSectionsByTestSuiteId's testSection, but for one round instead of
// the live suite. Callers that only need status/results should reach for
// getIterationResults directly; this is for screens that just need what's
// included (Test Cases tab's iteration browser).
export async function getIterationTestSections(iterationId: string, orgId?: string): Promise<iterationTestSection[]> {
    const results = await getIterationResults(iterationId, orgId);
    const bySlug = new Map<string, iterationTestSection>();
    for (const row of results) {
        if (!row.sectionSlug) continue;
        const section = bySlug.get(row.sectionSlug) ?? { slug: row.sectionSlug, name: row.sectionName ?? row.sectionSlug, testCases: [] };
        section.testCases.push(row);
        bySlug.set(row.sectionSlug, section);
    }
    return [...bySlug.values()];
}

// Which live test cases this iteration already has a snapshot for — used to
// exclude them from "add more test cases" pickers so the same case can't be
// added twice (apply_iteration_sync already no-ops on that, this just keeps
// the picker's counts honest).
export async function getIterationTestCaseIds(iterationId: string, orgId?: string): Promise<Set<string>> {
    const supabase = await createClient();
    let query = supabase
        .from("test_case_results")
        .select("test_case_id")
        .eq("iteration_id", iterationId);
    if (orgId) query = query.eq("organization_id", orgId);
    const { data, error } = await query;
    if (error) throw error;
    return new Set(data.map((row) => row.test_case_id).filter((id): id is string => !!id));
}

// Per-case outcome from the most recent iteration (whichever has the highest
// iteration_number, in_progress or completed) — this is what the Test Cases
// tab's status column shows, computed at read time rather than a physical
// column so test_case_results stays the single source of truth. Cases not
// snapshotted into that round (e.g. added after it started) are absent from
// the map, so callers should fall back to the case's own default status.
export async function getLatestIterationCaseStatuses(testSuiteId: string, orgId?: string): Promise<Map<string, testCaseStatus>> {
    const supabase = await createClient();
    const { data: latest, error: latestError } = await supabase
        .from("test_iterations")
        .select("id, status")
        .eq("testing_suite_id", testSuiteId)
        .order("iteration_number", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (latestError) throw latestError;
    if (!latest) return new Map();

    let query = supabase
        .from("test_case_results")
        .select("test_case_id, status")
        .eq("iteration_id", latest.id);
    if (orgId) query = query.eq("organization_id", orgId);
    const { data, error } = await query;
    if (error) throw error;

    // Being snapshotted into a currently-running round is itself a status:
    // a case reads as "In Progress" as soon as it's included, even before
    // any of its steps have been recorded, rather than sitting at "Untested"
    // until someone touches it. A finished round's cases keep their real,
    // final outcome (including a genuinely untested one).
    return new Map(
        data
            .filter((row) => row.test_case_id)
            .map((row) => [
                row.test_case_id as string,
                latest.status === "in_progress" && row.status === "Untested" ? "In Progress" : row.status,
            ])
    );
}

export async function getIterationResults(iterationId: string, orgId?: string): Promise<testResultRow[]> {
    const supabase = await createClient();
    let query = supabase.from("test_case_results").select(RESULT_SELECT).eq("iteration_id", iterationId);
    if (orgId) query = query.eq("organization_id", orgId);
    const [{ data, error }, previousStatuses] = await Promise.all([
        query
            .order("section_order", { ascending: true })
            .order("order_index", { ascending: true })
            .order("order_index", { referencedTable: "test_step_results", ascending: true })
            .order("created_at", { referencedTable: "test_step_results.test_remarks", ascending: true }),
        getPreviousRoundStatuses(iterationId, orgId),
    ]);

    if (error) throw error;

    return data.map((row) => ({
        id: row.id,
        testCaseId: row.test_case_id,
        testerId: row.tester_id,
        organizationId: row.organization_id,
        code: row.code,
        title: row.title,
        status: row.status,
        testRoleId: row.test_role_id ?? undefined,
        roleAssignee: row.test_role?.name,
        priority: row.priority ?? undefined,
        sectionName: row.section_name,
        sectionSlug: row.section_slug,
        completedAt: row.completed_at,
        executor: row.executor ?? undefined,
        statusOverridden: row.status_overridden,
        includedInRun: row.included_in_run,
        syncKind: row.sync_kind as syncKind | null,
        previousStatus: row.test_case_id ? previousStatuses.get(row.test_case_id) ?? null : null,
        archives: row.test_case_result_archives
            .map((archive) => ({
                id: archive.id,
                reason: archive.reason,
                archivedAt: archive.archived_at,
                archivedBy: archive.archiver?.full_name,
                // Written by force_refresh_case_result in this shape.
                snapshot: archive.snapshot as resultArchive["snapshot"],
            }))
            .sort((a, b) => b.archivedAt.localeCompare(a.archivedAt)),
        // Snapshot jsonb columns are written by start/sync_iteration in this exact shape.
        preconditions: row.preconditions as preCondition[],
        stepsToExecute: row.test_step_results.map((step) => ({
            id: step.id,
            step: step.step,
            status: step.status,
            expectedResults: step.expected_results as expectedResult[],
            remarks: step.test_remarks.map((remark) => ({
                id: remark.id,
                remark: remark.remark,
                author: remark.profile ?? undefined,
                created_at: remark.created_at,
            })),
        })),
    }));
}

// Testers only get the cases their org has copies of (the RPC filters them).
export async function getIterationChanges(iterationId: string): Promise<iterationChange[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_iteration_changes", { p_iteration_id: iterationId });
    if (error) throw error;
    return data.map((row) => ({
        change: row.change as iterationChange["change"],
        testCaseId: row.test_case_id,
        testCaseResultId: row.test_case_result_id,
        code: row.code,
        title: row.title,
        hasResults: row.has_results,
        incomplete: row.incomplete,
        audienceChanged: row.audience_changed,
    }));
}

// Who takes part in this round (its roster grouped by org), in compareOrganizations order.
// Empty until the round starts. An org counts as submitted once all its active testers have.
export async function getIterationParticipants(iterationId: string): Promise<iterationParticipant[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("iteration_testers")
        .select("user_id, status, submitted_at, withdrawn_at, organization:organizations ( id, name, type ), test_role:test_roles ( id, name ), profile:profiles ( full_name )")
        .eq("iteration_id", iterationId);
    if (error) throw error;

    const byOrg = new Map<string, { organization: organization; rows: typeof data }>();
    for (const row of data) {
        const entry = byOrg.get(row.organization.id) ?? { organization: row.organization, rows: [] };
        entry.rows.push(row);
        byOrg.set(row.organization.id, entry);
    }
    const latest = (values: (string | null)[]) => values.filter((v): v is string => !!v).sort().at(-1) ?? null;
    return [...byOrg.values()]
        .map(({ organization, rows }) => {
            const active = rows.filter((r) => r.status === "active");
            const roles = new Map(rows.map((r) => [r.test_role.id, r.test_role]));
            return {
                organization,
                roles: [...roles.values()].sort((a, b) => a.name.localeCompare(b.name)),
                testers: rows
                    .map((r) => ({ userId: r.user_id, fullName: r.profile.full_name, testRole: r.test_role, status: r.status as iterationTester["status"] }))
                    .sort((a, b) => (a.fullName ?? "").localeCompare(b.fullName ?? "")),
                submittedAt: active.length > 0 && active.every((r) => r.submitted_at) ? latest(active.map((r) => r.submitted_at)) : null,
                withdrawnAt: latest(rows.map((r) => r.withdrawn_at)),
            };
        })
        .sort((a, b) => compareOrganizations(a.organization, b.organization));
}

// Coverage of a planned round's scope (staff only).
export async function getIterationCoverage(iterationId: string): Promise<roundCoverage> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_iteration_coverage", { p_iteration_id: iterationId });
    if (error) throw error;
    // Built by round_coverage in this shape.
    return data as unknown as roundCoverage;
}

// One row per running round, for the admin dashboard's Active rounds card.
// tested/included count result rows (one per case per org), so a case shared by
// three orgs counts three times — matches the work actually left to do.
export type activeRound = {
    suiteName: string;
    suiteSlug: string;
    suiteCode: string | null;
    iteration: testIteration;
    testedCount: number;
    includedCount: number;
    // Included rows currently Failed or Blocked, for the Needs attention card.
    failedCount: number;
    submittedOrgs: number;
    totalOrgs: number;
};

// An org is submitted once every active tester of it has submitted.
function orgSubmissionCounts(testers: { organization_id: string; status: string; submitted_at: string | null }[]): { submittedOrgs: number; totalOrgs: number } {
    const done = new Map<string, boolean>();
    for (const t of testers) {
        if (t.status !== "active") continue;
        done.set(t.organization_id, (done.get(t.organization_id) ?? true) && !!t.submitted_at);
    }
    return { submittedOrgs: [...done.values()].filter(Boolean).length, totalOrgs: done.size };
}

export async function getActiveRounds(): Promise<activeRound[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_iterations")
        .select(`${ITERATION_SELECT}, testing_suites ( name, slug, code ), iteration_testers ( organization_id, status, submitted_at )`)
        .eq("status", "in_progress")
        .order("planned_end_date", { ascending: true, nullsFirst: false });
    if (error) throw error;

    // ponytail: three head counts per round; fine for a handful of running rounds, move to an RPC if it grows.
    return Promise.all(data.map(async (row) => {
        const included = () => supabase.from("test_case_results").select("id", { count: "exact", head: true })
            .eq("iteration_id", row.id).eq("included_in_run", true);
        const counts = await Promise.all([
            included(),
            included().in("status", ["Passed", "Failed", "Blocked"]),
            included().in("status", ["Failed", "Blocked"]),
        ]);
        const countError = counts.find((c) => c.error)?.error;
        if (countError) throw countError;
        const [includedCount, testedCount, failedCount] = counts.map((c) => c.count ?? 0);

        return {
            suiteName: row.testing_suites.name,
            suiteSlug: row.testing_suites.slug,
            suiteCode: row.testing_suites.code,
            iteration: toIteration(row),
            testedCount,
            includedCount,
            failedCount,
            ...orgSubmissionCounts(row.iteration_testers),
        };
    }));
}

// The latest completed round of each in_testing / for_sign_off suite that hasn't been issued for sign-off yet
// (a draft still counts as not issued): the vendor's "ready to issue" list. Suites with a newer round already running are skipped
// by the caller, since that round supersedes this one.
export type roundAwaitingSignOff = { suiteName: string; suiteSlug: string; suiteCode: string | null; iteration: testIteration };

export async function getRoundsAwaitingSignOff(): Promise<roundAwaitingSignOff[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_iterations")
        .select(`${ITERATION_SELECT}, testing_suite_id, testing_suites!inner ( name, slug, code, status ), suite_sign_offs ( status )`)
        .eq("status", "completed")
        .in("testing_suites.status", ["in_testing", "for_sign_off"])
        .order("iteration_number", { ascending: false });
    if (error) throw error;

    const latest = new Map<string, (typeof data)[number]>();
    for (const row of data) if (!latest.has(row.testing_suite_id)) latest.set(row.testing_suite_id, row);
    return [...latest.values()]
        .filter((row) => !row.suite_sign_offs.some((s) => s.status === "issued" || s.status === "acknowledged"))
        .map((row) => ({ suiteName: row.testing_suites.name, suiteSlug: row.testing_suites.slug, suiteCode: row.testing_suites.code, iteration: toIteration(row) }));
}

// Issued sign-offs the client hasn't acknowledged or rejected yet.
export type signOffAwaitingAck = { id: string; suiteName: string; suiteSlug: string; iterationName: string | null; signedOffAt: string };

export async function getSignOffsAwaitingAck(): Promise<signOffAwaitingAck[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("suite_sign_offs")
        .select("id, signed_off_at, suite:testing_suites!inner ( name, slug ), iteration:test_iterations ( name )")
        .eq("status", "issued")
        .order("signed_off_at", { ascending: true });
    if (error) throw error;
    return data.map((row) => ({ id: row.id, suiteName: row.suite.name, suiteSlug: row.suite.slug, iterationName: row.iteration?.name ?? null, signedOffAt: row.signed_off_at }));
}

// Latest executed results across every round, newest first, for the dashboard's Recent activity card.
export type recentResult = {
    id: string;
    code: string | null;
    title: string;
    status: testCaseStatus;
    completedAt: string;
    executorName: string | null;
    organizationName: string | null;
    iterationName: string;
    suiteName: string;
    suiteSlug: string;
};

export async function getRecentResults(limit = 10): Promise<recentResult[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_case_results")
        .select(`
            id, code, title, status, completed_at,
            executor:profiles!test_case_results_executed_by_fkey ( full_name ),
            organization:organizations ( name ),
            iteration:test_iterations!inner ( name, suite:testing_suites!inner ( name, slug ) )
        `)
        .not("completed_at", "is", null)
        .order("completed_at", { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data.map((row) => ({
        id: row.id,
        code: row.code,
        title: row.title,
        status: row.status,
        completedAt: row.completed_at as string,
        executorName: row.executor?.full_name ?? null,
        organizationName: row.organization?.name ?? null,
        iterationName: row.iteration.name,
        suiteName: row.iteration.suite.name,
        suiteSlug: row.iteration.suite.slug,
    }));
}
