import { createClient } from "@/lib/supabase/server";
import { TEST_CASE_SELECT, testCase } from "./test-cases";

export type testSection = {
    id: string;
    name: string;
    testCases: testCase[];
}


export async function getTestSectionsByTestSuiteId(testSuiteId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("testing_suites")
      .select("id, name, sections!sections_epic_id_fkey ( id, name, order_index )")
      .eq("id", testSuiteId)
      .single();

    if (error) throw error;

    return {
        id: data.id,
        name: data.name,
        sections: data.sections?.map((section) => ({
            id: section.id,
            name: section.name,
        })) || [],
    };
}

export async function getSection(testSectionId: string): Promise<testSection> {
    const supabase = await createClient();
    const {data, error} = await supabase
        .from("sections")
        .select(`id, name, test_cases(${TEST_CASE_SELECT})`)
        .eq("id", testSectionId)
        .order("order_index", { referencedTable: "test_cases", ascending: true })
        .order("order_index", { referencedTable: "test_cases.test_steps", ascending: true })
        .order("created_at", { referencedTable: "test_cases.test_steps.test_remarks", ascending: true })
        .single();

    if (error) throw error;

    console.log("Fetched section data:", data.test_cases.length);
    return {
        id: data.id,
        name: data.name,
        testCases: data.test_cases?.map((testCase) => ({
            id: testCase.id,
            code: testCase.code,
            title: testCase.title,
            status: testCase.status,
            roleAssignee: testCase.role_assignee ?? undefined,
            preconditions: testCase.preconditions?.map((preCondition) => ({
                id: preCondition.id,
                condition: preCondition.condition,
            })) || [],
            stepsToExecute: testCase.test_steps?.map((step) => ({
                id: step.id,
                step: step.step,
                status: step.status ?? undefined,
                expectedResults: step.expected_results?.map((result) => ({
                    id: result.id,
                    result: result.result,
                })) || [],
                remarks: step.test_remarks?.map((remark) => ({
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
        })) || [],
    };
}

