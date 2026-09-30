"use server"

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./auth";
import { can, denied } from "@/lib/auth/permissions";
import type { profile, testCaseStatus, testStepStatus } from "./test-cases";
import type { Database } from "./database.types";
import { getOrganizations, getTesterCountsByOrg, type organization } from "./organizations";
import { getIterationParticipants } from "./test-iterations";

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
    const user = await requireUser();
    const permission = status === "archived" ? "archive" : "author";
    if (!can(user, permission)) return denied(permission);
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_suite_status", { p_suite_id: suiteId, p_status: status });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Vendor issues the sign-off on the latest completed iteration (every round must be finished).
// Untested cases are only warned about in the dialog; the note is optional.
export async function issueSignOff({ suiteId, note }: { suiteId: string; note: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "issue_sign_off")) return denied("issue_sign_off");
    const supabase = await createClient();
    const { error } = await supabase.rpc("issue_sign_off", { p_suite_id: suiteId, p_by: user.id, p_note: note || undefined });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Client acknowledges the issued sign-off, which closes the suite (signed_off).
export async function acknowledgeSignOff({ suiteId }: { suiteId: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "sign_off")) return denied("sign_off");
    const supabase = await createClient();
    const { error } = await supabase.rpc("acknowledge_sign_off", { p_suite_id: suiteId, p_by: user.id });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Iterations -----------------------------------------------------------------

// The round's scope: only the picked (complete) test cases are copied in, once per
// participating org and filtered by each case's audience. orgIds omitted = the client org(s).
export async function startIteration({ suiteId, label, plannedEndDate, testCaseIds, orgIds }: { suiteId: string; label?: string; plannedEndDate?: string; testCaseIds: string[]; orgIds?: string[] }): Promise<actionResult<{ iterationNumber: number }>> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_iteration", {
        p_suite_id: suiteId,
        p_created_by: user.id,
        p_label: label || undefined,
        p_planned_end_date: plannedEndDate || undefined,
        p_test_case_ids: testCaseIds,
        p_org_ids: orgIds,
    });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: { iterationNumber: data.iteration_number } };
}

// Brings another org into the running round with the same scope as everyone else.
export async function addParticipant({ iterationId, organizationId }: { iterationId: string; organizationId: string }): Promise<actionResult<{ addedCount: number }>> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("add_iteration_participant", { p_iteration_id: iterationId, p_org_id: organizationId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: { addedCount: data } };
}

// Withdraws an org from a planned/running round — only while it has no recorded results (0024).
export async function removeParticipant({ iterationId, organizationId }: { iterationId: string; organizationId: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    const supabase = await createClient();
    const { error } = await supabase.rpc("remove_iteration_participant", { p_iteration_id: iterationId, p_org_id: organizationId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// What the org pickers list: every org, plus (for a running round) which already take part.
export async function getParticipantOptions({ iterationId }: { iterationId?: string } = {}): Promise<actionResult<{ organizations: organization[]; participantIds: string[]; testerCounts: Record<string, number> }>> {
    try {
        const [organizations, participants, testerCounts] = await Promise.all([
            getOrganizations(),
            iterationId ? getIterationParticipants(iterationId) : Promise.resolve([]),
            getTesterCountsByOrg(),
        ]);
        return { ok: true, data: { organizations, participantIds: participants.map((p) => p.organization.id), testerCounts } };
    } catch (error) {
        return fail(error as { message: string });
    }
}

// not_started -> in_progress: testing (recording results) can begin.
export async function beginIteration({ iterationId }: { iterationId: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    const supabase = await createClient();
    const { error } = await supabase.rpc("begin_iteration", { p_iteration_id: iterationId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// in_progress -> stopped: ends the round early. Results freeze but don't count toward sign-off.
export async function stopIteration({ iterationId }: { iterationId: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    const supabase = await createClient();
    const { error } = await supabase.rpc("stop_iteration", { p_iteration_id: iterationId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

export async function completeIteration({ iterationId }: { iterationId: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    const supabase = await createClient();
    const { error } = await supabase.rpc("complete_iteration", { p_iteration_id: iterationId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

export async function cancelIteration({ iterationId }: { iterationId: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_iteration", { p_iteration_id: iterationId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Participation (External orgs) ----------------------------------------------

// Marks the caller's org as done with this round. After this the DB rejects that org's
// result writes (0014's guard) until it withdraws. Submitting never closes the round: it stays
// in progress until an Admin/Internal user completes it (0019).
export async function submitParticipation({ iterationId }: { iterationId: string }): Promise<actionResult<{ submittedAt: string }>> {
    const user = await requireUser();
    if (!can(user, "submit")) return denied("submit");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("submit_participation", { p_iteration_id: iterationId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: { submittedAt: data.submitted_at ?? new Date().toISOString() } };
}

export async function withdrawParticipation({ iterationId }: { iterationId: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "submit")) return denied("submit");
    const supabase = await createClient();
    const { error } = await supabase.rpc("withdraw_participation", { p_iteration_id: iterationId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Edits an iteration's label/planned end date — its name and slug (what the
// URL and numbering depend on) are never touched by this.
export async function updateIterationDetails({ iterationId, label, plannedEndDate }: { iterationId: string; label?: string; plannedEndDate?: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_iteration_details", {
        p_iteration_id: iterationId,
        p_label: label || undefined,
        p_planned_end_date: plannedEndDate || undefined,
    });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Recording results on the iteration snapshot ------------------------------

// The case status is re-derived from its steps by a DB trigger (unless overridden),
// so the caller gets the resulting case state back.
export async function setStepResultStatus({ caseResultId, stepResultId, status }: { caseResultId: string; stepResultId: string; status: testStepStatus }): Promise<actionResult<caseResultState>> {
    const user = await requireUser();
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
        .update({ executed_by: user.id })
        .eq("id", caseResultId);
    if (executorError) return fail(executorError);

    return readCaseResultState(caseResultId);
}

// Manual override of the derived case status.
export async function setCaseResultStatus({ caseResultId, status }: { caseResultId: string; status: testCaseStatus }): Promise<actionResult<caseResultState>> {
    const user = await requireUser();
    const supabase = await createClient();
    const { error } = await supabase
        .from("test_case_results")
        .update({
            status,
            status_overridden: true,
            executed_by: user.id,
            completed_at: new Date().toISOString(),
        })
        .eq("id", caseResultId);
    if (error) return fail(error);
    return readCaseResultState(caseResultId);
}

//Saving or including the testcase for the given iterations 
// Every org's row of a case goes in one call. Admin only; excluding a row that already has
// results is rejected by set_case_inclusion (0022) with a message fit to show the user.
export async function setCaseResultInclusion({ caseResultIds, included }: { caseResultIds: string[]; included: boolean }): Promise<actionResult> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_case_inclusion", { p_case_result_ids: caseResultIds, p_included: included });
    if (error) return fail(error);
    return { ok: true, data: undefined };
}

export async function resetCaseResultToAuto({ caseResultId }: { caseResultId: string }): Promise<actionResult<caseResultState>> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("recompute_case_result_status", { p_case_result_id: caseResultId });
    if (error) return fail(error);
    return readCaseResultState(caseResultId);
}

export async function addResultRemark({ stepResultId, remark }: { stepResultId: string; remark: string }): Promise<actionResult<{ id: string; remark: string; created_at: string; author?: profile }>> {
    const user = await requireUser();
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("test_remarks")
        .insert({ test_step_result_id: stepResultId, remark, created_by: user.id })
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
