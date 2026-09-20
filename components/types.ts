import { CheckIcon, ClipboardIcon, HourglassIcon, LucideIcon, XIcon } from "lucide-react"

export type testCaseStatus = "Untested" | "In Progress" | "Passed" | "Failed"

export type Priority = "low" | "medium" | "high"

export type TestStatus = "Untested" | "Passed" | "Failed" | "Skipped" | "Blocked"

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
  status: testCaseStatus
  order: number
}

export const LANES: { id: testCaseStatus; title: string, Icon: LucideIcon }[] = [
  { id: "Untested", title: "Test Backlogs", Icon: ClipboardIcon },
  { id: "In Progress", title: "In Progress", Icon: HourglassIcon },
  { id: "Passed", title: "Pass", Icon: CheckIcon },
  { id: "Failed", title: "Fails", Icon: XIcon },
]


