import { createClient } from "@/lib/supabase/server";
import { isRemovedFromRound, type caseFlag } from "./case-states";
import { countStatuses, type statusCounts } from "./overview";
import { compareOrganizations, type organization } from "./organizations";
import {
    getIterationParticipants,
    getIterationResults,
    getIterationsBySuiteId,
    type iterationParticipant,
    type testIteration,
    type testResultRow,
} from "./test-iterations";
import type { testCaseStatus } from "./test-cases";
import type { ReportRemark, ReportThemes } from "@/lib/report/sign-off-remarks";

// Deterministic sign-off report: every number here is computed from recorded results, so the
// same data always gives the same report. Verdict rules: ~/.claude/plans/give-me-a-scope-calm-frog.md.
// The report is frozen into suite_sign_offs.report (jsonb), so every exported shape is plain JSON.

import { DEFAULT_EXIT_CRITERIA, toExitCriteria, type ExitCriteria } from "@/lib/report/exit-criteria";
import type { ReportSection } from "@/lib/report/report-details";

export { DEFAULT_EXIT_CRITERIA, toExitCriteria, type ExitCriteria };

export type CriterionResult = {
    key: keyof ExitCriteria;
    label: string;
    actual: number | string;
    threshold: number | string;
    met: boolean;
};

export type Verdict = "met" | "not_met";

export type ExecutedStatus = "Passed" | "Failed" | "Blocked";
export type FinalStatus = ExecutedStatus | "Untested";
type Priority = "low" | "medium" | "high";

export type FinalOrgStatus = {
    organizationId: string;
    organizationName: string;
    // Untested: the case was in this org's rounds but the org never executed it.
    status: FinalStatus;
    roundName: string | null;
};

export type FinalCaseStatus = {
    testCaseId: string;
    code: string | null;
    title: string;
    section: string;
    priority: Priority;
    roleAssignee: string | null;
    status: FinalStatus;
    // Latest round any org's result comes from; null when never executed.
    sourceRoundName: string | null;
    perOrg: FinalOrgStatus[];
    changedSinceTested: boolean;
    // Some org's result comes from an earlier round than the last one it was included in (rule 3).
    carriedOver: boolean;
};

export type Breakdown = { label: string; counts: statusCounts }[];

export type ReportFailedStep = { step: string; status: "Failed" | "Blocked"; remarks: string[] };

export type ReportFailedCase = {
    testCaseId: string;
    code: string | null;
    title: string;
    section: string;
    priority: Priority;
    roleAssignee: string | null;
    status: "Failed" | "Blocked";
    // Only the orgs whose result is Failed or Blocked, with the steps behind it.
    orgs: { organizationName: string; status: "Failed" | "Blocked"; roundName: string; failedSteps: ReportFailedStep[] }[];
};

export type RoundSummary = {
    iterationId: string;
    name: string;
    startedAt: string;
    completedAt: string | null;
    // One entry per case per org, same as the Overview's round counts.
    counts: statusCounts;
    // Distinct test cases in the round. Optional: reports frozen before it was added don't have it.
    caseCount?: number;
    // Each participating org's submission and its own counts in this round. Optional, as above.
    participants?: RoundParticipant[];
};

export type RoundParticipant = {
    organizationName: string;
    submittedAt: string | null;
    withdrawnAt: string | null;
    counts: statusCounts;
};

export type RoundCaseChange = { testCaseId: string; code: string | null; title: string; fromRound: string; toRound: string };

export type RoundHistory = {
    rounds: RoundSummary[];
    // Passed -> Failed between a case's consecutive executions.
    regressions: RoundCaseChange[];
    // Failed -> Passed between a case's consecutive executions.
    fixes: RoundCaseChange[];
    // Executed in 2+ rounds and Failed in every one of them.
    failedEveryRound: { testCaseId: string; code: string | null; title: string; roundCount: number }[];
    // Every executed case's combined result per round it ran in, oldest first: the audit trail
    // the three lists above are derived from. Optional: reports frozen before it was added don't have it.
    caseAudit?: CaseAuditEntry[];
};

export type CaseAuditEntry = {
    testCaseId: string;
    code: string | null;
    title: string;
    runs: { roundName: string; status: ExecutedStatus }[];
};

export type ReportLimitation = {
    key: "withdrawn_orgs" | "deleted_cases" | "never_executed" | "carried_over" | "changed_since_tested" | "no_evidence";
    text: string;
    items: string[];
};

export type ReportHeader = {
    suiteId: string;
    suiteName: string;
    suiteCode: string | null;
    // Latest completed round; null when no round has been completed.
    roundName: string | null;
    roundStartedAt: string | null;
    roundCompletedAt: string | null;
    roundsCounted: string[];
    participants: { organizationName: string; organizationType: organization["type"]; submittedAt: string | null; withdrawnAt: string | null }[];
    generatedAt: string;
};

export type SignOffReport = {
    header: ReportHeader;
    exitCriteria: ExitCriteria;
    criteria: CriterionResult[];
    verdict: Verdict;
    totals: statusCounts;
    passRate: number;
    breakdowns: { bySection: Breakdown; byPriority: Breakdown; byRole: Breakdown; byOrg: Breakdown };
    failedCases: ReportFailedCase[];
    roundHistory: RoundHistory;
    limitations: ReportLimitation[];
    // Tester remarks behind each case's final result. Missing on reports frozen before Phase 5.
    remarks?: ReportRemark[];
    // Vendor-written observations, attached at issue. Missing or null when none were written.
    themes?: ReportThemes | null;
    // Vendor-added sections on the Report details page, attached at issue. Missing when none were added.
    sections?: ReportSection[];
    // Every case's final status and each org's result behind it. Missing on reports frozen before it was added.
    caseResults?: ReportCaseResult[];
};

export type ReportCaseResult = {
    testCaseId: string;
    code: string | null;
    title: string;
    section: string;
    status: FinalStatus;
    perOrg: { organizationName: string; status: FinalStatus; roundName: string | null }[];
};

// Inputs to the pure functions below.

// One completed round. rows are already limited to what counts: included in the run and not
// taken out mid-round by Sync.
export type ReportRound = { iteration: testIteration; rows: testResultRow[]; participants: iterationParticipant[] };

export type ReportLiveCase = {
    id: string;
    code: string | null;
    title: string;
    section: string;
    sectionOrder: number;
    orderIndex: number;
    priority: Priority;
    roleAssignee: string | null;
    flags: caseFlag[];
};

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABELS: Record<Priority, string> = { high: "High", medium: "Medium", low: "Low" };

const isExecuted = (status: testCaseStatus): status is ExecutedStatus =>
    status === "Passed" || status === "Failed" || status === "Blocked";

const caseLabel = (c: { code?: string | null; title: string }) => (c.code ? `${c.code} ${c.title}` : c.title);

// Rule 4: any Failed -> Failed, else any Blocked -> Blocked, else Passed.
function combineExecuted(statuses: ExecutedStatus[]): ExecutedStatus {
    if (statuses.includes("Failed")) return "Failed";
    if (statuses.includes("Blocked")) return "Blocked";
    return "Passed";
}

export type RolledUp = {
    finals: FinalCaseStatus[];
    // testCaseId -> orgId -> the round row each org's final status comes from. Not part of the report.
    sourceRows: Map<string, Map<string, testResultRow>>;
    deletedCases: string[];
};

// Rules 3–7. rounds are completed rounds, oldest first.
export function rollUpFinalStatuses(rounds: ReportRound[], liveCases: ReportLiveCase[]): RolledUp {
    const orgs = new Map<string, organization>();
    for (const round of rounds) for (const p of round.participants) orgs.set(p.organization.id, p.organization);

    // testCaseId -> orgId -> entries, oldest round first.
    const index = new Map<string, Map<string, { round: testIteration; row: testResultRow }[]>>();
    const deleted = new Map<string, string>();
    for (const round of rounds) {
        for (const row of round.rows) {
            // Rule 6: deleted cases are out of scope, only listed.
            if (!row.testCaseId) {
                deleted.set(caseLabel(row), caseLabel(row));
                continue;
            }
            const byOrg = index.get(row.testCaseId) ?? new Map();
            const entries = byOrg.get(row.organizationId) ?? [];
            entries.push({ round: round.iteration, row });
            byOrg.set(row.organizationId, entries);
            index.set(row.testCaseId, byOrg);
        }
    }

    const sourceRows = new Map<string, Map<string, testResultRow>>();
    const finals = liveCases.map((live): FinalCaseStatus => {
        const perOrg: FinalOrgStatus[] = [];
        const sources = new Map<string, testResultRow>();
        let carriedOver = false;
        let sourceRound: testIteration | null = null;

        for (const [orgId, entries] of index.get(live.id) ?? []) {
            const organizationName = orgs.get(orgId)?.name ?? "Unknown organization";
            // Rule 3: the latest round where this org executed it; later non-executed rounds don't override it.
            let found = false;
            for (let i = entries.length - 1; i >= 0; i--) {
                const { round, row } = entries[i];
                if (!isExecuted(row.status)) continue;
                perOrg.push({ organizationId: orgId, organizationName, status: row.status, roundName: round.name });
                sources.set(orgId, row);
                if (i < entries.length - 1) carriedOver = true;
                if (!sourceRound || round.iterationNumber > sourceRound.iterationNumber) sourceRound = round;
                found = true;
                break;
            }
            if (!found) perOrg.push({ organizationId: orgId, organizationName, status: "Untested", roundName: null });
        }

        perOrg.sort((a, b) => {
            const orgA = orgs.get(a.organizationId);
            const orgB = orgs.get(b.organizationId);
            return orgA && orgB ? compareOrganizations(orgA, orgB) : a.organizationName.localeCompare(b.organizationName);
        });
        sourceRows.set(live.id, sources);

        const executed = perOrg.map((p) => p.status).filter((s): s is ExecutedStatus => s !== "Untested");
        return {
            testCaseId: live.id,
            code: live.code,
            title: live.title,
            section: live.section,
            priority: live.priority,
            roleAssignee: live.roleAssignee,
            // Rule 5: never executed by any org -> Untested, still in the pass-rate denominator.
            status: executed.length > 0 ? combineExecuted(executed) : "Untested",
            sourceRoundName: sourceRound?.name ?? null,
            perOrg,
            // Rule 7: keeps its latest executed result, flagged.
            changedSinceTested: live.flags.includes("changed_since"),
            carriedOver,
        };
    });

    return { finals, sourceRows, deletedCases: [...deleted.values()].sort() };
}

// Pass rate in percent, one decimal. Untested cases count in the denominator.
export function passRateOf(finals: FinalCaseStatus[]): number {
    if (finals.length === 0) return 0;
    const passed = finals.filter((f) => f.status === "Passed").length;
    return Math.round((passed / finals.length) * 1000) / 10;
}

// Rules 8–9. participation: every completed round's participants.
export function evaluateExitCriteria(
    finals: FinalCaseStatus[],
    participation: iterationParticipant[][],
    criteria: ExitCriteria
): { criteria: CriterionResult[]; verdict: Verdict } {
    const passRate = passRateOf(finals);
    const failed = finals.filter((f) => f.status === "Failed").length;
    const blocked = finals.filter((f) => f.status === "Blocked").length;

    const results: CriterionResult[] = [
        {
            key: "minPassRate",
            label: `Pass rate at least ${criteria.minPassRate}%`,
            actual: passRate,
            threshold: criteria.minPassRate,
            met: finals.length > 0 && passRate >= criteria.minPassRate,
        },
        {
            key: "maxFailed",
            label: `At most ${criteria.maxFailed} failed`,
            actual: failed,
            threshold: criteria.maxFailed,
            met: failed <= criteria.maxFailed,
        },
        {
            key: "maxBlocked",
            label: `At most ${criteria.maxBlocked} blocked`,
            actual: blocked,
            threshold: criteria.maxBlocked,
            met: blocked <= criteria.maxBlocked,
        },
    ];

    if (criteria.requireAllOrgsSubmitted) {
        // Withdrawn orgs are excluded here and named under Limitations.
        const expected = participation.flat().filter((p) => !p.withdrawnAt);
        const submitted = expected.filter((p) => p.submittedAt).length;
        results.push({
            key: "requireAllOrgsSubmitted",
            label: "Every participant submitted, in every round",
            actual: `${submitted} of ${expected.length}`,
            threshold: "All",
            met: expected.length > 0 && submitted === expected.length,
        });
    }

    return { criteria: results, verdict: results.every((r) => r.met) ? "met" : "not_met" };
}

// rounds oldest first.
export function buildRoundHistory(rounds: ReportRound[]): RoundHistory {
    // testCaseId -> its combined executed status per round, oldest first.
    const executions = new Map<string, { code: string | null; title: string; roundName: string; status: ExecutedStatus }[]>();

    const summaries = rounds.map((round): RoundSummary => {
        const byCase = new Map<string, { row: testResultRow; statuses: ExecutedStatus[] }>();
        for (const row of round.rows) {
            if (!row.testCaseId || !isExecuted(row.status)) continue;
            const entry = byCase.get(row.testCaseId) ?? { row, statuses: [] };
            entry.statuses.push(row.status);
            byCase.set(row.testCaseId, entry);
        }
        for (const [testCaseId, { row, statuses }] of byCase) {
            const list = executions.get(testCaseId) ?? [];
            list.push({ code: row.code ?? null, title: row.title, roundName: round.iteration.name, status: combineExecuted(statuses) });
            executions.set(testCaseId, list);
        }
        return {
            iterationId: round.iteration.id,
            name: round.iteration.name,
            startedAt: round.iteration.startedAt,
            completedAt: round.iteration.completedAt,
            counts: countStatuses(round.rows.map((row) => row.status)),
            caseCount: new Set(round.rows.map((row) => row.testCaseId ?? caseLabel(row))).size,
            participants: [...round.participants]
                .sort((a, b) => compareOrganizations(a.organization, b.organization))
                .map((p) => ({
                    organizationName: p.organization.name,
                    submittedAt: p.submittedAt,
                    withdrawnAt: p.withdrawnAt,
                    counts: countStatuses(round.rows.filter((row) => row.organizationId === p.organization.id).map((row) => row.status)),
                })),
        };
    });

    const regressions: RoundCaseChange[] = [];
    const fixes: RoundCaseChange[] = [];
    const failedEveryRound: RoundHistory["failedEveryRound"] = [];
    for (const [testCaseId, list] of executions) {
        for (let i = 1; i < list.length; i++) {
            const prev = list[i - 1];
            const curr = list[i];
            const change = { testCaseId, code: curr.code, title: curr.title, fromRound: prev.roundName, toRound: curr.roundName };
            if (prev.status === "Passed" && curr.status === "Failed") regressions.push(change);
            if (prev.status === "Failed" && curr.status === "Passed") fixes.push(change);
        }
        if (list.length >= 2 && list.every((e) => e.status === "Failed")) {
            const last = list[list.length - 1];
            failedEveryRound.push({ testCaseId, code: last.code, title: last.title, roundCount: list.length });
        }
    }

    return {
        rounds: summaries,
        regressions: regressions.sort(byCode),
        fixes: fixes.sort(byCode),
        failedEveryRound: failedEveryRound.sort(byCode),
        caseAudit: buildCaseAudit(rounds.map((r) => ({ name: r.iteration.name, rows: r.rows }))),
    };
}

const byCode = (a: { code: string | null; title: string }, b: { code: string | null; title: string }) =>
    caseLabel(a).localeCompare(caseLabel(b), undefined, { numeric: true });

// Each executed case's combined status per round (orgs combined as in buildRoundHistory), rounds oldest first.
function buildCaseAudit(rounds: { name: string; rows: testResultRow[] }[]): CaseAuditEntry[] {
    const audit = new Map<string, CaseAuditEntry>();
    for (const round of rounds) {
        const byCase = new Map<string, { row: testResultRow; statuses: ExecutedStatus[] }>();
        for (const row of round.rows) {
            if (!row.testCaseId || !isExecuted(row.status)) continue;
            const entry = byCase.get(row.testCaseId) ?? { row, statuses: [] };
            entry.statuses.push(row.status);
            byCase.set(row.testCaseId, entry);
        }
        for (const [testCaseId, { row, statuses }] of byCase) {
            const entry = audit.get(testCaseId) ?? { testCaseId, code: null, title: "", runs: [] };
            entry.code = row.code ?? null;
            entry.title = row.title;
            entry.runs.push({ roundName: round.name, status: combineExecuted(statuses) });
            audit.set(testCaseId, entry);
        }
    }
    return [...audit.values()].sort(byCode);
}

// Reports frozen before caseAudit existed: rebuild it from the frozen rounds' recorded results.
// Completed rounds can't be edited, so this matches what would have been frozen.
async function backfillCaseAudit(history: RoundHistory): Promise<CaseAuditEntry[]> {
    const rounds = await Promise.all(
        history.rounds.map(async (round) => ({
            name: round.name,
            rows: (await getIterationResults(round.iterationId)).filter((row) => row.includedInRun && !isRemovedFromRound(row)),
        }))
    );
    return buildCaseAudit(rounds);
}

function groupCounts(finals: FinalCaseStatus[], keyOf: (f: FinalCaseStatus) => string, order: string[]): Breakdown {
    const groups = new Map<string, FinalStatus[]>();
    for (const f of finals) groups.set(keyOf(f), [...(groups.get(keyOf(f)) ?? []), f.status]);
    const rank = (label: string) => (order.indexOf(label) === -1 ? order.length : order.indexOf(label));
    return [...groups.entries()]
        .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
        .map(([label, statuses]) => ({ label, counts: countStatuses(statuses) }));
}

export function buildBreakdowns(finals: FinalCaseStatus[], liveCases: ReportLiveCase[], orgOrder: string[]): SignOffReport["breakdowns"] {
    const sectionOrder = [...new Map([...liveCases].sort((a, b) => a.sectionOrder - b.sectionOrder).map((c) => [c.section, c.section])).keys()];

    const byOrgStatuses = new Map<string, FinalStatus[]>();
    for (const f of finals) {
        for (const p of f.perOrg) byOrgStatuses.set(p.organizationName, [...(byOrgStatuses.get(p.organizationName) ?? []), p.status]);
    }
    const orgRank = (name: string) => (orgOrder.indexOf(name) === -1 ? orgOrder.length : orgOrder.indexOf(name));

    return {
        bySection: groupCounts(finals, (f) => f.section, sectionOrder),
        byPriority: groupCounts(finals, (f) => PRIORITY_LABELS[f.priority], ["High", "Medium", "Low"]),
        byRole: groupCounts(finals, (f) => f.roleAssignee ?? "Unassigned", []).sort(
            (a, b) => Number(a.label === "Unassigned") - Number(b.label === "Unassigned")
        ),
        byOrg: [...byOrgStatuses.entries()]
            .sort(([a], [b]) => orgRank(a) - orgRank(b) || a.localeCompare(b))
            .map(([label, statuses]) => ({ label, counts: countStatuses(statuses) })),
    };
}

// Failed and Blocked cases, high priority first, with the failed/blocked steps behind each org's result.
export function buildFailedCases(rolledUp: RolledUp): ReportFailedCase[] {
    return rolledUp.finals
        .filter((f): f is FinalCaseStatus & { status: "Failed" | "Blocked" } => f.status === "Failed" || f.status === "Blocked")
        .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || caseLabel(a).localeCompare(caseLabel(b), undefined, { numeric: true }))
        .map((f) => ({
            testCaseId: f.testCaseId,
            code: f.code,
            title: f.title,
            section: f.section,
            priority: f.priority,
            roleAssignee: f.roleAssignee,
            status: f.status,
            orgs: f.perOrg
                .filter((p): p is FinalOrgStatus & { status: "Failed" | "Blocked"; roundName: string } => p.status === "Failed" || p.status === "Blocked")
                .map((p) => {
                    const row = rolledUp.sourceRows.get(f.testCaseId)?.get(p.organizationId);
                    return {
                        organizationName: p.organizationName,
                        status: p.status,
                        roundName: p.roundName,
                        failedSteps: (row?.stepsToExecute ?? [])
                            .filter((step): step is typeof step & { status: "Failed" | "Blocked" } => step.status === "Failed" || step.status === "Blocked")
                            .map((step) => ({ step: step.step, status: step.status, remarks: (step.remarks ?? []).map((r) => r.remark) })),
                    };
                }),
        }));
}

export function buildLimitations(rounds: ReportRound[], rolledUp: RolledUp): ReportLimitation[] {
    const withdrawn = rounds.flatMap((round) =>
        round.participants.filter((p) => p.withdrawnAt).map((p) => `${p.organization.name} (${round.iteration.name})`)
    );
    const finals = rolledUp.finals;
    const limitations: ReportLimitation[] = [
        { key: "withdrawn_orgs", text: "Organizations that withdrew and are excluded from the submission check", items: withdrawn },
        { key: "deleted_cases", text: "Test cases deleted after they were tested; not counted", items: rolledUp.deletedCases },
        {
            key: "never_executed",
            text: "Test cases never executed in any completed round; counted as Untested",
            items: finals.filter((f) => f.status === "Untested").map(caseLabel),
        },
        {
            key: "carried_over",
            text: "Test cases included in a later round but not re-run; their earlier result is used",
            items: finals.filter((f) => f.carriedOver).map((f) => `${caseLabel(f)} (${f.status}, ${f.sourceRoundName})`),
        },
        {
            key: "changed_since_tested",
            text: "Test cases edited since they were last tested",
            items: finals.filter((f) => f.changedSinceTested && f.status !== "Untested").map(caseLabel),
        },
    ];
    return [
        ...limitations.filter((l) => l.items.length > 0),
        { key: "no_evidence", text: "No evidence attachments or defect tracking are recorded in the portal", items: [] },
    ];
}

// Every remark on every step of the rows behind each final result (whatever the step status),
// so the catalog matches what the verdict is based on. Order: section, priority (high first),
// case code, organization, step.
export function buildRemarkCatalog(rolledUp: RolledUp, liveCases: ReportLiveCase[]): ReportRemark[] {
    const liveById = new Map(liveCases.map((c) => [c.id, c]));
    const sorted = [...rolledUp.finals].sort((a, b) => {
        const liveA = liveById.get(a.testCaseId);
        const liveB = liveById.get(b.testCaseId);
        return (
            (liveA?.sectionOrder ?? 0) - (liveB?.sectionOrder ?? 0) ||
            PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
            caseLabel(a).localeCompare(caseLabel(b), undefined, { numeric: true })
        );
    });

    const remarks: ReportRemark[] = [];
    for (const f of sorted) {
        // perOrg is already in organization order.
        for (const org of f.perOrg) {
            const row = rolledUp.sourceRows.get(f.testCaseId)?.get(org.organizationId);
            if (!row || !org.roundName) continue;
            for (const [i, step] of (row.stepsToExecute ?? []).entries()) {
                for (const r of step.remarks ?? []) {
                    const remark = r.remark.trim();
                    if (!remark) continue;
                    remarks.push({
                        id: r.id,
                        testCaseId: f.testCaseId,
                        code: f.code,
                        title: f.title,
                        section: f.section,
                        priority: f.priority,
                        organizationName: org.organizationName,
                        roundName: org.roundName,
                        step: step.step,
                        stepNumber: i + 1,
                        stepStatus: step.status ?? "Untested",
                        remark,
                        authorName: r.author?.full_name ?? null,
                        createdAt: r.created_at ?? null,
                    });
                }
            }
        }
    }
    return remarks;
}

function loadRounds(iterations: testIteration[]): Promise<ReportRound[]> {
    return Promise.all(
        iterations.map(async (iteration) => {
            const [rows, participants] = await Promise.all([getIterationResults(iteration.id), getIterationParticipants(iteration.id)]);
            return { iteration, rows: rows.filter((row) => row.includedInRun && !isRemovedFromRound(row)), participants };
        })
    );
}

async function loadLiveCases(suiteId: string): Promise<ReportLiveCase[]> {
    const supabase = await createClient();
    const [casesResult, statesResult] = await Promise.all([
        supabase
            .from("test_cases")
            .select("id, code, title, priority, test_role:test_roles ( name ), order_index, sections!inner ( name, order_index, test_suite_id )")
            .eq("sections.test_suite_id", suiteId),
        supabase.rpc("get_suite_case_states", { p_suite_id: suiteId }),
    ]);
    if (casesResult.error) throw casesResult.error;
    if (statesResult.error) throw statesResult.error;

    // Only the flags: the report carries earlier results forward, unlike the RPC's result column.
    const flagsById = new Map(statesResult.data.map((s) => [s.test_case_id, s.flags as caseFlag[]]));
    return casesResult.data
        .map((c) => ({
            id: c.id,
            code: c.code,
            title: c.title,
            section: c.sections.name,
            sectionOrder: c.sections.order_index,
            orderIndex: c.order_index,
            priority: c.priority,
            roleAssignee: c.test_role?.name ?? null,
            flags: flagsById.get(c.id) ?? [],
        }))
        .sort((a, b) => a.sectionOrder - b.sectionOrder || a.orderIndex - b.orderIndex);
}

function toCaseResults(finals: FinalCaseStatus[]): ReportCaseResult[] {
    return finals.map((f) => ({
        testCaseId: f.testCaseId,
        code: f.code,
        title: f.title,
        section: f.section,
        status: f.status,
        perOrg: f.perOrg.map((o) => ({ organizationName: o.organizationName, status: o.status, roundName: o.roundName })),
    }));
}

// For reports frozen before caseResults existed: re-roll the rounds the report counted. Completed
// rounds' results don't change, but case titles and sections are today's, and deleted cases drop out.
// For reports frozen before remarks carried their author and time: look them up by test_remarks id.
// Only created_by/created_at are read, which never change, so the frozen remark text is kept as is.
async function backfillRemarkAuthors(remarks: ReportRemark[] | undefined): Promise<ReportRemark[] | undefined> {
    const missing = (remarks ?? []).filter((r) => r.createdAt === undefined).map((r) => r.id);
    if (!remarks || missing.length === 0) return remarks;
    const supabase = await createClient();
    // Batched: the ids go in the request URL.
    const batches = Array.from({ length: Math.ceil(missing.length / 100) }, (_, i) => missing.slice(i * 100, (i + 1) * 100));
    const results = await Promise.all(
        batches.map((ids) => supabase.from("test_remarks").select("id, created_at, profile:profiles ( full_name )").in("id", ids))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw failed.error;
    const byId = new Map(results.flatMap((r) => r.data ?? []).map((r) => [r.id, r]));
    return remarks.map((r) => {
        const found = byId.get(r.id);
        return r.createdAt !== undefined || !found ? r : { ...r, authorName: found.profile?.full_name ?? null, createdAt: found.created_at };
    });
}

async function backfillCaseResults(suiteId: string, history: RoundHistory): Promise<ReportCaseResult[]> {
    const counted = new Set(history.rounds.map((r) => r.iterationId));
    const [iterations, liveCases] = await Promise.all([getIterationsBySuiteId(suiteId), loadLiveCases(suiteId)]);
    const rounds = await loadRounds(iterations.filter((i) => counted.has(i.id)).sort((a, b) => a.iterationNumber - b.iterationNumber));
    return toCaseResults(rollUpFinalStatuses(rounds, liveCases).finals);
}

export async function buildSignOffReport(suiteId: string): Promise<SignOffReport> {
    const supabase = await createClient();
    const [suiteResult, iterations, liveCases] = await Promise.all([
        supabase.from("testing_suites").select("id, name, code, exit_criteria").eq("id", suiteId).single(),
        getIterationsBySuiteId(suiteId),
        loadLiveCases(suiteId),
    ]);
    if (suiteResult.error) throw suiteResult.error;

    // Rule 2: completed rounds only (stopped rounds never count), oldest first.
    const rounds = await loadRounds(iterations.filter((i) => i.status === "completed").sort((a, b) => a.iterationNumber - b.iterationNumber));

    const exitCriteria = toExitCriteria(suiteResult.data.exit_criteria);
    const rolledUp = rollUpFinalStatuses(rounds, liveCases);
    const { criteria, verdict } = evaluateExitCriteria(rolledUp.finals, rounds.map((r) => r.participants), exitCriteria);

    const latest = rounds[rounds.length - 1] ?? null;
    const orgOrder = [
        ...new Map(
            rounds
                .flatMap((r) => r.participants.map((p) => p.organization))
                .sort(compareOrganizations)
                .map((o) => [o.name, o.name])
        ).keys(),
    ];

    return {
        header: {
            suiteId,
            suiteName: suiteResult.data.name,
            suiteCode: suiteResult.data.code,
            roundName: latest?.iteration.name ?? null,
            roundStartedAt: latest?.iteration.startedAt ?? null,
            roundCompletedAt: latest?.iteration.completedAt ?? null,
            roundsCounted: rounds.map((r) => r.iteration.name),
            participants: (latest?.participants ?? []).map((p) => ({
                organizationName: p.organization.name,
                organizationType: p.organization.type,
                submittedAt: p.submittedAt,
                withdrawnAt: p.withdrawnAt,
            })),
            generatedAt: new Date().toISOString(),
        },
        exitCriteria,
        criteria,
        verdict,
        totals: countStatuses(rolledUp.finals.map((f) => f.status)),
        passRate: passRateOf(rolledUp.finals),
        breakdowns: buildBreakdowns(rolledUp.finals, liveCases, orgOrder),
        failedCases: buildFailedCases(rolledUp),
        roundHistory: buildRoundHistory(rounds),
        limitations: buildLimitations(rounds, rolledUp),
        remarks: buildRemarkCatalog(rolledUp, liveCases),
        caseResults: toCaseResults(rolledUp.finals),
        // Attached by issueSignOff after validation.
        themes: null,
    };
}

export type FrozenSignOffReport = {
    signOffId: string;
    iterationName: string;
    signedOffBy: string | null;
    signedOffAt: string;
    note: string | null;
    acknowledgedAt: string | null;
    acknowledgedBy: string | null;
    revokedAt: string | null;
    // The client's rejection, with its reason (0047).
    rejectedAt: string | null;
    rejectedBy: string | null;
    rejectionReason: string | null;
    report: SignOffReport;
};

// The report frozen on issue. Null when the sign-off isn't in this suite, the viewer can't read
// sign-offs (RLS: Admin and Internal only), or it was issued before reports existed.
export async function getSignOffReport({ suiteSlug, signOffId }: { suiteSlug: string; signOffId: string }): Promise<FrozenSignOffReport | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("suite_sign_offs")
        .select(`
            id, signed_off_at, note, acknowledged_at, revoked_at, rejected_at, rejection_reason, report,
            suite:testing_suites!inner ( id, slug ),
            iteration:test_iterations ( name ),
            signer:profiles!suite_sign_offs_signed_off_by_fkey ( full_name ),
            acknowledger:profiles!suite_sign_offs_acknowledged_by_fkey ( full_name ),
            rejecter:profiles!suite_sign_offs_rejected_by_fkey ( full_name )
        `)
        .eq("id", signOffId)
        .eq("suite.slug", suiteSlug)
        .maybeSingle();
    // A malformed id is a 404, not a crash.
    if (error?.code === "22P02") return null;
    if (error) throw error;
    if (!data?.report) return null;
    const report = data.report as SignOffReport;
    const [caseAudit, caseResults, remarks] = await Promise.all([
        report.roundHistory.caseAudit ?? backfillCaseAudit(report.roundHistory),
        report.caseResults ?? backfillCaseResults(data.suite.id, report.roundHistory),
        backfillRemarkAuthors(report.remarks),
    ]);
    const roundHistory = { ...report.roundHistory, caseAudit };
    return {
        signOffId: data.id,
        iterationName: data.iteration?.name ?? "—",
        signedOffBy: data.signer?.full_name ?? null,
        signedOffAt: data.signed_off_at,
        note: data.note,
        acknowledgedAt: data.acknowledged_at,
        acknowledgedBy: data.acknowledger?.full_name ?? null,
        revokedAt: data.revoked_at,
        rejectedAt: data.rejected_at,
        rejectedBy: data.rejecter?.full_name ?? null,
        rejectionReason: data.rejection_reason,
        report: { ...report, roundHistory, caseResults, remarks },
    };
}
