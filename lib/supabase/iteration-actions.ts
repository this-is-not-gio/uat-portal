"use server"

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PLACEHOLDER_PIC_ID } from "./placeholder-actor";
import type { profile, testCaseStatus, testStepStatus } from "./test-cases";
import type { Database } from "./database.types";

// Lifecycle rules live in Postgres (see the suite lifecycle RPCs), so their
// messages are what the user needs to see. Server Action errors are masked in
// production, so failures come back as values instead of being thrown.
export type actionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: { message: string }): { ok: false; error: string } {
    console.error("Iteration action failed:", error.message);
    return { ok: false, error: error.message };
}

export type caseResultState = {
    status: testCaseStatus;
    statusOverridden: boolean;
    completedAt: string | null;
    executor?: profile;
};

async function readCaseResultState(caseResultId: string): Promise<actionResult<caseResultState>> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_case_results")
        .select("status, status_overridden, completed_at, executor:profiles!test_case_results_executed_by_fkey ( id, full_name, role )")
        .eq("id", caseResultId)
        .single();
    if (error) return fail(error);
    return {
        ok: true,
        data: {
            status: data.status,
            statusOverridden: data.status_overridden,
            completedAt: data.completed_at,
            executor: data.executor ?? undefined,
        },
    };
}

// Suite lifecycle ------------------------------------------------------------

export async function setSuiteStatus({ suiteId, status }: { suiteId: string; status: Database["public"]["Enums"]["suite_status"] }): Promise<actionResult> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_suite_status", { p_suite_id: suiteId, p_status: status });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Signs off on the latest completed iteration; a note is required unless every case passed.
export async function signOffSuite({ suiteId, note }: { suiteId: string; note: string }): Promise<actionResult> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("sign_off_suite", { p_suite_id: suiteId, p_by: PLACEHOLDER_PIC_ID, p_note: note || undefined });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Iterations -----------------------------------------------------------------

// The round's scope: only the picked (complete) test cases are copied in.
export async function startIteration({ suiteId, label, plannedEndDate, testCaseIds }: { suiteId: string; label?: string; plannedEndDate?: string; testCaseIds: string[] }): Promise<actionResult<{ iterationNumber: number }>> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_iteration", {
        p_suite_id: suiteId,
        p_created_by: PLACEHOLDER_PIC_ID,
        p_label: label || undefined,
        p_planned_end_date: plannedEndDate || undefined,
        p_test_case_ids: testCaseIds,
    });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: { iterationNumber: data.iteration_number } };
}

export async function completeIteration({ iterationId }: { iterationId: string }): Promise<actionResult> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("complete_iteration", { p_iteration_id: iterationId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

export async function cancelIteration({ iterationId }: { iterationId: string }): Promise<actionResult> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_iteration", { p_iteration_id: iterationId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Recording results on the iteration snapshot ------------------------------

// The case status is re-derived from its steps by a DB trigger (unless overridden),
// so the caller gets the resulting case state back.
export async function setStepResultStatus({ caseResultId, stepResultId, status }: { caseResultId: string; stepResultId: string; status: testStepStatus }): Promise<actionResult<caseResultState>> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("test_step_results")
        .update({ status })
        .eq("id", stepResultId)
        .eq("test_case_result_id", caseResultId);
    if (error) return fail(error);

    // Last write wins: whoever touched a step is the case's executor.
    const { error: executorError } = await supabase
        .from("test_case_results")
        .update({ executed_by: PLACEHOLDER_PIC_ID })
        .eq("id", caseResultId);
    if (executorError) return fail(executorError);

    return readCaseResultState(caseResultId);
}

// Manual override of the derived case status.
export async function setCaseResultStatus({ caseResultId, status }: { caseResultId: string; status: testCaseStatus }): Promise<actionResult<caseResultState>> {
    const supabase = await createClient();
    const { error } = await supabase
        .from("test_case_results")
        .update({
            status,
            status_overridden: true,
            executed_by: PLACEHOLDER_PIC_ID,
            completed_at: new Date().toISOString(),
        })
        .eq("id", caseResultId);
    if (error) return fail(error);
    return readCaseResultState(caseResultId);
}

export async function resetCaseResultToAuto({ caseResultId }: { caseResultId: string }): Promise<actionResult<caseResultState>> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("recompute_case_result_status", { p_case_result_id: caseResultId });
    if (error) return fail(error);
    return readCaseResultState(caseResultId);
}

export async function addResultRemark({ stepResultId, remark }: { stepResultId: string; remark: string }): Promise<actionResult<{ id: string; remark: string; created_at: string; author?: profile }>> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_remarks")
        .insert({ test_step_result_id: stepResultId, remark, created_by: PLACEHOLDER_PIC_ID })
        .select("id, remark, created_at, profile:profiles ( id, full_name, role )")
        .single();
    if (error) return fail(error);
    return { ok: true, data: { id: data.id, remark: data.remark, created_at: data.created_at, author: data.profile ?? undefined } };
}

export type scopeOption = { id: string; code: string | null; title: string; issues: string[] };

// What the Start Iteration picker lists: every section and its test cases,
// each marked with whatever completeness issues it has (empty = pickable).
export async function getIterationScopeOptions({ suiteId }: { suiteId: string }): Promise<actionResult<{ sections: { id: string; name: string; testCases: scopeOption[] }[] }>> {
    const supabase = await createClient();
    const [sectionsResult, issuesResult] = await Promise.all([
        supabase
            .from("sections")
            .select("id, name, order_index, test_cases ( id, code, title, order_index )")
            .eq("test_suite_id", suiteId)
            .order("order_index", { ascending: true })
            .order("order_index", { referencedTable: "test_cases", ascending: true }),
        supabase.rpc("suite_test_case_issues", { p_suite_id: suiteId }),
    ]);
    if (sectionsResult.error) return fail(sectionsResult.error);
    if (issuesResult.error) return fail(issuesResult.error);

    return {
        ok: true,
        data: {
            sections: sectionsResult.data.map((section) => ({
                id: section.id,
                name: section.name,
                testCases: section.test_cases.map((tc) => ({
                    id: tc.id,
                    code: tc.code,
                    title: tc.title,
                    issues: issuesResult.data.filter((issue) => issue.test_case_id === tc.id).map((issue) => issue.issue),
                })),
            })),
        },
    };
}
