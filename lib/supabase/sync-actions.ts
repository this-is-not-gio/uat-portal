"use server"

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PLACEHOLDER_PIC_ID } from "./placeholder-actor";
import type { actionResult } from "./iteration-actions";

// Vendor sync of mid-round test case edits into the running iteration.
// Tested rows are protected by the RPCs; only force refresh (with a reason)
// resets them, and it archives the old results first.

function fail(error: { message: string }): { ok: false; error: string } {
    console.error("Sync action failed:", error.message);
    return { ok: false, error: error.message };
}

export async function applyIterationSync({ iterationId, add, refreshIds, remove }: { iterationId: string; add: string[]; refreshIds: string[]; remove: string[] }): Promise<actionResult> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("apply_iteration_sync", {
        p_iteration_id: iterationId,
        p_by: PLACEHOLDER_PIC_ID,
        p_add: add,
        p_refresh: refreshIds,
        p_remove: remove,
    });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

export async function forceRefreshCaseResult({ caseResultId, reason }: { caseResultId: string; reason: string }): Promise<actionResult> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("force_refresh_case_result", {
        p_case_result_id: caseResultId,
        p_by: PLACEHOLDER_PIC_ID,
        p_reason: reason,
    });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

export type caseContent = {
    title: string;
    section: string | null;
    priority: string | null;
    roleAssignee: string | null;
    preconditions: string[];
    steps: { step: string; expected: string[] }[];
};

// What the round has (snapshot) vs what the live test case says now, for the Sync dialog.
export async function getSyncDiff({ caseResultId }: { caseResultId: string }): Promise<actionResult<{ before: caseContent; after: caseContent }>> {
    const supabase = await createClient();
    const { data: snapshot, error: snapshotError } = await supabase
        .from("test_case_results")
        .select("test_case_id, title, section_name, priority, role_assignee, preconditions, test_step_results ( step, order_index, expected_results )")
        .eq("id", caseResultId)
        .order("order_index", { referencedTable: "test_step_results", ascending: true })
        .single();
    if (snapshotError) return fail(snapshotError);
    if (!snapshot.test_case_id) return { ok: false, error: "The live test case no longer exists." };

    const { data: live, error: liveError } = await supabase
        .from("test_cases")
        .select("title, priority, role_assignee, sections ( name ), preconditions ( condition, order_index ), test_steps ( step, order_index, expected_results ( result, order_index ) )")
        .eq("id", snapshot.test_case_id)
        .order("order_index", { referencedTable: "preconditions", ascending: true })
        .order("order_index", { referencedTable: "test_steps", ascending: true })
        .order("order_index", { referencedTable: "test_steps.expected_results", ascending: true })
        .single();
    if (liveError) return fail(liveError);

    // Snapshot jsonb is written by sync_iteration / refresh_case_result in these shapes.
    const snapshotPreconditions = snapshot.preconditions as { condition: string }[];
    return {
        ok: true,
        data: {
            before: {
                title: snapshot.title,
                section: snapshot.section_name,
                priority: snapshot.priority,
                roleAssignee: snapshot.role_assignee,
                preconditions: snapshotPreconditions.map((p) => p.condition),
                steps: snapshot.test_step_results.map((s) => ({
                    step: s.step,
                    expected: (s.expected_results as { result: string }[]).map((e) => e.result),
                })),
            },
            after: {
                title: live.title,
                section: live.sections?.name ?? null,
                priority: live.priority,
                roleAssignee: live.role_assignee,
                preconditions: live.preconditions.map((p) => p.condition),
                steps: live.test_steps.map((s) => ({ step: s.step, expected: s.expected_results.map((e) => e.result) })),
            },
        },
    };
}
