"use server"

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./auth";
import { can, denied } from "@/lib/auth/permissions";
import { toDefect, type defect, type defectSeverity, type defectStatus } from "./defects";
import { defectCode, jiraUrlError } from "./defect-format";
import { listRemarkAttachments, type signedAttachment } from "./attachment-actions";
import type { testRemark } from "./test-cases";

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

export async function updateDefect(input: { id: string; summary: string; description: string; severity: defectSeverity; status: defectStatus; jiraUrl: string }): Promise<result> {
    const user = await requireUser();
    if (!can(user, "view_all_results")) return denied("view_all_results");
    const summary = input.summary.trim();
    if (!summary) return { ok: false, error: "A summary is required." };
    if (summary.length > 200) return { ok: false, error: "The summary can be at most 200 characters." };
    const jiraError = jiraUrlError(input.jiraUrl);
    if (jiraError) return { ok: false, error: jiraError };
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_defect", {
        p_defect_id: input.id,
        p_summary: summary,
        p_description: input.description,
        p_severity: input.severity,
        p_status: input.status,
        p_jira_url: input.jiraUrl.trim(),
    });
    if (error) {
        console.error("Update defect failed:", error.message);
        return { ok: false, error: error.message };
    }
    refresh();
    return { ok: true, data: undefined };
}

export async function deleteDefect(id: string): Promise<result> {
    const user = await requireUser();
    if (!can(user, "view_all_results")) return denied("view_all_results");
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_defect", { p_defect_id: id });
    if (error) {
        console.error("Delete defect failed:", error.message);
        return { ok: false, error: error.message };
    }
    refresh();
    return { ok: true, data: undefined };
}

// Every defect citing a remark on this case result, in one query; the sheet matches them to remarks by remarkId.
export async function getCaseDefects(caseResultId: string): Promise<result<defect[]>> {
    const user = await requireUser();
    if (!can(user, "view_all_results")) return { ok: true, data: [] };
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("defects")
        .select("*, defect_remarks(*), test_case_results(section_slug, organization_id, status, completed_at, executor:profiles!test_case_results_executed_by_fkey(full_name, organization:organizations(type)))")
        .eq("test_case_result_id", caseResultId)
        .order("number", { ascending: true });
    if (error) {
        console.error("Load case defects failed:", error.message);
        return { ok: false, error: error.message };
    }
    return { ok: true, data: data.map(toDefect) };
}

// The whole thread behind each remark a defect cites (every remark on that step, or on the case for overall feedback),
// keyed by the cited remark's id, with the evidence files of all of them. Staff only; a removed remark has no thread.
export async function getDefectThreads(defectId: string): Promise<result<{ threads: Record<string, testRemark[]>; files: Record<string, signedAttachment[]> }>> {
    const user = await requireUser();
    if (!can(user, "view_all_results")) return { ok: true, data: { threads: {}, files: {} } };
    const supabase = await createClient();
    const { data: refs, error: refError } = await supabase.from("defect_remarks").select("remark_id").eq("defect_id", defectId);
    if (refError) return { ok: false, error: refError.message };
    const cited = refs.flatMap((r) => (r.remark_id ? [r.remark_id] : []));
    if (cited.length === 0) return { ok: true, data: { threads: {}, files: {} } };

    const { data: sources, error: sourceError } = await supabase.from("test_remarks").select("id, test_step_result_id, test_case_result_id").in("id", cited);
    if (sourceError) return { ok: false, error: sourceError.message };
    const stepIds = [...new Set(sources.flatMap((r) => (r.test_step_result_id ? [r.test_step_result_id] : [])))];
    const caseIds = [...new Set(sources.flatMap((r) => (!r.test_step_result_id && r.test_case_result_id ? [r.test_case_result_id] : [])))];
    const parents = [
        ...(stepIds.length > 0 ? [`test_step_result_id.in.(${stepIds.join(",")})`] : []),
        ...caseIds.map((id) => `and(test_case_result_id.eq.${id},test_step_result_id.is.null)`),
    ];
    const { data: rows, error } = await supabase
        .from("test_remarks")
        .select("id, remark, created_at, test_step_result_id, test_case_result_id, author:profiles ( id, full_name, role )")
        .or(parents.join(","))
        .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message };

    const threadKey = (r: { test_step_result_id: string | null; test_case_result_id: string | null }) => r.test_step_result_id ?? r.test_case_result_id;
    const toRemark = (r: (typeof rows)[number]): testRemark => ({ id: r.id, remark: r.remark, created_at: r.created_at, author: r.author ?? undefined });
    const threads: Record<string, testRemark[]> = {};
    for (const source of sources) {
        threads[source.id] = rows.filter((r) => threadKey(r) === threadKey(source)).map(toRemark);
    }
    // One caseResultId per call, so overall-feedback threads are listed per case result.
    const files: Record<string, signedAttachment[]> = {};
    const lists = await Promise.all([
        listRemarkAttachments({ stepResultIds: stepIds }),
        ...caseIds.map((caseResultId) => listRemarkAttachments({ stepResultIds: [], caseResultId })),
    ]);
    for (const list of lists) if (list.ok) Object.assign(files, list.data);
    return { ok: true, data: { threads, files } };
}
