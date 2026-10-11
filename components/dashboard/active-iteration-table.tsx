"use client"

import { createColumnHelper } from "@tanstack/react-table";
import { DataTableFeatures } from "../table/data-table-features";
import { DataTable } from "../table/data-table";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export type ActiveIterationRow = {
	id: string;
	suiteName: string;
	suiteCode: string | null;
	iteration: string;
	timeline: { start: string; end: string | null };
	progress: { testCount: number; includedCount: number };
	submissions: number;
};

function progressStatus({ testCount, includedCount }: ActiveIterationRow["progress"]) {
	if (includedCount > 0 && testCount >= includedCount) return { label: "Complete", className: "border-green-600/40 bg-green-50 text-green-800" }
	if (testCount > 0) return { label: "In progress", className: "border-blue-600/40 bg-blue-50 text-blue-800" }
	return { label: "Not started", className: "border-stone-400/40 bg-stone-50 text-stone-700" }
}

function formatDate(value: string | null) {
	if (!value) return "Not set"
	return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export default function ActiveIterationTable({ activeRounds }: { activeRounds: ActiveIterationRow[] }) {
	const columnHelper = createColumnHelper<DataTableFeatures, ActiveIterationRow>()

	const columns = columnHelper.columns([
		columnHelper.display({
			header: "Iterations",
			cell: ({ row }) => <div className="">
				<p className="font-semibold text-sm">{row.original.iteration}</p>
				<p className="text-xs text-muted-foreground font-mono">{row.original.suiteCode ? `${row.original.suiteCode} - ` : ""}{row.original.suiteName}</p>
			</div>,
		}),
		columnHelper.display({
			header: "Iteration Timeline",
			cell: ({ row }) => <div className="flex gap-4 items-center">
				<div>
					<p className="font-mono">{formatDate(row.original.timeline.start)}</p>
					<p className="text-xs text-muted-foreground">Started</p>
				</div>
				<p className="text-xs text-muted-foreground">TO</p>
				<div>
					<p className="font-mono">{formatDate(row.original.timeline.end)}</p>
					<p className="text-xs text-muted-foreground">Planned end</p>
				</div>
			</div>,
		}),
		columnHelper.display({
			id: "progress",
			header: () => <div className=""><Tooltip>
				<TooltipTrigger>Testing Progress</TooltipTrigger>
				<TooltipContent>
					Testing progress is calculated as the number of tests that have been executed (testCount) divided by the total number of tests that are included in the iteration (includedCount).
				</TooltipContent>
				</Tooltip></div>,
			cell: ({ row }) => {
				const status = progressStatus(row.original.progress)
				return <div className="flex flex-col gap-1">
					<p className="font-mono text-xs">{row.original.progress.testCount}/{row.original.progress.includedCount} Tested Test Cases</p>
				</div>
			},
		}),
		columnHelper.display({
			id: "status",
			header: () => <div className="text-right">Status</div>,
			cell: ({ row }) => {
				const status = progressStatus(row.original.progress)
				return <div className="flex flex-col items-end gap-1">
					<Badge variant="outline" className={`text-xs ${status.className}`}>{status.label}</Badge>
				</div>
			},
		}),
	])
	
	return (
		<DataTable columns={columns} data={activeRounds} bordered={false} />
	)
}
