export type testCaseStatus = "Untested" | "In Progress" | "Passed" | "Failed"

export type Priority = "low" | "medium" | "high"

export type TestStatus = "Untested" | "Passed" | "Failed" | "Skipped" | "Blocked"

// A test role name from the /admin role catalog (test_roles), e.g. "Action Officer - Licensing".
export type RoleAssignee = string


export type Precondition = {
  id: string
  condition: string
}

export type ExpectedResult = {
  id: string
  result: string
}

export type TestStep = {
  id: string
  step: string
  expectedResults: ExpectedResult[]
  remarks?: TestRemark[]
  status?: TestStatus
}

export type TestRemark = {
    id: string
    remark: string
}

export type TestCase = {
  id: string
  title: string
  description?: string
  preconditions?: Precondition[]
  stepsToExecute?: TestStep[]
  priority?: Priority
  roleAssignee?: RoleAssignee
  section?: string
  status: testCaseStatus
  order: number
}


