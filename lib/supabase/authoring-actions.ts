"use server"

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { PLACEHOLDER_PIC_ID } from "./placeholder-actor";
import type { actionResult } from "./iteration-actions";
import type { Database } from "./database.types";

// Vendor authoring of suites, sections and test cases. Locks (signed off /
// archived) and the Ready re-check are enforced by the RPCs; their messages
// come back as values because Server Action errors are masked in production.

function fail(error: { message: string }): { ok: false; error: string } {
    console.error("Authoring action failed:", error.message);
    return { ok: false, error: error.message };
}

type priority = Database["public"]["Enums"]["priority_level"];
type roleAssignee = Database["public"]["Enums"]["role_assignee_type"];

// Suites -----------------------------------------------------------------------

export async function upsertSuite({ id, name, code, slug, description }: { id?: string; name: string; code?: string; slug?: string; description?: string }): Promise<actionResult<{ id: string; slug: string }>> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("upsert_suite", {
        p_id: id,
        p_name: name,
        p_code: code,
        p_slug: slug,
        p_description: description,
        p_by: PLACEHOLDER_PIC_ID,
    });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: { id: data.id, slug: data.slug } };
}

export async function deleteSuite({ suiteId }: { suiteId: string }): Promise<actionResult> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_suite", { p_suite_id: suiteId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Sections ---------------------------------------------------------------------

export async function upsertSection({ suiteId, id, name }: { suiteId: string; id?: string; name: string }): Promise<actionResult<{ id: string; slug: string }>> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("upsert_section", { p_suite_id: suiteId, p_id: id, p_name: name });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: { id: data.id, slug: data.slug } };
}

export async function deleteSection({ sectionId }: { sectionId: string }): Promise<actionResult> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_section", { p_section_id: sectionId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

export async function reorderSections({ suiteId, sectionIds }: { suiteId: string; sectionIds: string[] }): Promise<actionResult> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("reorder_sections", { p_suite_id: suiteId, p_section_ids: sectionIds });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Test cases -------------------------------------------------------------------

// Items keep their id when edited so iteration snapshots stay linked; new items have no id.
export type testCaseDraft = {
    id?: string;
    sectionId: string;
    title: string;
    description: string;
    priority: priority;
    roleAssignee: roleAssignee | null;
    preconditions: { id?: string; condition: string }[];
    steps: { id?: string; step: string; expectedResults: { id?: string; result: string }[] }[];
};

export async function saveTestCase(draft: testCaseDraft): Promise<actionResult<{ id: string }>> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_test_case", {
        p_payload: {
            id: draft.id ?? null,
            section_id: draft.sectionId,
            title: draft.title,
            description: draft.description,
            priority: draft.priority,
            role_assignee: draft.roleAssignee,
            created_by: PLACEHOLDER_PIC_ID,
            preconditions: draft.preconditions.map((precondition) => ({ id: precondition.id ?? null, condition: precondition.condition })),
            steps: draft.steps.map((step) => ({
                id: step.id ?? null,
                step: step.step,
                expected_results: step.expectedResults.map((expected) => ({ id: expected.id ?? null, result: expected.result })),
            })),
        },
    });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: { id: data } };
}

export async function deleteTestCase({ testCaseId }: { testCaseId: string }): Promise<actionResult> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_test_case", { p_test_case_id: testCaseId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

export async function reorderTestCases({ sectionId, testCaseIds }: { sectionId: string; testCaseIds: string[] }): Promise<actionResult> {
    const supabase = await createClient();
    const { error } = await supabase.rpc("reorder_test_cases", { p_section_id: sectionId, p_test_case_ids: testCaseIds });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}
