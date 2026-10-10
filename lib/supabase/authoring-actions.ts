"use server"

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "./auth";
import { can, denied } from "@/lib/auth/permissions";
import type { actionResult } from "./iteration-actions";
import type { Database } from "./database.types";
import type { importCase } from "@/lib/import/parse-test-cases";
import type { ExitCriteria } from "./sign-off-report";
import { exitCriteriaError } from "@/lib/report/exit-criteria";

// Vendor authoring of suites, sections and test cases. Locks (signed off /
// archived) and the Ready re-check are enforced by the RPCs; their messages
// come back as values because Server Action errors are masked in production.

function fail(error: { message: string }): { ok: false; error: string } {
    console.error("Authoring action failed:", error.message);
    return { ok: false, error: error.message };
}

type priority = Database["public"]["Enums"]["priority_level"];

// Suites -----------------------------------------------------------------------

export async function upsertSuite({ id, name, code, slug, description }: { id?: string; name: string; code?: string; slug?: string; description?: string }): Promise<actionResult<{ id: string; slug: string }>> {
    const user = await requireUser();
    if (!can(user, "author")) return denied("author");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("upsert_suite", {
        p_id: id,
        p_name: name,
        p_code: code,
        p_slug: slug,
        p_description: description,
        p_by: user.id,
    });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: { id: data.id, slug: data.slug } };
}

// Overview "Description" card. upsert_suite overwrites name/code, so pass the
// current ones back; it also refuses once the suite is signed off/archived.
export async function updateSuiteDescription({ suiteId, description }: { suiteId: string; description: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "author")) return denied("author");
    const supabase = await createClient();
    const { data: suite, error: readError } = await supabase.from("testing_suites").select("name, code").eq("id", suiteId).single();
    if (readError) return fail(readError);
    const { error } = await supabase.rpc("upsert_suite", {
        p_id: suiteId,
        p_name: suite.name,
        p_code: suite.code ?? undefined,
        p_description: description.trim(),
        p_by: user.id,
    });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// A suite test account; testRoleId is a catalog role (test_roles) ID, or null for "any role".
export type testAccountDraft = { testRoleId: string | null; username: string; password: string };

const toAccountPayload = (accounts: testAccountDraft[]) =>
    accounts.map((a) => ({ test_role_id: a.testRoleId, username: a.username, password: a.password }));

// Overview "Test Accounts": replaces the suite's whole list (order = array order).
export async function saveSuiteTestAccounts({ suiteId, accounts }: { suiteId: string; accounts: testAccountDraft[] }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "author")) return denied("author");
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_suite_test_accounts", { p_suite_id: suiteId, p_accounts: toAccountPayload(accounts) });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Overview edit state: saves only the parts that changed (omitted = untouched).
// Not one transaction — if accounts fail after the description saved, the
// refreshed description no longer differs, so a retry only re-sends accounts.
export async function saveSuiteOverview({ suiteId, description, accounts, sections, endpoints }: { suiteId: string; description?: string; accounts?: testAccountDraft[]; sections?: { title: string; icon: string | null; content: string }[]; endpoints?: { name: string; url: string }[] }): Promise<actionResult> {
    if (description !== undefined) {
        const result = await updateSuiteDescription({ suiteId, description });
        if (!result.ok) return result;
    }
    if (accounts !== undefined) {
        const result = await saveSuiteTestAccounts({ suiteId, accounts });
        if (!result.ok) return result;
    }
    if (sections !== undefined) {
        const user = await requireUser();
        if (!can(user, "author")) return denied("author");
        const supabase = await createClient();
        const { error } = await supabase.rpc("save_suite_overview_sections", { p_suite_id: suiteId, p_sections: sections });
        if (error) return fail(error);
        refresh();
    }
    if (endpoints !== undefined) {
        const user = await requireUser();
        if (!can(user, "author")) return denied("author");
        const supabase = await createClient();
        const { error } = await supabase.rpc("save_suite_endpoints", { p_suite_id: suiteId, p_endpoints: endpoints });
        if (error) return fail(error);
        refresh();
    }
    return { ok: true, data: undefined };
}

// Overview "Exit criteria". A plain update (Admin RLS policy); the lock_exit_criteria trigger
// rejects it once the suite is past ready, so the bar can't move mid-testing.
export async function updateExitCriteria({ suiteId, criteria }: { suiteId: string; criteria: ExitCriteria }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "author")) return denied("author");
    const invalid = exitCriteriaError(criteria);
    if (invalid) return { ok: false, error: invalid };
    const exitCriteria: ExitCriteria = {
        minPassRate: criteria.minPassRate,
        maxFailed: criteria.maxFailed,
        maxBlocked: criteria.maxBlocked,
        requireAllOrgsSubmitted: !!criteria.requireAllOrgsSubmitted,
    };
    const supabase = await createClient();
    const { data, error } = await supabase.from("testing_suites").update({ exit_criteria: exitCriteria }).eq("id", suiteId).select("id");
    if (error) return fail(error);
    if (data.length === 0) return { ok: false, error: "Testing suite not found." };
    refresh();
    return { ok: true, data: undefined };
}

export async function deleteSuite({ suiteId }: { suiteId: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "author")) return denied("author");
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_suite", { p_suite_id: suiteId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

// Sections ---------------------------------------------------------------------

export async function upsertSection({ suiteId, id, name }: { suiteId: string; id?: string; name: string }): Promise<actionResult<{ id: string; slug: string }>> {
    const user = await requireUser();
    if (!can(user, "author")) return denied("author");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("upsert_section", { p_suite_id: suiteId, p_id: id, p_name: name });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: { id: data.id, slug: data.slug } };
}

export async function deleteSection({ sectionId }: { sectionId: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "author")) return denied("author");
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_section", { p_section_id: sectionId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

export async function reorderSections({ suiteId, sectionIds }: { suiteId: string; sectionIds: string[] }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "author")) return denied("author");
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
    // A catalog role (test_roles) ID; null while drafting.
    testRoleId: string | null;
    preconditions: { id?: string; condition: string }[];
    steps: { id?: string; step: string; expectedResults: { id?: string; result: string }[] }[];
};

export async function saveTestCase(draft: testCaseDraft): Promise<actionResult<{ id: string }>> {
    const user = await requireUser();
    if (!can(user, "author")) return denied("author");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("save_test_case", {
        p_payload: {
            id: draft.id ?? null,
            section_id: draft.sectionId,
            title: draft.title,
            description: draft.description,
            priority: draft.priority,
            test_role_id: draft.testRoleId,
            created_by: user.id,
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

// Creates every case from an import file in one transaction (all or nothing).
// Sections are matched by name or created; codes are always generated.
export async function importTestCases({ suiteId, cases }: { suiteId: string; cases: importCase[] }): Promise<actionResult<{ created: number; sectionsCreated: number }>> {
    const user = await requireUser();
    if (!can(user, "author")) return denied("author");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("import_test_cases", {
        p_suite_id: suiteId,
        p_cases: cases.map((importCase) => ({
            section_name: importCase.sectionName,
            title: importCase.title,
            description: importCase.description,
            priority: importCase.priority,
            test_role_id: importCase.testRoleId,
            created_by: user.id,
            preconditions: importCase.preconditions,
            steps: importCase.steps.map((step) => ({
                step: step.step,
                expected_results: step.expectedResults,
            })),
        })),
    });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: data as { created: number; sectionsCreated: number } };
}

export async function deleteTestCase({ testCaseId }: { testCaseId: string }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "author")) return denied("author");
    const supabase = await createClient();
    const { error } = await supabase.rpc("delete_test_case", { p_test_case_id: testCaseId });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}

export async function reorderTestCases({ sectionId, testCaseIds }: { sectionId: string; testCaseIds: string[] }): Promise<actionResult> {
    const user = await requireUser();
    if (!can(user, "author")) return denied("author");
    const supabase = await createClient();
    const { error } = await supabase.rpc("reorder_test_cases", { p_section_id: sectionId, p_test_case_ids: testCaseIds });
    if (error) return fail(error);
    refresh();
    return { ok: true, data: undefined };
}
