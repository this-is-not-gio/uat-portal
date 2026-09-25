import { createClient } from "@/lib/supabase/server";
import { TEST_CASE_SELECT, testCase, testCaseStatus, testStepStatus } from "./test-cases";
import { getLatestIterationCaseStatuses } from "./test-iterations";

type TestCaseRow = {
    id: string;
    code: string | null;
    title: string;
    status: testCaseStatus;
    role_assignee: string | null;
    description: string;
    priority: "low" | "medium" | "high";
    lifecycle_status: "new" | "updated";
    sections: { id: string };
    created_at: string;
    preconditions: { id: string; condition: string }[] | null;
    test_steps:
        | {
              id: string;
              step: string;
              status: testStepStatus | null;
              expected_results: { id: string; result: string }[] | null;
              test_remarks:
                  | {
                        id: string;
                        remark: string;
                        created_at: string | null;
                        profile: { id: string; full_name: string; role: string } | null;
                    }[]
                  | null;
          }[]
        | null;
};

export type testSection = {
    id: string;
    name: string;
    testCases: testCase[];
};

export async function getTestSectionsByTestSuiteId(testSuiteId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("testing_suites")
        .select(
            `
            id,
            name,
            sections!sections_epic_id_fkey (
                id,
                name,
                slug,
                order_index,
                test_cases (
                    id,
                    title,
                    code,
                    created_at
                )
            )
            `,
        )
        .eq("id", testSuiteId)
        .order("order_index", { referencedTable: "sections", ascending: true })
        .order("order_index", { referencedTable: "sections.test_cases", ascending: true })
        .single();

    if (error) throw error;

    return {
        id: data.id,
        name: data.name,
        sections:
            data.sections?.map((section) => ({
                id: section.id,
                name: section.name,
                slug: section.slug,
                testCases:
                    section.test_cases?.map((testCase) => ({
                        id: testCase.id,
                        code: testCase.code,
                        title: testCase.title,
                        created_at: testCase.created_at,
                    })) || [],
            })) || [],
    };
}

function mapTestCaseRow(testCase: TestCaseRow) {
    return {
        id: testCase.id,
        code: testCase.code,
        title: testCase.title,
        status: testCase.status,
        roleAssignee: testCase.role_assignee ?? undefined,
        sectionId: testCase.sections.id,
        description: testCase.description,
        priority: testCase.priority,
        lifecycleStatus: testCase.lifecycle_status,
        preconditions:
            testCase.preconditions?.map((preCondition) => ({
                id: preCondition.id,
                condition: preCondition.condition,
            })) || [],
        stepsToExecute:
            testCase.test_steps?.map((step) => ({
                id: step.id,
                step: step.step,
                status: step.status ?? undefined,
                expectedResults:
                    step.expected_results?.map((result) => ({
                        id: result.id,
                        result: result.result,
                    })) || [],
                remarks:
                    step.test_remarks?.map((remark) => ({
                        id: remark.id,
                        remark: remark.remark,
                        author: {
                            id: remark.profile?.id ?? "",
                            full_name: remark.profile?.full_name ?? "",
                            role: remark.profile?.role ?? "",
                        },
                        created_at: remark.created_at ?? undefined,
                    })) || [],
            })) || [],
        created_at: testCase.created_at,
    };
}

export async function getSection(testSectionId: string): Promise<testSection> {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("sections")
        .select(`id, name, test_cases(${TEST_CASE_SELECT})`)
        .eq("id", testSectionId)
        .order("order_index", {
            referencedTable: "test_cases",
            ascending: true,
        })
        .single();

    if (error) throw error;

    return {
        id: data.id,
        name: data.name,
        testCases: data.test_cases?.map(mapTestCaseRow) || [],
    };
}

export async function getSectionBySlug(testSuiteId: string, slug: string): Promise<testSection> {
    const supabase = await createClient();
    const [{ data, error }, latestStatuses] = await Promise.all([
        supabase
            .from("sections")
            .select(`id, name, test_cases(${TEST_CASE_SELECT})`)
            .eq("test_suite_id", testSuiteId)
            .eq("slug", slug)
            .order("order_index", {
                referencedTable: "test_cases",
                ascending: true,
            })
            .single(),
        getLatestIterationCaseStatuses(testSuiteId),
    ]);

    if (error) throw error;

    return {
        id: data.id,
        name: data.name,
        testCases: data.test_cases?.map((row) => applyLatestStatus(mapTestCaseRow(row), latestStatuses)) || [],
    };
}

export async function getAllTestCasesBySuiteId(testSuiteId: string): Promise<testSection> {
    const supabase = await createClient();
    const [{ data, error }, latestStatuses] = await Promise.all([
        supabase
            .from("sections")
            .select(`id, name, test_cases(${TEST_CASE_SELECT})`)
            .eq("test_suite_id", testSuiteId)
            .order("order_index", { ascending: true })
            .order("order_index", {
                referencedTable: "test_cases",
                ascending: true,
            }),
        getLatestIterationCaseStatuses(testSuiteId),
    ]);

    if (error) throw error;

    return {
        id: testSuiteId,
        name: "All Sections",
        testCases: data.flatMap((section) => section.test_cases?.map((row) => applyLatestStatus(mapTestCaseRow(row), latestStatuses)) || []),
    };
}

// Overrides the case's default/master status with its outcome in the most
// recent iteration, if it was part of one — see getLatestIterationCaseStatuses.
function applyLatestStatus(tc: ReturnType<typeof mapTestCaseRow>, latestStatuses: Map<string, testCaseStatus>) {
    return { ...tc, status: latestStatuses.get(tc.id) ?? tc.status };
}
