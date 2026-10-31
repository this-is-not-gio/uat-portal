"use server"

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./auth";
import { can, denied } from "@/lib/auth/permissions";
import { DEFECT_SELECT, toDefect, type defect, type defectSeverity, type defectStatus } from "./defects";
import { defectCode, externalUrlError } from "./defect-format";
import { listRemarkAttachments, type signedAttachment } from "./attachment-actions";
import type { testRemark } from "./test-cases";

type result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type defectFields = {
    summary: string;
    precondition: string;
    stepsToReproduce: string;
    expectedResult: string;
    actualResult: string;
    severity: defectSeverity;
};
export type defectLinks = {
    remarkIds: string[];
    caseResultIds: string[];
    externalRefs: { label: string; url: string }[];
};

// Shared checks; Postgres repeats them and also checks every reference is on a failed result of the round.
function validate(input: defectFields & Partial<defectLinks>): { summary: string; externalRefs: { label: string; url: string }[] | undefined } | string {
    const summary = input.summary.trim();
    if (!summary) return "A summary is required.";
    if (summary.length > 200) return "The summary can be at most 200 characters.";
    const externalRefs = input.externalRefs?.map((e) => ({ label: e.label.trim(), url: e.url.trim() })).filter((e) => e.url);
    for (const e of externalRefs ?? []) {
        const error = externalUrlError(e.url);
        if (error) return error;
    }
    return { summary, externalRefs };
}

// Staff log a defect on a round, citing remarks and/or failed cases from it.
export async function createDefect(input: defectFields & defectLinks & { iterationId: string }): Promise<result<{ id: string; code: string }>> {
    const user = await requireUser();
    if (!can(user, "view_all_results")) return denied("view_all_results");
    const checked = validate(input);
    if (typeof checked === "string") return { ok: false, error: checked };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_defect", {
        p_iteration_id: input.iterationId,
        p_summary: checked.summary,
        p_precondition: input.precondition,
        p_steps_to_reproduce: input.stepsToReproduce,
        p_expected_result: input.expectedResult,
        p_actual_result: input.actualResult,
        p_severity: input.severity,
        p_remark_ids: input.remarkIds,
        p_case_result_ids: input.caseResultIds,
        p_external: checked.externalRefs ?? [],
    });
    if (error) {
        console.error("Create defect failed:", error.message);
        return { ok: false, error: error.message };
    }
    refresh();
    return { ok: true, data: { id: data.id, code: defectCode(data.number) } };
}

// Reference lists left out stay as they are (a status or severity change doesn't need them).
export async function updateDefect(input: defectFields & Partial<defectLinks> & { id: string; status: defectStatus }): Promise<result> {
    const user = await requireUser();
    if (!can(user, "view_all_results")) return denied("view_all_results");
    const checked = validate(input);
    if (typeof checked === "string") return { ok: false, error: checked };
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_defect", {
        p_defect_id: input.id,
        p_summary: checked.summary,
        p_precondition: input.precondition,
        p_steps_to_reproduce: input.stepsToReproduce,
        p_expected_result: input.expectedResult,
        p_actual_result: input.actualResult,
        p_severity: input.severity,
        p_status: input.status,
        p_remark_ids: input.remarkIds,
        p_case_result_ids: input.caseResultIds,
        p_external: checked.externalRefs,
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

// Every defect citing this case result, directly or through one of its remarks; the sheet matches them to remarks by remarkId.
export async function getCaseDefects(caseResultId: string): Promise<result<defect[]>> {
    const user = await requireUser();
    if (!can(user, "view_all_results")) return { ok: true, data: [] };
    const supabase = await createClient();
    const [viaCases, viaRemarks] = await Promise.all([
        supabase.from("defect_cases").select("defect_id").eq("case_result_id", caseResultId),
        supabase.from("defect_remarks").select("defect_id").eq("case_result_id", caseResultId),
    ]);
    const failure = viaCases.error ?? viaRemarks.error;
    if (failure) {
        console.error("Load case defects failed:", failure.message);
        return { ok: false, error: failure.message };
    }
    const ids = [...new Set([...(viaCases.data ?? []), ...(viaRemarks.data ?? [])].map((r) => r.defect_id))];
    if (ids.length === 0) return { ok: true, data: [] };
    const { data, error } = await supabase.from("defects").select(DEFECT_SELECT).in("id", ids).order("number", { ascending: true });
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
        .select("id, remark, created_at, test_step_result_id, test_case_result_id, author:profiles ( id, full_name, role ), step_result:test_step_results ( case_result:test_case_results ( tester_id, test_role:test_roles ( name ) ) ), case_result:test_case_results ( tester_id, test_role:test_roles ( name ) )")
        .or(parents.join(","))
        .order("created_at", { ascending: true });
    if (error) return { ok: false, error: error.message };

    const threadKey = (r: { test_step_result_id: string | null; test_case_result_id: string | null }) => r.test_step_result_id ?? r.test_case_result_id;
    const toRemark = (r: (typeof rows)[number]): testRemark => {
        const owner = r.step_result?.case_result ?? r.case_result;
        return { id: r.id, remark: r.remark, created_at: r.created_at, author: r.author ?? undefined, roleName: r.author?.id === owner?.tester_id ? owner?.test_role?.name : undefined };
    };
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

// The round a case result belongs to and every failed case in it, for the create dialog's "Link items" picker. Staff only.
export async function getRoundFailedCases(caseResultId: string): Promise<result<{ iterationId: string; cases: { id: string; code: string | null; title: string }[] }>> {
    const user = await requireUser();
    if (!can(user, "view_all_results")) return denied("view_all_results");
    const supabase = await createClient();
    const { data: current, error: currentError } = await supabase.from("test_case_results").select("iteration_id").eq("id", caseResultId).maybeSingle();
    if (currentError) return { ok: false, error: currentError.message };
    if (!current) return { ok: false, error: "That test case result no longer exists." };
    const { data, error } = await supabase
        .from("test_case_results")
        .select("id, code, title")
        .eq("iteration_id", current.iteration_id)
        .eq("included_in_run", true)
        .eq("status", "Failed")
        .order("code", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { iterationId: current.iteration_id, cases: data } };
}

// Failed cases of a round, for the defect sheet's edit mode. Staff only.
export async function getIterationFailedCases(iterationId: string): Promise<result<{ id: string; code: string | null; title: string }[]>> {
    const user = await requireUser();
    if (!can(user, "view_all_results")) return denied("view_all_results");
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_case_results")
        .select("id, code, title")
        .eq("iteration_id", iterationId)
        .eq("included_in_run", true)
        .eq("status", "Failed")
        .order("code", { ascending: true });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
}
