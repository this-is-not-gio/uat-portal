import type { testCaseStatus } from "./test-cases";
import type { iterationStatus } from "./test-iterations";

// Admin authoring view Status/Result (get_suite_case_states, migration 0021).
// Client-safe: types + labels only, the fetch lives in test-sections.ts.

// A round row the vendor took out mid-round via Sync (0036): kept with its results, out of the
// run's counts, view only for testers.
export const isRemovedFromRound = (row: { syncKind: string | null }) =>
    row.syncKind === "removed" || row.syncKind === "audience_changed";

export type caseStatus = "in_testing" | "for_testing" | "not_ready" | "tested" | "ready";

// Ordered highest priority first by the RPC, so flags[0] is the one to show.
// not_tested: never in any round while its section has been (0033); a section never in any
// round is badged as a whole instead (sectionNotTestedYet).
export type caseFlag = "incomplete" | "changed_after_testing" | "update_pending" | "skipped" | "changed_since" | "not_tested";

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
        case "not_tested": return "Not tested yet";
    }
}

// Flags for a case within one round (a round's section page), highest priority first.
// Built by getRoundCaseFlags (round-flags.ts):
//   any round        removed
//   open round       incomplete / update_pending / changed_after_testing (fix before or while testing)
//   not started      failed / blocked / skipped / tested (passed) / changed_since vs the case's last
//                    completed round, or not_tested if it's never been in one (what to tick, 0034)
//   finished round   skipped / changed_since vs this round
export type roundFlag = "incomplete" | "removed" | "update_pending" | "changed_after_testing" | "failed" | "blocked" | "skipped" | "tested" | "changed_since" | "not_tested";

// roundName: the earlier round the flag refers to; null = this round.
export type roundCaseFlag = { flag: roundFlag; roundName: string | null };

export const ROUND_FLAG_ORDER: roundFlag[] = ["incomplete", "removed", "update_pending", "changed_after_testing", "failed", "blocked", "skipped", "tested", "changed_since", "not_tested"];

export function roundFlagLabel({ flag, roundName }: roundCaseFlag): string {
    const round = roundName ? shortRoundName(roundName) : null;
    switch (flag) {
        case "incomplete": return "Incomplete · can't sync";
        case "removed": return "Removed from suite";
        case "update_pending": return "Update pending";
        case "changed_after_testing": return "Changed after testing";
        case "failed": return `Failed · ${round}`;
        case "blocked": return `Blocked · ${round}`;
        case "skipped": return round ? `Skipped · ${round}` : "Skipped";
        case "tested": return `Tested · ${round}`;
        case "changed_since": return `Changed since ${round ?? "this round"}`;
        case "not_tested": return "Not tested yet";
    }
}

// Rule 3 (0033): the suite has had rounds, but none of them included this section.
// Takes every round's sections (getSectionsByIteration) and the rounds' statuses.
export function untestedSectionSlugs(
    suiteSlugs: string[],
    rounds: { id: string; status: iterationStatus }[],
    sectionsByRound: Map<string, { slug: string; includedCount: number }[]>
): Set<string> {
    const counted = rounds.filter((round) => round.status !== "stopped");
    if (counted.length === 0) return new Set();
    const tested = new Set(
        counted.flatMap((round) => (sectionsByRound.get(round.id) ?? []).filter((s) => s.includedCount > 0).map((s) => s.slug))
    );
    return new Set(suiteSlugs.filter((slug) => !tested.has(slug)));
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
