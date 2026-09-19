import { createClient } from "@/lib/supabase/server";

export type TestingSuites = {
    id: string;
    title: string;
    description: string;
    slug: string;
    code: string | null;
    section: {
        id: string;
        name: string;
    }[];
    created_at: string;
}[]

export async function getTestingSuites(){
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("testing_suites")
      .select("id, name, description, slug, code, sections (id, name), created_at")
      .order("name", { ascending: true });
    if (error) throw error;
    return data.map((testingSuite) => ({
        id: testingSuite.id,
        title: testingSuite.name,
        description: testingSuite.description,
        slug: testingSuite.slug,
        code: testingSuite.code,
        section: testingSuite.sections.map((section) => ({
            id: section.id,
            name: section.name
        })),
        created_at: testingSuite.created_at,
    }));
}
