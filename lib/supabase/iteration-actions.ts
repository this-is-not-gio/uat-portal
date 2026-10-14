"use server"

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./auth";
import { signAttachmentsForRemark, type signedAttachment } from "./attachment-actions";
import { flushStorageDeletions } from "@/lib/storage/flush";
import { can, denied } from "@/lib/auth/permissions";
import type { profile, testCaseStatus, testStepStatus } from "./test-cases";
import type { Database, Json } from "./database.types";
import type { roundCoverage } from "./test-iterations";
import type { roundCaseFlag } from "./case-states";
import { buildSignOffReport, type SignOffReport } from "./sign-off-report";
import { validateThemes, type ThemeInput } from "@/lib/report/sign-off-remarks";
import { draftThemes, type ThemeDraft } from "@/lib/report/remark-themes";
import { validateSections, type ReportSection } from "@/lib/report/report-details";

// Lifecycle rules live in Postgres (see the suite lifecycle RPCs), so their
// messages are what the user needs to see. Server Action errors are masked in
// production, so failures come back as values instead of being thrown.
export type actionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: { message: string }): { ok: false; error: string } {
    console.error("Iteration action failed:", error.message);
    return { ok: false, error: error.message };
}

// Results are recorded only on your own copy of a case (0060).
const NOT_OWN_COPY = "You can only record results on your own copy of a test case.";

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
    // in_testing here is the vendor reopening testing after the client rejected the sign-off.
    const permission = status === "archived" ? "archive" : status === "in_testing" ? "issue_sign_off" : "author";
    if (!can(user, permission)) return denied(permission);
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_suite_status", { p_suite_id: suiteId, p_status: status });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// What the sign-off dialog shows before issuing. issueSignOff rebuilds it rather than taking
// this copy back from the client, so the frozen report is always computed on the server.
export async function previewSignOffReport({ suiteId }: { suiteId: string }): Promise<actionResult<SignOffReport>> {
    const user = await requireUser();
    if (!can(user, "issue_sign_off")) return denied("issue_sign_off");
    try {
        return { ok: true, data: await buildSignOffReport(suiteId) };
    } catch (error) {
        return fail(error as { message: string });
    }
}

// AI-drafted observations for the theme editor. Drafts only: the admin edits them and
// issueSignOff validates them like hand-written ones. Fails soft, so issuing never depends on it.
export async function draftSignOffThemes({ suiteId }: { suiteId: string }): Promise<actionResult<ThemeDraft>> {
    const user = await requireUser();
    if (!can(user, "issue_sign_off")) return denied("issue_sign_off");
    if (!process.env.GROQ_API_KEY) return { ok: false, error: "AI drafting isn't set up. Write observations by hand." };
    let report: SignOffReport;
    try {
        report = await buildSignOffReport(suiteId);
    } catch (error) {
        return fail(error as { message: string });
    }
    const remarks = report.remarks ?? [];
    if (remarks.length === 0) return { ok: false, error: "There are no tester remarks to draft from." };
    try {
        const draft = await draftThemes(remarks);
        if (draft.themes.length === 0) return { ok: false, error: "The AI didn't return usable observations. Write them by hand or try again." };
        return { ok: true, data: draft };
    } catch (error) {
        // Provider errors are noisy and may echo request details; log them, show a plain message.
        console.error("AI theme draft failed:", (error as Error).message);
        return { ok: false, error: "AI drafting failed. Write observations by hand or try again." };
    }
}

// Create sign-off: starts the vendor's draft (yellow, vendor-only) on the latest completed round.
// Also answers a rejection by drafting a new report (the suite goes back to in_testing).
export async function createSignOff({ suiteId }: { suiteId: string }): Promise<actionResult<{ id: string }>> {
    const user = await requireUser();
    if (!can(user, "issue_sign_off")) return denied("issue_sign_off");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_sign_off", { p_suite_id: suiteId, p_by: user.id });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: { id: data.id } };
}

// save_sign_off_draft replaces both note and report, so each save reads the draft and keeps
// whatever this one doesn't change: the dialog (note, themes) and the sections editor never clobber each other.
async function writeSignOffDraft(signOffId: string, change: { note?: string; themes?: ThemeInput[]; sections?: ReportSection[] }): Promise<actionResult> {
    const supabase = await createClient();
    const { data: current, error: readError } = await supabase.from("suite_sign_offs").select("note, report").eq("id", signOffId).eq("status", "drafting").maybeSingle();
    if (readError) return fail(readError);
    if (!current) return { ok: false, error: "This sign-off is no longer a draft" };
    const saved = (current.report ?? {}) as { themes?: unknown; sections?: unknown };
    const themes = change.themes === undefined ? saved.themes : change.themes.length > 0 ? { source: "manual", items: change.themes } : undefined;
    const sections = change.sections === undefined ? saved.sections : change.sections.length > 0 ? change.sections : undefined;
    const report = themes || sections ? { ...(themes ? { themes } : {}), ...(sections ? { sections } : {}) } : undefined;
    const note = change.note ?? current.note ?? "";
    const { error } = await supabase.rpc("save_sign_off_draft", { p_sign_off_id: signOffId, p_note: note || undefined, p_report: report as Json | undefined });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Keeps the vendor's note and observations on the draft. Themes are checked only on issue,
// so a half-written one can be saved.
export async function saveSignOffDraft({ signOffId, note, themes = [] }: { signOffId: string; note: string; themes?: ThemeInput[] }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "issue_sign_off")) return denied("issue_sign_off");
    return writeSignOffDraft(signOffId, { note, themes });
}

// The vendor's own sections on the Report details page, edited on the draft's document.
// Checked here too (not only on issue): each edit saves one complete section, so there's no half-written state to keep.
export async function saveSignOffSections({ signOffId, sections }: { signOffId: string; sections: ReportSection[] }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "issue_sign_off")) return denied("issue_sign_off");
    const checked = validateSections(sections);
    if (!checked.ok) return { ok: false, error: checked.error };
    return writeSignOffDraft(signOffId, { sections: checked.sections });
}

export async function discardSignOffDraft({ signOffId }: { signOffId: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "issue_sign_off")) return denied("issue_sign_off");
    const supabase = await createClient();
    const { error } = await supabase.rpc("discard_sign_off_draft", { p_sign_off_id: signOffId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Issue sign-off: sends the draft to the client (blue) on the latest completed iteration (every
// round must be finished). Untested cases are only warned about in the dialog; the note is optional.
// The report is rebuilt here and frozen into suite_sign_offs.report. Themes are optional vendor
// observations; each one must cite remarks from the catalog rebuilt here, never the client's copy.
export async function issueSignOff({ suiteId, signOffId, note, themes = [], sections = [] }: { suiteId: string; signOffId: string; note: string; themes?: ThemeInput[]; sections?: ReportSection[] }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "issue_sign_off")) return denied("issue_sign_off");
    let report: SignOffReport;
    try {
        report = await buildSignOffReport(suiteId);
    } catch (error) {
        return fail(error as { message: string });
    }
    const checked = validateThemes(themes, report.remarks ?? []);
    if (!checked.ok) return { ok: false, error: checked.error };
    report.themes = checked.themes.length > 0 ? { source: "manual", items: checked.themes } : null;
    const checkedSections = validateSections(sections);
    if (!checkedSections.ok) return { ok: false, error: checkedSections.error };
    if (checkedSections.sections.length > 0) report.sections = checkedSections.sections;
    const supabase = await createClient();
    const { error } = await supabase.rpc("issue_sign_off", { p_sign_off_id: signOffId, p_by: user.id, p_note: note || undefined, p_report: report as unknown as Json });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Client rejects the issued sign-off with a reason. The suite stays locked (sign_off_rejected)
// until the vendor reopens testing or creates a new report.
export async function rejectSignOff({ suiteId, reason }: { suiteId: string; reason: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "sign_off")) return denied("sign_off");
    if (!reason.trim()) return { ok: false, error: "Give a reason for rejecting the sign-off." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("reject_sign_off", { p_suite_id: suiteId, p_by: user.id, p_reason: reason.trim() });
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

// Plans an empty round (0027): sections and testers are picked on the round's page,
// and begin_iteration checks there's something to test. Name and planned end date are required.
export async function startIteration({ suiteId, name, plannedEndDate }: { suiteId: string; name?: string; plannedEndDate?: string }): Promise<actionResult<{ iterationNumber: number; slug: string }>> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    if (!name?.trim()) return { ok: false, error: "Give the iteration a name." };
    if (!plannedEndDate) return { ok: false, error: "Pick a planned end date." };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_iteration", {
        p_suite_id: suiteId,
        p_created_by: user.id,
        p_name: name.trim(),
        p_planned_end_date: plannedEndDate,
    });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: { iterationNumber: data.iteration_number, slug: data.slug } };
}

// Coverage of a candidate scope for the round wizard (get_round_coverage, 0058). Nothing is
// saved: the wizard keeps the scope and the unticked users until createRound.
export async function previewRoundCoverage({ suiteId, testCaseIds, excludedUserIds }: { suiteId: string; testCaseIds: string[]; excludedUserIds: string[] }): Promise<actionResult<roundCoverage>> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    // createRound needs it too; better to say so before the user fills in four steps.
    if (!can(user, "sync")) return denied("sync");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_round_coverage", { p_suite_id: suiteId, p_test_case_ids: testCaseIds, p_excluded_user_ids: excludedUserIds });
    if (error) return fail(error);
    // Built by round_coverage in this shape.
    return { ok: true, data: data as unknown as roundCoverage };
}

// The wizard's final step: plans the round, adds the chosen cases and records the unticked
// users. The round isn't started (begin_iteration still gates on coverage), so it stays editable
// on its page. If a later step fails the half-built round is cancelled rather than left behind.
export async function createRound({ suiteId, name, plannedEndDate, testCaseIds, excludedUserIds }: { suiteId: string; name?: string; plannedEndDate?: string; testCaseIds: string[]; excludedUserIds: string[] }): Promise<actionResult<{ iterationNumber: number; slug: string }>> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    if (!can(user, "sync")) return denied("sync");
    if (testCaseIds.length === 0) return { ok: false, error: "Pick at least one test case for the round." };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("start_iteration", {
        p_suite_id: suiteId,
        p_created_by: user.id,
        p_name: name || undefined,
        p_planned_end_date: plannedEndDate || undefined,
    });
    if (error) return fail(error);

    const abandon = async (failure: { message: string }) => {
        const { error: cancelError } = await supabase.rpc("cancel_iteration", { p_iteration_id: data.id });
        if (cancelError) {
            console.error("Cleanup of the half-built round failed:", cancelError.message);
            return fail({ message: `${failure.message} The new round couldn't be removed; cancel it from its page.` });
        }
        return fail(failure);
    };
    const { error: addError } = await supabase.rpc("apply_iteration_sync", { p_iteration_id: data.id, p_by: user.id, p_add: testCaseIds, p_refresh: [], p_remove: [] });
    if (addError) return abandon(addError);
    if (excludedUserIds.length > 0) {
        const { error: tickError } = await supabase.rpc("set_iteration_testers_excluded", { p_iteration_id: data.id, p_user_ids: excludedUserIds, p_excluded: true });
        if (tickError) return abandon(tickError);
    }
    refresh();
    return { ok: true, data: { iterationNumber: data.iteration_number, slug: data.slug } };
}

// Ticks / unticks users on a planned round's coverage panel (0058). Everyone holding a role
// the scope needs is ticked unless unticked here; the roster is fixed at Start.
export async function setTestersExcluded({ iterationId, userIds, excluded }: { iterationId: string; userIds: string[]; excluded: boolean }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_iteration_testers_excluded", { p_iteration_id: iterationId, p_user_ids: userIds, p_excluded: excluded });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// not_started -> in_progress: testing (recording results) can begin. begin_iteration rejects
// it while a role in scope has no ticked tester or a case has no role (0058).
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

// in_progress/stopped -> not_started (0029): erases every recorded result, remark and org
// submission. Each case's tester copies collapse back into one scope row and the roster is
// released (unticked users stay unticked, 0058), so it can be started again.
export async function resetIteration({ iterationId }: { iterationId: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    const supabase = await createClient();
    const { error } = await supabase.rpc("reset_iteration", { p_iteration_id: iterationId });
    if (error) return fail(error);
    await flushStorageDeletions(supabase, { maxBatches: 5 });
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
    return { ok: true, data: { submittedAt: data } };
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

// Renames an iteration and sets its planned end date (0028). The slug and number (what the
// URL depends on) never change; a blank name falls back to Untitled_Iteration_{n}.
export async function updateIterationDetails({ iterationId, name, plannedEndDate }: { iterationId: string; name?: string; plannedEndDate?: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "run_iteration")) return denied("run_iteration");
    const supabase = await createClient();
    const { error } = await supabase.rpc("update_iteration_details", {
        p_iteration_id: iterationId,
        p_name: name || undefined,
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
    // RLS (0060) only lets a tester write their own copy; a blocked update matches no rows
    // instead of erroring, so check that it landed.
    const { data: updated, error } = await supabase
        .from("test_step_results")
        .update({ status })
        .eq("id", stepResultId)
        .eq("test_case_result_id", caseResultId)
        .select("id");
    if (error) return fail(error);
    if (updated.length === 0) return { ok: false, error: NOT_OWN_COPY };

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
    const { data: updated, error } = await supabase
        .from("test_case_results")
        .update({
            status,
            status_overridden: true,
            executed_by: user.id,
            completed_at: new Date().toISOString(),
        })
        .eq("id", caseResultId)
        .select("id");
    if (error) return fail(error);
    if (updated.length === 0) return { ok: false, error: NOT_OWN_COPY };
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
    if (error?.code === "42501") return { ok: false, error: NOT_OWN_COPY };
    if (error) return fail(error);
    return readCaseResultState(caseResultId);
}

export async function addResultRemark({ stepResultId, remark, attachmentIds = [] }: { stepResultId: string; remark: string; attachmentIds?: string[] }): Promise<actionResult<{ id: string; remark: string; created_at: string; author?: profile; attachments: signedAttachment[] }>> {
    const user = await requireUser();
    const supabase = await createClient();
    // One transaction: the remark and the links to the caller's ready drafts, or neither (0063).
    const { data, error } = await supabase.rpc("post_remark_with_attachments", {
        p_step_result_id: stepResultId, p_remark: remark, p_attachment_ids: attachmentIds,
    });
    if (error) return fail(error);
    const posted = data[0];
    await flushStorageDeletions(supabase);
    const { data: author } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).maybeSingle();
    let attachments: signedAttachment[] = [];
    if (attachmentIds.length > 0) {
        try {
            attachments = await signAttachmentsForRemark(posted.id);
        } catch (e) {
            // The remark is saved; the files show after a refresh.
            console.error("Signing attachments failed:", (e as Error).message);
        }
    }
    return { ok: true, data: { id: posted.id, remark: posted.remark, created_at: posted.created_at, author: author ?? undefined, attachments } };
}

export type scopeOption = { id: string; code: string | null; title: string; issues: string[]; flags: roundCaseFlag[] };

// What the Start Iteration picker lists: every section and its test cases,
// each marked with whatever completeness issues it has (empty = pickable).
// With an iterationId (a planned round) each case also carries its history flags
// vs. the latest completed round: failed / blocked / skipped / tested / changed since / not tested.
export async function getIterationScopeOptions({ suiteId, iterationId }: { suiteId: string; iterationId?: string }): Promise<actionResult<{ sections: { id: string; name: string; testCases: scopeOption[] }[] }>> {
    const supabase = await createClient();
    const [sectionsResult, issuesResult, historyResult] = await Promise.all([
        supabase
            .from("sections")
            .select("id, name, order_index, test_cases ( id, code, title, order_index )")
            .eq("test_suite_id", suiteId)
            .order("order_index", { ascending: true })
            .order("order_index", { referencedTable: "test_cases", ascending: true }),
        supabase.rpc("suite_test_case_issues", { p_suite_id: suiteId }),
        iterationId ? supabase.rpc("get_round_case_history", { p_iteration_id: iterationId }) : Promise.resolve(null),
    ]);
    if (sectionsResult.error) return fail(sectionsResult.error);
    if (issuesResult.error) return fail(issuesResult.error);
    if (historyResult?.error) return fail(historyResult.error);
    const history = new Map((historyResult?.data ?? []).map((row) => [row.test_case_id, row]));

    // Same flags as the round's table (round-flags.ts), minus the ones that need the round's own results.
    const flagsFor = (testCaseId: string): roundCaseFlag[] => {
        if (!historyResult) return [];
        const past = history.get(testCaseId);
        if (!past?.last_result) return [{ flag: "not_tested", roundName: null }];
        const name = past.last_round_name;
        const flags: roundCaseFlag[] = [
            past.last_result === "Failed" ? { flag: "failed", roundName: name }
                : past.last_result === "Blocked" ? { flag: "blocked", roundName: name }
                : past.last_result === "Untested" ? { flag: "skipped", roundName: name }
                : { flag: "tested", roundName: name },
        ];
        if (past.changed_since) flags.push({ flag: "changed_since", roundName: name });
        return flags;
    };

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
                    flags: flagsFor(tc.id),
                })),
            })),
        },
    };
}
