import { createClient } from "@/lib/supabase/server";

export const TEST_CASE_SELECT = `
  id,
  code,
  title,
  description,
  priority,
  role_assignee,
  status,
  order_index,
  sections!inner ( id, name, order_index, test_suite_id ),
  preconditions ( id, condition, order_index ),
  created_at,
  test_steps (
    id,
    step,
    order_index,
    status,
    expected_results ( id, result, order_index ),
    test_remarks ( id, remark, created_at, profile:profiles(id, full_name, role ) )
  )
` as const;


export type testCaseStatus = "Untested" | "In Progress" | "Passed" | "Failed";

export type testStepStatus =
    | "Untested"
    | "Passed"
    | "Failed"
    | "Skipped"
    | "Blocked";

export type testRemark = {
    id: string;
    remark: string;
    author: profile;
    created_at?: string;
};

export type testStep = {
    id: string;
    step: string;
    expectedResults: expectedResult[];
    remarks?: testRemark[];
    status?: testStepStatus;
};

export type preCondition = {
    id: string;
    condition: string;
};

export type expectedResult = {
    id: string;
    result: string;
};

export type testCase = {
    id: string;
    code: string | null;
    title: string;
    status: testCaseStatus;
    roleAssignee?: string;
    preconditions?: preCondition[];
    stepsToExecute?: testStep[];
    created_at?: string;
};

export type profile = {
    id: string;
    full_name: string;
    role: string;
};
