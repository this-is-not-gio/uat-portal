"use server"

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./auth";
import { can, denied } from "@/lib/auth/permissions";
import type { defectSeverity } from "./defects";
import { defectCode, jiraUrlError } from "./defect-format";

type result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// Staff log a defect from remarks on a failed case result; Postgres checks the remarks belong to it and failed.
export async function createDefect(input: { caseResultId: string; remarkIds: string[]; summary: string; description: string; severity: defectSeverity; jiraUrl: string }): Promise<result<{ id: string; code: string }>> {
    const user = await requireUser();
    if (!can(user, "view_all_results")) return denied("view_all_results");
    const summary = input.summary.trim();
    if (!summary) return { ok: false, error: "A summary is required." };
    if (summary.length > 200) return { ok: false, error: "The summary can be at most 200 characters." };
    const jiraError = jiraUrlError(input.jiraUrl);
    if (jiraError) return { ok: false, error: jiraError };
    if (input.remarkIds.length === 0) return { ok: false, error: "Pick at least one remark." };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_defect", {
        p_case_result_id: input.caseResultId,
        p_remark_ids: input.remarkIds,
        p_summary: summary,
        p_description: input.description,
        p_severity: input.severity,
        p_jira_url: input.jiraUrl.trim() || undefined,
    });
    if (error) {
        console.error("Create defect failed:", error.message);
        return { ok: false, error: error.message };
    }
    refresh();
    return { ok: true, data: { id: data.id, code: defectCode(data.number) } };
}
