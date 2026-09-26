import { createClient } from "@/lib/supabase/server";
import type { expectedResult, preCondition, profile, testCase, testCaseStatus } from "./test-cases";

export type iterationStatus = "in_progress" | "completed";

export type testIteration = {
    id: string;
    name: string;
    slug: string;
    label: string | null;
    iterationNumber: number;
    status: iterationStatus;
    startedAt: string;
    completedAt: string | null;
    plannedEndDate: string | null;
};

// How a row got into (or was changed within) a running iteration by vendor sync.
export type syncKind = "added" | "updated" | "force_reset";

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
// removed: copied case no longer exists live. hasResults rows are never
// refreshed/removed by sync (only a vendor force refresh resets them).
export type iterationChange = {
    change: "added" | "changed" | "removed";
    testCaseId: string | null;
    testCaseResultId: string | null;
    code: string | null;
    title: string;
    hasResults: boolean;
};

// A test case as it was frozen into one iteration. `id` is the
// test_case_results id (unique per iteration); `testCaseId` points back to
// the live test case and is null once that case has been deleted.
export type testResultRow = testCase & {
    testCaseId: string | null;
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

const ITERATION_SELECT = "id, name, slug, label, iteration_number, status, started_at, completed_at, planned_end_date" as const;

const RESULT_SELECT = `
  id,
  test_case_id,
  code,
  title,
  section_name,
  section_slug,
  section_order,
  order_index,
  role_assignee,
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
    label: string | null;
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
        label: row.label,
        iterationNumber: row.iteration_number,
        status: row.status,
        startedAt: row.started_at,
        completedAt: row.completed_at,
        plannedEndDate: row.planned_end_date,
    };
}

// test_case_id -> status in the iteration just before this one, for the "Last round" badge.
async function getPreviousRoundStatuses(iterationId: string): Promise<Map<string, testCaseStatus>> {
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

    const { data: rows, error: rowsError } = await supabase
        .from("test_case_results")
        .select("test_case_id, status")
        .eq("iteration_id", previous.id)
        .not("test_case_id", "is", null);
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

export async function getActiveIteration(testSuiteId: string): Promise<testIteration | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_iterations")
        .select(ITERATION_SELECT)
        .eq("testing_suite_id", testSuiteId)
        .eq("status", "in_progress")
        .maybeSingle();

    if (error) throw error;
    return data ? toIteration(data) : null;
}

// resultIds: every test_case_results row in this section for this
// iteration — the ids apply_iteration_sync's `remove` argument needs to pull
// the whole section back out of the round (it rejects rows with results).
export type iterationSection = { slug: string; name: string; includedCount: number; resultIds: string[] };

// Lightweight per-iteration section list — just enough to build the sidebar's
// Iteration → Section tree without loading every iteration's full result set
// (getIterationResults) up front.
export async function getSectionsByIteration(testSuiteId: string): Promise<Map<string, iterationSection[]>> {
    const supabase = await createClient();
    const { data: iterations, error: iterationsError } = await supabase
        .from("test_iterations")
        .select("id")
        .eq("testing_suite_id", testSuiteId);
    if (iterationsError) throw iterationsError;
    if (!iterations.length) return new Map();

    const { data, error } = await supabase
        .from("test_case_results")
        .select("id, iteration_id, section_slug, section_name, section_order, included_in_run")
        .in("iteration_id", iterations.map((i) => i.id))
        .order("section_order", { ascending: true });
    if (error) throw error;

    const map = new Map<string, iterationSection[]>();
    for (const row of data) {
        if (!row.section_slug) continue;
        const sections = map.get(row.iteration_id) ?? [];
        let section = sections.find((s) => s.slug === row.section_slug);
        if (!section) {
            section = { slug: row.section_slug, name: row.section_name ?? row.section_slug, includedCount: 0, resultIds: [] };
            sections.push(section);
        }
        if (row.included_in_run) section.includedCount += 1;
        section.resultIds.push(row.id);
        map.set(row.iteration_id, sections);
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
export async function getIterationTestSections(iterationId: string): Promise<iterationTestSection[]> {
    const results = await getIterationResults(iterationId);
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
export async function getIterationTestCaseIds(iterationId: string): Promise<Set<string>> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_case_results")
        .select("test_case_id")
        .eq("iteration_id", iterationId);
    if (error) throw error;
    return new Set(data.map((row) => row.test_case_id).filter((id): id is string => !!id));
}

// Per-case outcome from the most recent iteration (whichever has the highest
// iteration_number, in_progress or completed) — this is what the Test Cases
// tab's status column shows, computed at read time rather than a physical
// column so test_case_results stays the single source of truth. Cases not
// snapshotted into that round (e.g. added after it started) are absent from
// the map, so callers should fall back to the case's own default status.
export async function getLatestIterationCaseStatuses(testSuiteId: string): Promise<Map<string, testCaseStatus>> {
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

    const { data, error } = await supabase
        .from("test_case_results")
        .select("test_case_id, status")
        .eq("iteration_id", latest.id);
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

export async function getIterationResults(iterationId: string): Promise<testResultRow[]> {
    const supabase = await createClient();
    const [{ data, error }, previousStatuses] = await Promise.all([
        supabase
            .from("test_case_results")
            .select(RESULT_SELECT)
            .eq("iteration_id", iterationId)
            .order("section_order", { ascending: true })
            .order("order_index", { ascending: true })
            .order("order_index", { referencedTable: "test_step_results", ascending: true })
            .order("created_at", { referencedTable: "test_step_results.test_remarks", ascending: true }),
        getPreviousRoundStatuses(iterationId),
    ]);

    if (error) throw error;

    return data.map((row) => ({
        id: row.id,
        testCaseId: row.test_case_id,
        code: row.code,
        title: row.title,
        status: row.status,
        roleAssignee: row.role_assignee ?? undefined,
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
    }));
}
