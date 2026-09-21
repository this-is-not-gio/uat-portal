

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

export async function getTestSuite({ slug }: { slug: string }){
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("testing_suites")
      .select("id, name, description, slug, code")
      .eq("slug", slug)
      .maybeSingle();

    if (error) throw error;
    return data;
}
