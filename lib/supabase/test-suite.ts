

import { TestCase } from "@/components/types";
import { createClient } from "@/lib/supabase/server";
import { getIterationsBySuiteId, type testIteration } from "@/lib/supabase/test-iterations";
import { toExitCriteria } from "@/lib/report/exit-criteria";
import {cache} from "react";


//CRUD for Test suite
// export async function getTestCasesByEpicId(epicId: string): Promise<TestCase[]> {
//   const supabase = await createClient();

//   const { data, error } = await supabase
//     .from("test_cases")
//     .select(TEST_CASE_SELECT)
//     .eq("sections.test_suite_id", epicId)
//     .order("order_index", { referencedTable: "sections", ascending: true })
//     .order("order_index", { ascending: true });

//   if (error) throw error;
//   return (data as unknown as TestCaseRow[]).map(toTestCase);
// }

export type testCaseIssue = "no_steps" | "step_without_expected_result" | "no_role_assignee";
export type readinessIssue = { testCaseId: string | null; code: string | null; issue: "no_complete_test_cases" | "no_test_accounts" | "no_endpoints" | testCaseIssue };

// Completeness of every test case in the suite: incomplete ones can't be picked for an iteration.
export async function getSuiteTestCaseIssues(suiteId: string): Promise<{ testCaseId: string; issue: testCaseIssue }[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("suite_test_case_issues", { p_suite_id: suiteId });
    if (error) throw error;
    return data.map((row) => ({ testCaseId: row.test_case_id, issue: row.issue as testCaseIssue }));
}

// What blocks Mark ready (same rule the DB enforces on draft -> ready and on saves while Ready).
export async function getSuiteReadinessIssues(suiteId: string): Promise<readinessIssue[]> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("suite_readiness_issues", { p_suite_id: suiteId });
    if (error) throw error;
    return data.map((row) => ({ testCaseId: row.test_case_id, code: row.code, issue: row.issue as readinessIssue["issue"] }));
}

export type suiteScope = {
    sectionCount: number;
    testCaseCount: number;
    roleCount: number;
};

// The draft header's "Scope of Testing": what the suite will hand over for testing.
export const getSuiteScope = cache(async (suiteId: string): Promise<suiteScope> => {
    const supabase = await createClient();
    const [sectionsResult, casesResult] = await Promise.all([
        supabase.from("sections").select("id", { count: "exact", head: true }).eq("test_suite_id", suiteId),
        supabase
            .from("test_cases")
            .select("test_role_id, sections!inner ( test_suite_id )")
            .eq("sections.test_suite_id", suiteId),
    ]);
    if (sectionsResult.error) throw sectionsResult.error;
    if (casesResult.error) throw casesResult.error;

    return {
        sectionCount: sectionsResult.count ?? 0,
        testCaseCount: casesResult.data.length,
        roleCount: new Set(casesResult.data.map((c) => c.test_role_id).filter(Boolean)).size,
    };
});

// cache() compares args by identity, so key it on the slug string (an object arg would never hit).
// The suite layout and its tab pages share one lookup per request.
export const getTestSuiteBySlug = cache((slug: string) => getTestSuite({ slug }));

export async function getTestSuite({ slug }: { slug: string }) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("testing_suites")
      .select("id, name, description, slug, code, status, exit_criteria")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const { exit_criteria, ...suite } = data;
    const iterations: testIteration[] = await getIterationsBySuiteId(data.id);
    return { ...suite, exitCriteria: toExitCriteria(exit_criteria), iterations };
}
