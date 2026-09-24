import { createClient } from "@/lib/supabase/server";
import type { Database } from "./database.types";

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
