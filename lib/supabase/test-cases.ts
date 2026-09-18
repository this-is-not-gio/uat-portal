import { createClient } from "@/lib/supabase/server";
import type {
  ExpectedResult,
  Precondition,
  TestCase,
  TestRemark,
  TestStep,
} from "@/components/types";

const TEST_CASE_SELECT = `
  id,
  code,
  title,
  description,
  priority,
  role_assignee,
  lane,
  order_index,
  sections!inner ( id, name, order_index, epic_id ),
  preconditions ( id, condition, order_index ),
  test_steps (
    id,
    step,
    order_index,
    status,
    expected_results ( id, result, order_index ),
    test_remarks ( id, remark, order_index )
  )
` as const;

type TestCaseRow = {
  id: string;
  code: string | null;
  title: string;
  description: string;
  priority: TestCase["priority"];
  role_assignee: TestCase["roleAssignee"] | null;
  lane: TestCase["lane"];
  order_index: number;
  sections: { id: string; name: string; order_index: number; epic_id: string };
  preconditions: { id: string; condition: string; order_index: number }[];
  test_steps: {
    id: string;
    step: string;
    order_index: number;
    status: TestStep["status"] | null;
    expected_results: { id: string; result: string; order_index: number }[];
    test_remarks: { id: string; remark: string; order_index: number }[];
  }[];
};

function toTestCase(row: TestCaseRow): TestCase {
  const preconditions: Precondition[] = [...row.preconditions]
    .sort((a, b) => a.order_index - b.order_index)
    .map((p) => ({ id: p.id, condition: p.condition }));

  const stepsToExecute: TestStep[] = [...row.test_steps]
    .sort((a, b) => a.order_index - b.order_index)
    .map((step) => {
      const expectedResults: ExpectedResult[] = [...step.expected_results]
        .sort((a, b) => a.order_index - b.order_index)
        .map((er) => ({ id: er.id, result: er.result }));

      const remarks: TestRemark[] = [...step.test_remarks]
        .sort((a, b) => a.order_index - b.order_index)
        .map((r) => ({ id: r.id, remark: r.remark }));

      return {
        id: step.id,
        step: step.step,
        expectedResults,
        remarks: remarks.length > 0 ? remarks : undefined,
        status: step.status ?? undefined,
      };
    });

  return {
    id: row.code ?? row.id,
    title: row.title,
    description: row.description || undefined,
    preconditions: preconditions.length > 0 ? preconditions : undefined,
    stepsToExecute: stepsToExecute.length > 0 ? stepsToExecute : undefined,
    priority: row.priority,
    roleAssignee: row.role_assignee ?? undefined,
    section: row.sections.name,
    lane: row.lane,
    order: row.order_index,
  };
}

export async function getEpicBySlug(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("epics")
    .select("id, name, description, slug, code")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export type Section = {
  id: string;
  name: string;
  orderIndex: number;
};

export async function getSectionsByEpicId(epicId: string): Promise<Section[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sections")
    .select("id, name, order_index")
    .eq("epic_id", epicId)
    .order("order_index", { ascending: true });

  if (error) throw error;
  return data.map((s) => ({ id: s.id, name: s.name, orderIndex: s.order_index }));
}

export async function getTestCasesByEpicId(epicId: string): Promise<TestCase[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("test_cases")
    .select(TEST_CASE_SELECT)
    .eq("sections.epic_id", epicId)
    .order("order_index", { referencedTable: "sections", ascending: true })
    .order("order_index", { ascending: true });

  if (error) throw error;
  return (data as unknown as TestCaseRow[]).map(toTestCase);
}


export type Epics = {
    id: string;
    title: string;
    slug: string;
    section: {
        id: string;
        name: string;
    }[];
}

export async function getAllEpics() {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("epics")
      .select("id, name, description, slug, code,sections (id, name)")
      .order("name", { ascending: true });

    if (error) throw error;
    return data.map((epic) => ({
        id: epic.id,
        title: epic.name,
        slug: epic.slug,
        section: epic.sections.map((section) => ({
            id: section.id,
            name: section.name
        }))
    }));
}
