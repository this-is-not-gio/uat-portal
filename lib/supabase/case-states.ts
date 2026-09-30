import type { testCaseStatus } from "./test-cases";
import type { iterationStatus } from "./test-iterations";

// Admin authoring view Status/Result (get_suite_case_states, migration 0021).
// Client-safe: types + labels only, the fetch lives in test-sections.ts.

export type caseStatus = "in_testing" | "for_testing" | "not_ready" | "tested" | "ready";

// Ordered highest priority first by the RPC, so flags[0] is the one to show.
export type caseFlag = "incomplete" | "changed_after_testing" | "update_pending" | "skipped" | "changed_since" | "new";

// Rolled up across orgs; null = never executed ("—").
export type caseResult = "Passed" | "Failed" | "Blocked" | "In progress" | "Untested";

export type caseOrgResult = {
    organizationId: string;
    organizationName: string;
    result: testCaseStatus;
    hasResults: boolean;
    // Live case edited since this org's snapshot.
    changed: boolean;
};

export type caseState = {
    status: caseStatus;
    flags: caseFlag[];
    result: caseResult | null;
    // Round the result comes from: the running round when In testing, else the latest completed one.
    resultRoundName: string | null;
    // The suite's running/planned round, for the "New · not in UAT 0X" flag.
    openRoundName: string | null;
    perOrg: caseOrgResult[];
};

export const CASE_STATUS_LABELS: Record<caseStatus, string> = {
    in_testing: "In testing",
    for_testing: "For Testing",
    not_ready: "Not ready",
    tested: "Tested",
    ready: "Ready",
};

// "User Acceptance Test 03" → "UAT 03"; other names pass through.
export function shortRoundName(name: string | null): string {
    if (!name) return "";
    const match = name.match(/^User Acceptance Test\s+(\d+)$/i);
    return match ? `UAT ${match[1].padStart(2, "0")}` : name;
}

export function caseFlagLabel(flag: caseFlag, state: caseState): string {
    const lastRound = shortRoundName(state.resultRoundName);
    switch (flag) {
        case "incomplete": return "Incomplete · can't sync";
        case "changed_after_testing": return "Changed after testing";
        case "update_pending": return "Update pending";
        case "skipped": return `Skipped · ${lastRound}`;
        case "changed_since": return `Changed since ${lastRound}`;
        case "new": return `New · not in ${shortRoundName(state.openRoundName)}`;
    }
}

// Result text as the spec words it: "Passed · UAT 02", "Untested · UAT 02", "—".
export function caseResultLabel(state: caseState): string {
    if (!state.result) return "—";
    if (state.status === "in_testing") return state.result;
    return `${state.result} · ${shortRoundName(state.resultRoundName)}`;
}

// Round status as shown in the sidebars (Admin iteration tree, tester Rounds panel).
export const ROUND_STATUS_LABELS: Record<iterationStatus, string> = {
    not_started: "Not started",
    in_progress: "In progress",
    completed: "Finished",
    stopped: "Stopped",
};
