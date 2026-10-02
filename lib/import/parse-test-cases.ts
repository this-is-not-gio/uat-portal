import type { Database } from "@/lib/supabase/database.types";

type priority = Database["public"]["Enums"]["priority_level"];
type roleAssignee = Database["public"]["Enums"]["role_assignee_type"];
type audience = Database["public"]["Enums"]["audience"];

// The import file's fixed header row, in order. Headers match ignoring case and
// surrounding spaces. "case" columns belong on a case's first row only; "step"
// columns are filled on every row.
export const IMPORT_COLUMNS = [
	{ header: "Section", level: "case" },
	{ header: "Title", level: "case" },
	{ header: "Description", level: "case" },
	{ header: "Priority", level: "case" },
	{ header: "Role Assignee", level: "case" },
	{ header: "Audience", level: "case" },
	{ header: "Preconditions", level: "case" },
	{ header: "Step", level: "step" },
	{ header: "Expected Result", level: "step" },
] as const;

export type importColumn = (typeof IMPORT_COLUMNS)[number]["header"];

// One test case read from the file. Mirrors testCaseDraft (authoring-actions.ts),
// but names its section instead of pointing at an id: sections are matched or
// created on import. `row` is the spreadsheet row number of the case's first row.
export type importCase = {
	row: number;
	sectionName: string;
	title: string;
	description: string;
	priority: priority;
	roleAssignee: roleAssignee | null;
	audience: audience;
	preconditions: { condition: string }[];
	steps: { step: string; expectedResults: { result: string }[] }[];
};

// `row` is the spreadsheet row number (1 = header row); `column` is null for
// file-level problems such as a missing header.
export type importIssue = {
	row: number;
	column: importColumn | null;
	message: string;
	severity: "error" | "warning";
};
