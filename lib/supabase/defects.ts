import { createClient } from "@/lib/supabase/server";
import type { Database } from "./database.types";
import { defectCode } from "./defect-format";

export type defectSeverity = Database["public"]["Enums"]["defect_severity"];
export type defectStatus = Database["public"]["Enums"]["defect_status"];

// A cited remark as saved on the defect (0080): a copy that outlives the remark itself.
export type defectReference = {
    remarkId: string | null;
    // Null: overall feedback on the case rather than a step.
    stepText: string | null;
    stepOrder: number | null;
    remarkText: string;
    evidenceLinks: { label: string; url: string }[];
    attachmentIds: string[];
};

export type defect = {
    id: string;
    number: number;
    // DEF-001, DEF-012, ... per suite.
    code: string;
    iterationId: string;
    testCaseResultId: string | null;
    caseCode: string | null;
    caseTitle: string;
    summary: string;
    description: string;
    severity: defectSeverity;
    status: defectStatus;
    jiraUrl: string | null;
    createdAt: string;
    references: defectReference[];
};

type defectRow = Database["public"]["Tables"]["defects"]["Row"] & { defect_remarks: Database["public"]["Tables"]["defect_remarks"]["Row"][] };

export function toDefect(row: defectRow): defect {
    return {
        id: row.id,
        number: row.number,
        code: defectCode(row.number),
        iterationId: row.iteration_id,
        testCaseResultId: row.test_case_result_id,
        caseCode: row.case_code,
        caseTitle: row.case_title,
        summary: row.summary,
        description: row.description,
        severity: row.severity,
        status: row.status,
        jiraUrl: row.jira_url,
        createdAt: row.created_at,
        references: [...row.defect_remarks]
            .sort((a, b) => (a.step_order ?? Infinity) - (b.step_order ?? Infinity))
            .map((r) => ({
                remarkId: r.remark_id,
                stepText: r.step_text,
                stepOrder: r.step_order,
                remarkText: r.remark_text,
                evidenceLinks: (r.evidence_links as { label: string; url: string }[] | null) ?? [],
                attachmentIds: r.attachment_ids,
            })),
    };
}

// One round's defects, newest first. RLS returns nothing to external users.
export async function getDefects(suiteId: string, iterationId: string): Promise<defect[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("defects")
        .select("*, defect_remarks(*)")
        .eq("testing_suite_id", suiteId)
        .eq("iteration_id", iterationId)
        .order("number", { ascending: false });
    if (error) throw error;
    return data.map(toDefect);
}
