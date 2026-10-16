"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { type DataTableFeatures } from "@/components/table/data-table-features";
import { DataTable } from "@/components/table/data-table";

type targetRow = {
	id: string;
	week: string;
	Monday: string;
	Tuesday: string;
	Wednesday: string;
	Thursday: string;
	Friday: string;
};

const TARGETS: targetRow[] = [
	{ id: "week-1", week: "Phase 1 · Oct 19–23", Monday: "KT onsite", Tuesday: "35%", Wednesday: "70%", Thursday: "100%", Friday: "Retest; review" },
	{ id: "week-2", week: "Phase 2 · Oct 26–30", Monday: "KT onsite", Tuesday: "35%", Wednesday: "70%", Thursday: "100%", Friday: "Retest; review" },
	{ id: "week-3", week: "Phase 3 · Nov 3–6", Monday: "No session", Tuesday: "KT onsite", Wednesday: "50%", Thursday: "100%", Friday: "Final review" },
];

const columnHelper = createColumnHelper<DataTableFeatures, targetRow>();

// Percentages are numbers (mono); the rest are session labels (muted).
function DayCell({ value }: { value: string }) {
	return /^\d+%$/.test(value)
		? <p className="font-mono text-xs">{value}</p>
		: <p className="text-xs text-muted-foreground">{value}</p>;
}

const columns = columnHelper.columns([
	columnHelper.accessor("week", {
		header: "Weeks",
		cell: (info) => <p className="font-mono text-xs font-medium">{info.getValue()}</p>,
	}),
	columnHelper.accessor("Monday", { header: "Monday", cell: (info) => <DayCell value={info.getValue()} /> }),
	columnHelper.accessor("Tuesday", { header: "Tuesday", cell: (info) => <DayCell value={info.getValue()} /> }),
	columnHelper.accessor("Wednesday", { header: "Wednesday", cell: (info) => <DayCell value={info.getValue()} /> }),
	columnHelper.accessor("Thursday", { header: "Thursday", cell: (info) => <DayCell value={info.getValue()} /> }),
	columnHelper.accessor("Friday", { header: "Friday", cell: (info) => <DayCell value={info.getValue()} /> }),
]);

export function DailyTargetTable() {
	return <DataTable columns={columns} data={TARGETS} notEnd />;
}
