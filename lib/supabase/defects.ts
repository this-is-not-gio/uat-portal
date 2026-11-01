import { createClient } from "@/lib/supabase/server";
import type { Database } from "./database.types";
import { defectCode } from "./defect-format";

export type defectSeverity = Database["public"]["Enums"]["defect_severity"];
export type defectStatus = Database["public"]["Enums"]["defect_status"];

// A cited remark as saved on the defect (0080, 0082): a copy that outlives the remark itself.
export type defectReference = {
    remarkId: string | null;
    // The case result the remark belongs to (null once removed) and its saved code/title.
    caseResultId: string | null;
    caseCode: string | null;
    caseTitle: string;
    // Null: overall feedback on the case rather than a step.
    stepText: string | null;
    stepOrder: number | null;
    remarkText: string;
    evidenceLinks: { label: string; url: string }[];
    attachmentIds: string[];
};

// A failed test case cited directly (0082). Code/title are saved copies; the rest is read live from the result.
export type defectCase = {
    caseResultId: string | null;
    caseCode: string | null;
    caseTitle: string;
    // Where the result lives (null once it's removed), for the link back to Test Results.
    sectionSlug: string | null;
    organizationId: string | null;
    // The result's tester and verdict (null once the result is removed or nobody has run it).
    executorName: string | null;
    // Organization type of the tester, for the avatar colour.
    executorOrgType: string | null;
    resultStatus: Database["public"]["Enums"]["test_case_status"] | null;
    completedAt: string | null;
};

export type defectExternalRef = { label: string; url: string };

export type defect = {
    id: string;
    number: number;
    // DEF-001, DEF-012, ... per suite.
    code: string;
    iterationId: string;
    summary: string;
    precondition: string;
    stepsToReproduce: string;
    expectedResult: string;
    actualResult: string;
    severity: defectSeverity;
    status: defectStatus;
    createdAt: string;
    // Cited remarks (step order first) and cited failed cases.
    references: defectReference[];
    cases: defectCase[];
    externalRefs: defectExternalRef[];
    // The first cited case (else the first remark's case): names the defect's reference and links back to its result.
    // Null when nothing is cited.
    primaryCase: defectCase | null;
};

type caseResultJoin = {
    section_slug: string | null;
    organization_id: string | null;
    status: Database["public"]["Enums"]["test_case_status"];
    completed_at: string | null;
    executor: { full_name: string | null; organization: { type: string } | null } | null;
};

type defectRow = Database["public"]["Tables"]["defects"]["Row"] & {
    defect_remarks: Database["public"]["Tables"]["defect_remarks"]["Row"][];
    defect_external_refs: Database["public"]["Tables"]["defect_external_refs"]["Row"][];
    defect_cases: (Database["public"]["Tables"]["defect_cases"]["Row"] & { test_case_results: caseResultJoin | null })[];
};

// One query shape for every defect read, so toDefect always gets what it needs.
export const DEFECT_SELECT =
    "*, defect_remarks(*), defect_external_refs(*), defect_cases(*, test_case_results(section_slug, organization_id, status, completed_at, executor:profiles!test_case_results_executed_by_fkey(full_name, organization:organizations(type))))";

export function toDefect(row: defectRow): defect {
    const references = [...row.defect_remarks]
        .sort((a, b) => (a.case_code ?? "").localeCompare(b.case_code ?? "") || (a.step_order ?? Infinity) - (b.step_order ?? Infinity))
        .map((r) => ({
            remarkId: r.remark_id,
            caseResultId: r.case_result_id,
            caseCode: r.case_code,
            caseTitle: r.case_title,
            stepText: r.step_text,
            stepOrder: r.step_order,
            remarkText: r.remark_text,
            evidenceLinks: (r.evidence_links as { label: string; url: string }[] | null) ?? [],
            attachmentIds: r.attachment_ids,
        }));
    const cases = [...row.defect_cases]
        .sort((a, b) => (a.case_code ?? "").localeCompare(b.case_code ?? ""))
        .map((c) => ({
            caseResultId: c.case_result_id,
            caseCode: c.case_code,
            caseTitle: c.case_title,
            sectionSlug: c.test_case_results?.section_slug ?? null,
            organizationId: c.test_case_results?.organization_id ?? null,
            executorName: c.test_case_results?.executor?.full_name ?? null,
            executorOrgType: c.test_case_results?.executor?.organization?.type ?? null,
            resultStatus: c.test_case_results?.status ?? null,
            completedAt: c.test_case_results?.completed_at ?? null,
        }));
    const fromRemark = references[0]
        ? { caseResultId: references[0].caseResultId, caseCode: references[0].caseCode, caseTitle: references[0].caseTitle, sectionSlug: null, organizationId: null, executorName: null, executorOrgType: null, resultStatus: null, completedAt: null }
        : null;
    return {
        id: row.id,
        number: row.number,
        code: defectCode(row.number),
        iterationId: row.iteration_id,
        summary: row.summary,
        precondition: row.precondition,
        stepsToReproduce: row.steps_to_reproduce,
        expectedResult: row.expected_result,
        actualResult: row.actual_result,
        severity: row.severity,
        status: row.status,
        createdAt: row.created_at,
        references,
        cases,
        externalRefs: [...row.defect_external_refs].sort((a, b) => a.position - b.position).map((e) => ({ label: e.label, url: e.url })),
        primaryCase: cases[0] ?? fromRemark,
    };
}

// One round's defects, newest first. RLS returns nothing to external users.
export async function getDefects(suiteId: string, iterationId: string): Promise<defect[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("defects")
        .select(DEFECT_SELECT)
        .eq("testing_suite_id", suiteId)
        .eq("iteration_id", iterationId)
        .order("number", { ascending: false });
    if (error) throw error;
    return data.map(toDefect);
}

// Defects of a round per case result they cite (directly or through one of its remarks), for the Test Results
// Defects column. Staff only; RLS gives anyone else nothing. Each defect is listed once per case result.
export async function getIterationDefectsByCase(iterationId: string): Promise<Map<string, { id: string; status: defectStatus }[]>> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("defects")
        .select("id, status, defect_cases ( case_result_id ), defect_remarks ( case_result_id )")
        .eq("iteration_id", iterationId);
    if (error) throw error;
    const byCase = new Map<string, Map<string, { id: string; status: defectStatus }>>();
    for (const d of data) {
        const caseIds = [...d.defect_cases, ...d.defect_remarks].flatMap((r) => (r.case_result_id ? [r.case_result_id] : []));
        for (const caseId of caseIds) {
            const list = byCase.get(caseId) ?? new Map();
            list.set(d.id, { id: d.id, status: d.status as defectStatus });
            byCase.set(caseId, list);
        }
    }
    return new Map([...byCase].map(([caseId, list]) => [caseId, [...list.values()]]));
}

// Failed cases in a round that nobody has logged a defect for yet.
export async function getAwaitingDefectCount(iterationId: string, defects: defect[]): Promise<number> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_case_results")
        .select("id")
        .eq("iteration_id", iterationId)
        .eq("included_in_run", true)
        .eq("status", "Failed");
    if (error) throw error;
    const reported = new Set(defects.flatMap((d) => [...d.cases, ...d.references].map((c) => c.caseResultId)));
    return data.filter((r) => !reported.has(r.id)).length;
}

