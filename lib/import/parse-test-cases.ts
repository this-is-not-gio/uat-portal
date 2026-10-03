import type { Database } from "@/lib/supabase/database.types";

type priority = Database["public"]["Enums"]["priority_level"];
type roleAssignee = Database["public"]["Enums"]["role_assignee_type"];
type audience = Database["public"]["Enums"]["audience"];

// The import file's header row. Headers match by name or alias, ignoring case
// and extra spaces, so column order doesn't matter; extra columns are ignored.
// "TEST CASE" holds a section name (on a row with nothing else filled) or a
// case title. "case" columns belong on a case's first row only; "step" columns
// are filled on every row.
export const IMPORT_COLUMNS = [
	{ header: "TEST CASE", aliases: ["TEST CASES"], level: "case" },
	{ header: "PRECONDITION", aliases: ["PRECONDITIONS"], level: "case" },
	{ header: "STEP TO EXECUTE", aliases: ["STEPS TO EXECUTE"], level: "step" },
	{ header: "EXPECTED RESULT", aliases: ["EXPECTED RESULTS"], level: "step" },
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

type columnIndex = Record<importColumn, number>;

const normalizeHeader = (value: unknown) =>
	String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

// Maps each import column to its position in the header row. Every column is
// required; a missing one is a file-level error that rejects the whole file.
function readHeaders(headerRow: unknown[]): {
	columns: columnIndex | null;
	issues: importIssue[];
} {
	const positions = headerRow.map(normalizeHeader);
	const columns = {} as columnIndex;
	const issues: importIssue[] = [];

	for (const { header, aliases } of IMPORT_COLUMNS) {
		const names = [header, ...aliases].map(normalizeHeader);
		const index = positions.findIndex((name) => names.includes(name));
		if (index === -1) {
			issues.push({
				row: 1,
				column: null,
				message: `Missing required column "${header}".`,
				severity: "error",
			});
		} else {
			columns[header] = index;
		}
	}

	return { columns: issues.length ? null : columns, issues };
}

const cellText = (row: unknown[], index: number) =>
	String(row[index] ?? "").trim();

// A list number at the start of a line: "1.", "2)", "3.Text". A digit right
// after the dot ("1.5 kg") is not a list number.
const LIST_NUMBER = /^\d+[.)](?!\d)\s*/;

const stripNumber = (line: string) => line.replace(LIST_NUMBER, "").trim();

// Splits a cell into list items. A line starting with a list number begins a new
// item (number removed); any other line, such as a "> bullet", joins the item
// above it. Lines before the first number are items on their own.
function toItems(text: string): string[] {
	const items: string[] = [];
	let joinable = false;

	for (const raw of text.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) continue;
		if (LIST_NUMBER.test(line)) {
			const item = stripNumber(line);
			if (item) items.push(item);
			joinable = Boolean(item);
		} else if (joinable) {
			items[items.length - 1] += `\n${line}`;
		} else {
			items.push(line);
		}
	}

	return items;
}

// Turns the first sheet's rows (header row first) into test cases plus
// row-numbered issues. Errors block the import; warnings don't.
//
// Each data row is one of:
// - Section: only Test Case filled. Starts the section for the cases below it.
// - New case: Test Case and Step filled. Precondition is optional.
// - Next step: Test Case blank, Step filled. Precondition must be blank.
// - Blank: skipped.
export function parseTestCaseRows(rows: unknown[][]): {
	cases: importCase[];
	issues: importIssue[];
} {
	const { columns, issues } = readHeaders(rows[0] ?? []);
	if (!columns) return { cases: [], issues };

	const cases: importCase[] = [];
	let sectionName: string | null = null;
	let current: importCase | null = null;
	// True after a case row was rejected: its steps are dropped without piling
	// more errors onto the one already reported for the case row.
	let skipping = false;

	const error = (row: number, column: importColumn | null, message: string) =>
		issues.push({ row, column, message, severity: "error" });
	const warn = (row: number, column: importColumn | null, message: string) =>
		issues.push({ row, column, message, severity: "warning" });

	rows.slice(1).forEach((cells, i) => {
		const row = i + 2; // rows[0] is spreadsheet row 1
		const title = cellText(cells, columns["TEST CASE"]);
		const precondition = cellText(cells, columns["PRECONDITION"]);
		const step = stripNumber(cellText(cells, columns["STEP TO EXECUTE"]));
		const expected = cellText(cells, columns["EXPECTED RESULT"]);

		if (!title && !precondition && !step && !expected) return;

		const nextStep = { step, expectedResults: toItems(expected).map((result) => ({ result })) };
		const warnIfNoExpected = () => {
			if (!nextStep.expectedResults.length) {
				warn(row, "EXPECTED RESULT", 'Step has no expected result; the case will show "Not ready".');
			}
		};

		if (title && !precondition && !step && !expected) {
			sectionName = title;
			current = null;
			skipping = false;
			return;
		}

		if (title) {
			if (!step) {
				error(row, "STEP TO EXECUTE", "A test case needs a step on its first row.");
				current = null;
				skipping = true;
				return;
			}
			if (!sectionName) {
				error(row, "TEST CASE", "Test case comes before any section row.");
				current = null;
				skipping = true;
				return;
			}
			current = {
				row,
				sectionName,
				title,
				description: "",
				priority: "medium",
				roleAssignee: null,
				audience: "internal",
				preconditions: toItems(precondition).map((condition) => ({ condition })),
				steps: [nextStep],
			};
			cases.push(current);
			skipping = false;
			// The file has no role column, so every case starts without a role assignee.
			warn(row, null, 'No role assignee; the case will show "Not ready" until one is set.');
			warnIfNoExpected();
			return;
		}

		if (!step) {
			error(row, "STEP TO EXECUTE", "Row has no step to execute.");
			return;
		}
		if (precondition) {
			error(row, "PRECONDITION", "Preconditions belong on the test case's first row.");
		}
		if (!current) {
			if (!skipping) error(row, "STEP TO EXECUTE", "Step comes before any test case.");
			return;
		}
		current.steps.push(nextStep);
		warnIfNoExpected();
	});

	// Reading order for the preview: by row, errors before warnings on a row.
	issues.sort((a, b) => a.row - b.row || (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1));

	return { cases, issues };
}
