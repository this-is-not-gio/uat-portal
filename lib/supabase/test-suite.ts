

import { TestCase } from "@/components/types";
import { createClient } from "@/lib/supabase/server";


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
export type readinessIssue = { testCaseId: string | null; code: string | null; issue: "no_complete_test_cases" | testCaseIssue };

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

export async function getTestSuite({ slug }: { slug: string }){
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("testing_suites")
      .select("id, name, description, slug, code, status")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    return data;
}
