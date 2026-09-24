import { createClient } from "@/lib/supabase/server";
import { getIterationsBySuiteId, type testIteration } from "./test-iterations";
import type { testCaseStatus } from "./test-cases";

export type statusCounts = Record<"total" | "passed" | "failed" | "blocked" | "inProgress" | "untested", number>;

export type signOff = {
    id: string;
    iterationName: string;
    signedOffBy: string | null;
    signedOffAt: string;
    note: string | null;
    exceptions: statusCounts;
    revokedAt: string | null;
    revokedBy: string | null;
};

export type suiteOverview = {
    testCaseCount: number;
    roles: string[];
    iterations: (testIteration & { counts: statusCounts })[];
    // Newest first; the current one (if any) has revokedAt null.
    signOffs: signOff[];
};

function countStatuses(statuses: testCaseStatus[]): statusCounts {
    return {
        total: statuses.length,
        passed: statuses.filter((s) => s === "Passed").length,
        failed: statuses.filter((s) => s === "Failed").length,
        blocked: statuses.filter((s) => s === "Blocked").length,
        inProgress: statuses.filter((s) => s === "In Progress").length,
        untested: statuses.filter((s) => s === "Untested").length,
    };
}

// sign_off_suite stores its counts with snake_case keys.
function toCounts(raw: unknown): statusCounts {
    const r = (raw ?? {}) as Record<string, number>;
    return { total: r.total ?? 0, passed: r.passed ?? 0, failed: r.failed ?? 0, blocked: r.blocked ?? 0, inProgress: r.in_progress ?? 0, untested: r.untested ?? 0 };
}

export async function getSuiteOverview(suiteId: string): Promise<suiteOverview> {
    const supabase = await createClient();
    const [iterations, casesResult, signOffsResult] = await Promise.all([
        getIterationsBySuiteId(suiteId),
        supabase
            .from("test_cases")
            .select("role_assignee, sections!inner ( test_suite_id )")
            .eq("sections.test_suite_id", suiteId),
        supabase
            .from("suite_sign_offs")
            .select(`
                id, signed_off_at, note, exceptions, revoked_at,
                iteration:test_iterations ( name ),
                signer:profiles!suite_sign_offs_signed_off_by_fkey ( full_name ),
                revoker:profiles!suite_sign_offs_revoked_by_fkey ( full_name )
            `)
            .eq("testing_suite_id", suiteId)
            .order("signed_off_at", { ascending: false }),
    ]);
    if (casesResult.error) throw casesResult.error;
    if (signOffsResult.error) throw signOffsResult.error;

    const statusesByIteration = new Map<string, testCaseStatus[]>();
    if (iterations.length > 0) {
        const { data, error } = await supabase
            .from("test_case_results")
            .select("iteration_id, status")
            .in("iteration_id", iterations.map((i) => i.id));
        if (error) throw error;
        for (const row of data) {
            statusesByIteration.set(row.iteration_id, [...(statusesByIteration.get(row.iteration_id) ?? []), row.status]);
        }
    }

    return {
        testCaseCount: casesResult.data.length,
        roles: Array.from(new Set(casesResult.data.map((c) => c.role_assignee).filter((r): r is NonNullable<typeof r> => !!r))).sort(),
        iterations: iterations.map((iteration) => ({ ...iteration, counts: countStatuses(statusesByIteration.get(iteration.id) ?? []) })),
        signOffs: signOffsResult.data.map((row) => ({
            id: row.id,
            iterationName: row.iteration?.name ?? "—",
            signedOffBy: row.signer?.full_name ?? null,
            signedOffAt: row.signed_off_at,
            note: row.note,
            exceptions: toCounts(row.exceptions),
            revokedAt: row.revoked_at,
            revokedBy: row.revoker?.full_name ?? null,
        })),
    };
}

// What the Sign Off dialog needs: whether a round is still running, and the
// latest completed round's counts (the one sign-off is based on).
export async function getSignOffContext(suiteId: string): Promise<{ hasActiveIteration: boolean; latestCompleted: { name: string; counts: statusCounts } | null }> {
    const supabase = await createClient();
    const iterations = await getIterationsBySuiteId(suiteId);
    const latestCompleted = iterations.find((i) => i.status === "completed") ?? null;
    let counts = countStatuses([]);
    if (latestCompleted) {
        const { data, error } = await supabase.from("test_case_results").select("status").eq("iteration_id", latestCompleted.id);
        if (error) throw error;
        counts = countStatuses(data.map((row) => row.status));
    }
    return {
        hasActiveIteration: iterations.some((i) => i.status === "in_progress"),
        latestCompleted: latestCompleted ? { name: latestCompleted.name, counts } : null,
    };
}
