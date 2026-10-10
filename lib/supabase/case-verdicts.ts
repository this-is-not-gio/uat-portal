import { createClient } from "@/lib/supabase/server";
import type { testCaseStatus } from "./test-cases";

// A case's verdict in one round, rolled up in the database from its testers' copies
// (get_iteration_case_verdicts, migration 0059): any Failed -> Failed, any Blocked -> Blocked,
// all Passed -> Passed, nobody started -> Untested, otherwise In Progress.
// Anything that counts cases in a round (progress, scorecards, the sign-off report) counts these
// instead of the copies.
export type caseVerdict = {
    caseKey: string;
    testCaseId: string | null;
    // null: the case across every organization the viewer can see.
    organizationId: string | null;
    verdict: testCaseStatus;
    copies: number;
    passed: number;
    failed: number;
    blocked: number;
    inProgress: number;
    untested: number;
};

export type roundVerdicts = {
    // One per case.
    overall: caseVerdict[];
    // One per case within each organization.
    byOrg: Map<string, caseVerdict[]>;
};

// Matches case_key in get_iteration_case_verdicts: a deleted case's copies have no test_case_id,
// so they are told apart by code + title.
export const caseKeyOf = (row: { testCaseId: string | null; code?: string | null; title: string }) =>
    row.testCaseId ?? `gone:${row.code ?? ""}:${row.title}`;

// The round's rolled-up verdicts. A planned round has no copies yet, so each case in its scope is
// Untested.
export async function getCaseVerdicts(iterationId: string): Promise<roundVerdicts> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_iteration_case_verdicts", { p_iteration_id: iterationId });
    if (error) throw error;

    const overall: caseVerdict[] = [];
    const byOrg = new Map<string, caseVerdict[]>();
    for (const row of data) {
        const verdict: caseVerdict = {
            caseKey: row.case_key,
            testCaseId: row.test_case_id,
            organizationId: row.organization_id,
            verdict: row.verdict,
            copies: row.copies,
            passed: row.passed,
            failed: row.failed,
            blocked: row.blocked,
            inProgress: row.in_progress,
            untested: row.untested,
        };
        if (!row.organization_id) overall.push(verdict);
        else byOrg.set(row.organization_id, [...(byOrg.get(row.organization_id) ?? []), verdict]);
    }
    if (overall.length > 0) return { overall, byOrg };

    const { data: scope, error: scopeError } = await supabase
        .from("test_case_results")
        .select("test_case_id, code, title")
        .eq("iteration_id", iterationId)
        .is("tester_id", null)
        .eq("included_in_run", true);
    if (scopeError) throw scopeError;
    return {
        overall: scope.map((row) => ({
            caseKey: caseKeyOf({ testCaseId: row.test_case_id, code: row.code, title: row.title }),
            testCaseId: row.test_case_id,
            organizationId: null,
            verdict: "Untested" as const,
            copies: 0, passed: 0, failed: 0, blocked: 0, inProgress: 0, untested: 0,
        })),
        byOrg,
    };
}

// The case statuses to count: the org's cases when given, else every case the viewer can see.
export function verdictStatuses(verdicts: roundVerdicts, orgId?: string | null): testCaseStatus[] {
    const rows = orgId ? verdicts.byOrg.get(orgId) ?? [] : verdicts.overall;
    return rows.map((row) => row.verdict);
}

// Verdict of one case, for the viewer's org when given.
export function verdictOfCase(verdicts: roundVerdicts, key: string, orgId?: string | null): testCaseStatus | null {
    const rows = orgId ? verdicts.byOrg.get(orgId) : verdicts.overall;
    return rows?.find((row) => row.caseKey === key)?.verdict ?? null;
}
