import { createClient } from "@/lib/supabase/server";
import { getIterationChanges, type testIteration, type testResultRow } from "./test-iterations";
import { getSuiteCaseStates } from "./test-sections";
import { ROUND_FLAG_ORDER, type roundCaseFlag, type roundFlag } from "./case-states";

type roundHistory = { lastRoundName: string | null; lastResult: string | null; changedSince: boolean };

// Each case's latest completed round before this one (0034), for a round that hasn't started.
async function getRoundCaseHistory(iterationId: string): Promise<Map<string, roundHistory>> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_round_case_history", { p_iteration_id: iterationId });
    if (error) throw error;
    return new Map(data.map((row) => [row.test_case_id, { lastRoundName: row.last_round_name, lastResult: row.last_result, changedSince: row.changed_since }]));
}

// Flags for each case in one round, keyed like the iteration table's rows (testCaseId ?? result id).
// Warnings only apply to ticked cases. A not-started round's history flags also cover unticked
// ones, since those are what the tester is deciding whether to tick.
export async function getRoundCaseFlags(iteration: testIteration, rows: testResultRow[], testSuiteId: string): Promise<Record<string, roundCaseFlag[]>> {
    const open = iteration.status === "not_started" || iteration.status === "in_progress";
    const planning = iteration.status === "not_started";
    const [changes, caseStates, history] = await Promise.all([
        getIterationChanges(iteration.id),
        // Incomplete only matters while the round can still sync.
        open ? getSuiteCaseStates(testSuiteId) : Promise.resolve(null),
        planning ? getRoundCaseHistory(iteration.id) : Promise.resolve(null),
    ]);

    const keyOf = (row: testResultRow) => row.testCaseId ?? row.id;
    const included = rows.filter((row) => row.includedInRun);
    const keyByResultId = new Map(included.map((row) => [row.id, keyOf(row)]));
    const flags = new Map<string, Map<roundFlag, string | null>>();
    const add = (key: string, flag: roundFlag, roundName: string | null = null) =>
        flags.set(key, (flags.get(key) ?? new Map()).set(flag, roundName));

    for (const change of changes) {
        const key = change.testCaseResultId ? keyByResultId.get(change.testCaseResultId) : undefined;
        if (!key || change.change === "added") continue;
        if (change.change === "removed") add(key, "removed");
        else if (!open) add(key, "changed_since");
        else add(key, iteration.status === "in_progress" && change.hasResults ? "changed_after_testing" : "update_pending");
    }

    if (caseStates) {
        for (const row of included) {
            if (row.testCaseId && caseStates.get(row.testCaseId)?.flags.includes("incomplete")) add(keyOf(row), "incomplete");
        }
    }

    if (history) {
        for (const row of rows) {
            if (!row.testCaseId) continue;
            const past = history.get(row.testCaseId);
            if (!past?.lastResult) {
                add(row.testCaseId, "not_tested");
                continue;
            }
            if (past.lastResult === "Failed") add(row.testCaseId, "failed", past.lastRoundName);
            else if (past.lastResult === "Blocked") add(row.testCaseId, "blocked", past.lastRoundName);
            else if (past.lastResult === "Untested") add(row.testCaseId, "skipped", past.lastRoundName);
            else add(row.testCaseId, "tested", past.lastRoundName);
            if (past.changedSince) add(row.testCaseId, "changed_since", past.lastRoundName);
        }
    }

    // A finished round where no org got a result for the case.
    if (iteration.status === "completed") {
        const tested = new Map<string, boolean>();
        for (const row of included) {
            const hasResult = row.status !== "Untested" && row.status !== "In Progress";
            tested.set(keyOf(row), (tested.get(keyOf(row)) ?? false) || hasResult);
        }
        for (const [key, anyResult] of tested) if (!anyResult) add(key, "skipped");
    }

    return Object.fromEntries(
        [...flags].map(([key, set]) => [key, ROUND_FLAG_ORDER.filter((flag) => set.has(flag)).map((flag) => ({ flag, roundName: set.get(flag) ?? null }))])
    );
}
