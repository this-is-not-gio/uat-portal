import { createClient } from "@/lib/supabase/server";
import type { Database } from "./database.types";
import type { currentUser } from "./auth";
import { can } from "@/lib/auth/permissions";

export type suiteStatus = Database["public"]["Enums"]["suite_status"];

export type TestingSuites = {
    id: string;
    title: string;
    description: string;
    slug: string;
    code: string | null;
    status: suiteStatus;
    section: {
        id: string;
        name: string;
    }[];
    testCaseCount: number;
    iterationCount: number;
    resultCount: number;
    created_at: string;
}[]

// Admin-only now (full counts for the draft-delete dialog); the sidebar uses getSidebarSuites.
export async function getTestingSuites(){
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("testing_suites")
      .select("id, name, description, slug, code, status, sections (id, name, test_cases (id)), test_iterations (id, test_case_results (id)), created_at")
      .order("name", { ascending: true });
    if (error) throw error;
    return data.map((testingSuite) => ({
        id: testingSuite.id,
        title: testingSuite.name,
        description: testingSuite.description,
        slug: testingSuite.slug,
        code: testingSuite.code,
        status: testingSuite.status,
        section: testingSuite.sections.map((section) => ({
            id: section.id,
            name: section.name
        })),
        testCaseCount: testingSuite.sections.reduce((sum, section) => sum + section.test_cases.length, 0),
        iterationCount: testingSuite.test_iterations.length,
        resultCount: testingSuite.test_iterations.reduce((sum, iteration) => sum + iteration.test_case_results.length, 0),
        created_at: testingSuite.created_at,
    }));
}

export type iterationStatus = Database["public"]["Enums"]["iteration_status"];

// One sidebar row. `adminCounts` feeds the draft-delete dialog and is only fetched for Admins.
export type SidebarSuite = {
    id: string;
    title: string;
    slug: string;
    code: string | null;
    status: suiteStatus;
    openRound: { number: number; name: string; status: iterationStatus; plannedEnd: string | null } | null;
    mine: { inOpenRound: boolean; submittedAt: string | null; remaining: number; everParticipated: boolean };
    adminCounts?: { sections: number; testCaseCount: number; iterationCount: number; resultCount: number };
};

// The role filter is in the SQL function, so a suite the user may not open never reaches the page.
export async function getSidebarSuites(user: currentUser): Promise<SidebarSuite[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_sidebar_suites");
    if (error) throw error;

    const adminCounts = can(user, "admin_area")
        ? new Map((await getTestingSuites()).map((suite) => [suite.id, {
            sections: suite.section.length,
            testCaseCount: suite.testCaseCount,
            iterationCount: suite.iterationCount,
            resultCount: suite.resultCount,
        }]))
        : null;

    // The generated types mark every `returns table` column non-null; the open_* columns,
    // code and my_submitted_at really are null when there is no open round / value, hence the checks.
    return (data ?? []).map((row) => ({
        id: row.suite_id,
        title: row.name,
        slug: row.slug,
        code: row.code,
        status: row.status,
        openRound: row.open_iteration_number != null && row.open_iteration_name != null && row.open_iteration_status != null
            ? { number: row.open_iteration_number, name: row.open_iteration_name, status: row.open_iteration_status, plannedEnd: row.open_planned_end }
            : null,
        mine: {
            inOpenRound: row.my_in_open_round,
            submittedAt: row.my_submitted_at,
            remaining: row.my_remaining,
            everParticipated: row.my_ever_participated,
        },
        ...(adminCounts?.has(row.suite_id) ? { adminCounts: adminCounts.get(row.suite_id) } : {}),
    }));
}
