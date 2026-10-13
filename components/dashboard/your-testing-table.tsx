"use client"

import { createColumnHelper } from "@tanstack/react-table";
import { DataTableFeatures } from "../table/data-table-features";
import { DataTable } from "../table/data-table";
import { Badge } from "../ui/badge";

export type YourTestingRow = {
	id: string;
	suiteSlug: string;
	suiteCode: string | null;
	suiteName: string;
	roundNumber: number;
	roundName: string;
	timeline: { start: string | null; end: string | null };
	overdue: boolean;
	remaining: number;
};

export default function YourTestingTable({ rows }: { rows: YourTestingRow[] }) {
	const columnHelper = createColumnHelper<DataTableFeatures, YourTestingRow>()
	function formatDate(value: string | null) {
		if (!value) return "Not set"
		return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
	}

	const columns = columnHelper.columns([
		columnHelper.display({
			header: "Iteration",
			cell: (info) => <div className="">
				<p className="text-sm font-medium">{info.row.original.roundName}</p>
				<p className="text-xs text-muted-foreground font-mono">{info.row.original.suiteCode ? `${info.row.original.suiteCode} - ` : ""}{info.row.original.suiteName}</p>
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
			header: "Remaining Tests",
			cell: ({ row }) => <div className="flex gap-2 items-center">
				<p className="font-mono">{row.original.remaining}</p>
				<p className="text-xs text-muted-foreground">{row.original.overdue ? "Overdue Test Cases" : "Remaining Cases"}</p>
			</div>,
		}),
		columnHelper.display({
			id: "overdue",
			cell: ({ row }) => row.original.overdue ? (
				<Badge variant="destructive" className="gap-1.5">
					<span className="relative flex size-2 shrink-0">
						<span className="absolute inline-flex size-full rounded-full bg-destructive opacity-75 motion-safe:animate-ping" />
						<span className="relative inline-flex size-2 rounded-full bg-destructive" />
					</span>
					Overdue
				</Badge>
			) : null,
		}),

	])

	return (
		<DataTable columns={columns} data={rows} bordered={false} />
	)
}
