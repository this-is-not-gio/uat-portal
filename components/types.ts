import { CheckIcon, ClipboardIcon, LucideIcon, XIcon } from "lucide-react"

export type testCaseStatus = "backlog" | "pass" | "fail"

export type Priority = "low" | "medium" | "high"

export type TestStatus = "pass" | "fail" | "skipped" | "blocked"

export type RoleAssignee = "Kora-Admin" | "Kora-Workflow" | "Action-Officer" | "Supervisor" | "Division-Manager" | "Deputy-Commissioner" | "Insurance Commissioner" | "Company Admin"


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
  lane: testCaseStatus
  order: number
}

export const LANES: { id: testCaseStatus; title: string, Icon: LucideIcon }[] = [
  { id: "backlog", title: "Test Backlogs", Icon: ClipboardIcon },
  { id: "pass", title: "Pass", Icon: CheckIcon },
  { id: "fail", title: "Fails", Icon: XIcon },
]


