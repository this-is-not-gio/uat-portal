import { createClient } from "@/lib/supabase/server";
import { getIterationParticipants, getIterationsBySuiteId, type iterationParticipant, type testIteration } from "./test-iterations";
import type { organization } from "./organizations";
import type { testCaseStatus } from "./test-cases";
import { getCaseVerdicts, verdictStatuses } from "./case-verdicts";
import type { Database } from "./database.types";
import type { ThemeInput } from "@/lib/report/sign-off-remarks";
import type { ReportSection } from "@/lib/report/report-details";

export type statusCounts = Record<"total" | "passed" | "failed" | "blocked" | "inProgress" | "untested", number>;

// drafting (vendor only) → issued → acknowledged | rejected; withdrawn = superseded by a newer round (0047).
export type signOffState = Database["public"]["Enums"]["sign_off_status"];

export type signOff = {
    id: string;
    status: signOffState;
    iterationName: string;
    signedOffBy: string | null;
    signedOffAt: string;
    note: string | null;
    exceptions: statusCounts;
    revokedAt: string | null;
    revokedBy: string | null;
    // Null while the vendor's issued sign-off waits for the client (suite status sign_off_issued).
    acknowledgedAt: string | null;
    acknowledgedBy: string | null;
    // The client's reason when it rejected the sign-off.
    rejectedAt: string | null;
    rejectedBy: string | null;
    rejectionReason: string | null;
    // Issued after sign-off reports existed (0040), so it has a report page.
    hasReport: boolean;
};

export type suiteOverview = {
    testCaseCount: number;
    roles: string[];
    iterations: (testIteration & { counts: statusCounts })[];
    // Newest first; the current one (if any) has revokedAt null.
    signOffs: signOff[];
};

export function countStatuses(statuses: testCaseStatus[]): statusCounts {
    return {
        total: statuses.length,
        passed: statuses.filter((s) => s === "Passed").length,
        failed: statuses.filter((s) => s === "Failed").length,
        blocked: statuses.filter((s) => s === "Blocked").length,
        inProgress: statuses.filter((s) => s === "In Progress").length,
        untested: statuses.filter((s) => s === "Untested").length,
    };
}

// issue_sign_off stores its counts with snake_case keys.
function toCounts(raw: unknown): statusCounts {
    const r = (raw ?? {}) as Record<string, number>;
    return { total: r.total ?? 0, passed: r.passed ?? 0, failed: r.failed ?? 0, blocked: r.blocked ?? 0, inProgress: r.in_progress ?? 0, untested: r.untested ?? 0 };
}

export async function getSuiteOverview(suiteId: string): Promise<suiteOverview> {
    const supabase = await createClient();
    const [iterations, casesResult, signOffs] = await Promise.all([
        getIterationsBySuiteId(suiteId),
        supabase
            .from("test_cases")
            .select("test_role:test_roles ( name ), sections!inner ( test_suite_id )")
            .eq("sections.test_suite_id", suiteId),
        getSuiteSignOffs(suiteId),
    ]);
    if (casesResult.error) throw casesResult.error;

    // Counted per case: each case's verdict rolled up from its testers' copies.
    const statusesByIteration = new Map(
        await Promise.all(iterations.map(async (iteration) => [iteration.id, verdictStatuses(await getCaseVerdicts(iteration.id))] as const))
    );

    return {
        testCaseCount: casesResult.data.length,
        roles: Array.from(new Set(casesResult.data.map((c) => c.test_role?.name).filter((r): r is NonNullable<typeof r> => !!r))).sort(),
        iterations: iterations.map((iteration) => ({ ...iteration, counts: countStatuses(statusesByIteration.get(iteration.id) ?? []) })),
        signOffs,
    };
}

const SIGN_OFF_SELECT = `
    id, status, signed_off_at, note, exceptions, revoked_at, acknowledged_at, rejected_at, rejection_reason,
    report_generated_at:report->header->>generatedAt,
    iteration:test_iterations ( name ),
    signer:profiles!suite_sign_offs_signed_off_by_fkey ( full_name ),
    revoker:profiles!suite_sign_offs_revoked_by_fkey ( full_name ),
    acknowledger:profiles!suite_sign_offs_acknowledged_by_fkey ( full_name ),
    rejecter:profiles!suite_sign_offs_rejected_by_fkey ( full_name )
` as const;

function toSignOff(row: {
    id: string; status: signOffState; signed_off_at: string; note: string | null; exceptions: unknown; revoked_at: string | null; acknowledged_at: string | null;
    rejected_at: string | null; rejection_reason: string | null; report_generated_at: string | null;
    iteration: { name: string } | null; signer: { full_name: string | null } | null; revoker: { full_name: string | null } | null;
    acknowledger: { full_name: string | null } | null; rejecter: { full_name: string | null } | null;
}): signOff {
    return {
        id: row.id,
        status: row.status,
        iterationName: row.iteration?.name ?? "—",
        signedOffBy: row.signer?.full_name ?? null,
        signedOffAt: row.signed_off_at,
        note: row.note,
        exceptions: toCounts(row.exceptions),
        revokedAt: row.revoked_at,
        revokedBy: row.revoker?.full_name ?? null,
        acknowledgedAt: row.acknowledged_at,
        acknowledgedBy: row.acknowledger?.full_name ?? null,
        rejectedAt: row.rejected_at,
        rejectedBy: row.rejecter?.full_name ?? null,
        rejectionReason: row.rejection_reason,
        hasReport: !!row.report_generated_at,
    };
}

// Every issued sign-off for the suite, newest first (rejected and withdrawn ones included; the
// vendor's draft isn't one yet, see getDraftSignOff). RLS: Admin and Internal only.
export async function getSuiteSignOffs(suiteId: string): Promise<signOff[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("suite_sign_offs")
        .select(SIGN_OFF_SELECT)
        .eq("testing_suite_id", suiteId)
        .neq("status", "drafting")
        .order("signed_off_at", { ascending: false });
    if (error) throw error;
    return data.map(toSignOff);
}

// The vendor's issued sign-off still waiting for the client's acknowledgement, if any.
export async function getPendingSignOff(suiteId: string): Promise<signOff | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("suite_sign_offs")
        .select(SIGN_OFF_SELECT)
        .eq("testing_suite_id", suiteId)
        .eq("status", "issued")
        .maybeSingle();
    if (error) throw error;
    return data ? toSignOff(data) : null;
}

// The sign-off the vendor is drafting (Create sign-off → Issue), with what it saved so far.
// RLS hides drafts from everyone but Admin, so other roles always get null.
export type signOffDraft = { id: string; note: string; themes: ThemeInput[]; sections: ReportSection[] };

export async function getDraftSignOff(suiteId: string): Promise<signOffDraft | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("suite_sign_offs")
        .select("id, note, themes:report->themes->items, sections:report->sections")
        .eq("testing_suite_id", suiteId)
        .eq("status", "drafting")
        .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const themes = Array.isArray(data.themes) ? (data.themes as ThemeInput[]) : [];
    const sections = Array.isArray(data.sections) ? (data.sections as ReportSection[]) : [];
    return { id: data.id, note: data.note ?? "", themes, sections };
}

// Testing orgs (Internal and External) that haven't submitted. The vendor never submits,
// so its rows never count as missing.
export function unsubmittedParticipantOrgs(participants: iterationParticipant[]): organization[] {
    return participants.filter((p) => p.organization.type !== "vendor" && !p.submittedAt).map((p) => p.organization);
}

// Whether the viewer's org can take back its submission for this round: while it is still in
// progress, i.e. until an Admin/Internal user completes or stops it (0019).
export async function canWithdrawParticipation(iterationId: string): Promise<boolean> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("can_withdraw_participation", { p_iteration_id: iterationId });
    if (error) throw error;
    return data;
}

export type participationProgress = iterationParticipant & { counts: statusCounts };

// Per-org progress for one round (Participation panel). RLS already narrows both reads for
// External (own participant row, own results), so this returns just their own row for them.
export async function getParticipationProgress(iterationId: string): Promise<participationProgress[]> {
    const [participants, verdicts] = await Promise.all([getIterationParticipants(iterationId), getCaseVerdicts(iterationId)]);
    // Per case, rolled up across the org's testers.
    return participants.map((p) => ({ ...p, counts: countStatuses(verdictStatuses(verdicts, p.organization.id)) }));
}

// What the Sign Off dialog needs: whether a round is still running, and the
// latest completed round's counts (the one sign-off is based on).
// unsubmittedOrgs: testing orgs in that round that never submitted (warn, don't block: 6.2).
// currentIteration: the open round, else the newest one (isFallback), with its progress
// (tested = Passed/Failed/Blocked). A participating org counts its own cases; anyone else (vendor)
// counts each case once. A case's status is its verdict, rolled up from its testers' copies.
export type currentIterationProgress = {
    iteration: testIteration;
    isFallback: boolean;
    counts: statusCounts;
    tested: number;
    percent: number;
    // The viewer's org in this round, if it takes part (for Submit Result).
    ownParticipation: iterationParticipant | null;
    // Other testing orgs in this round still to submit; 0 means the viewer's submit finishes the round.
    othersPending: number;
    // Every testing org in this round still to submit (the viewer's included), shown in the suite header.
    pendingSubmissions: number;
};

export type signOffContext = {
    hasActiveIteration: boolean;
    latestCompleted: { name: string; counts: statusCounts; unsubmittedOrgs: organization[] } | null;
    currentIteration: currentIterationProgress | null;
    // Suite cases with no finished result: never in a completed round, or left Untested / In progress
    // in the latest one. Only a warning when issuing the sign-off.
    openUntestedCases: number;
};

export async function getSignOffContext(suiteId: string, orgId?: string): Promise<signOffContext> {
    const supabase = await createClient();
    const [iterations, caseStates] = await Promise.all([
        getIterationsBySuiteId(suiteId),
        supabase.rpc("get_suite_case_states", { p_suite_id: suiteId }),
    ]);
    if (caseStates.error) throw caseStates.error;
    const openUntestedCases = caseStates.data.filter((c) => c.status !== "tested" || c.result === "Untested" || c.result === "In progress").length;
    const openIteration = iterations.find((i) => i.status === "not_started" || i.status === "in_progress") ?? null;
    const current = openIteration ?? iterations[0] ?? null;
    let currentIteration: currentIterationProgress | null = null;
    if (current) {
        const [verdicts, currentParticipants] = await Promise.all([getCaseVerdicts(current.id), getIterationParticipants(current.id)]);
        // A participating org counts its own cases; anyone else (vendor) counts every case once.
        // Either way a case is its verdict, rolled up from its testers' copies.
        const ownStatuses = orgId ? verdictStatuses(verdicts, orgId) : [];
        const statuses = ownStatuses.length > 0 ? ownStatuses : verdictStatuses(verdicts);
        const currentCounts = countStatuses(statuses);
        const tested = currentCounts.passed + currentCounts.failed + currentCounts.blocked;
        const pending = unsubmittedParticipantOrgs(currentParticipants);
        currentIteration = {
            iteration: current,
            isFallback: !openIteration,
            counts: currentCounts,
            tested,
            percent: currentCounts.total ? Math.round((tested / currentCounts.total) * 100) : 0,
            ownParticipation: currentParticipants.find((p) => p.organization.id === orgId) ?? null,
            othersPending: pending.filter((o) => o.id !== orgId).length,
            pendingSubmissions: pending.length,
        };
    }
    const latestCompleted = iterations.find((i) => i.status === "completed") ?? null;
    let counts = countStatuses([]);
    let unsubmittedOrgs: organization[] = [];
    if (latestCompleted) {
        const [verdicts, participants] = await Promise.all([getCaseVerdicts(latestCompleted.id), getIterationParticipants(latestCompleted.id)]);
        counts = countStatuses(verdictStatuses(verdicts));
        unsubmittedOrgs = unsubmittedParticipantOrgs(participants);
    }
    return {
        hasActiveIteration: !!openIteration,
        latestCompleted: latestCompleted ? { name: latestCompleted.name, counts, unsubmittedOrgs } : null,
        currentIteration,
        openUntestedCases,
    };
}
