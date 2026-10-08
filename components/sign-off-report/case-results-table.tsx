"use client";

import { useMemo } from "react";
import { CircleCheck, CircleDashed, CircleOff, CircleX, type LucideIcon } from "lucide-react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "../table/data-table";
import type { DataTableFeatures } from "../table/data-table-features";
import type { FinalStatus, ReportCaseResult } from "@/lib/supabase/sign-off-report";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type CaseResultRow = ReportCaseResult & { id: string };

// Same chip as the Test Results tab's result summary.
const STATUS_CHIP: Record<FinalStatus, { label: string; Icon: LucideIcon; className: string }> = {
	Passed: { label: "Passed", Icon: CircleCheck, className: "bg-green-600/20 text-green-800" },
	Failed: { label: "Failed", Icon: CircleX, className: "bg-red-600/20 text-red-800" },
	Blocked: { label: "Blocked", Icon: CircleOff, className: "bg-gray-600/20 text-gray-800" },
	Untested: { label: "Not tested", Icon: CircleDashed, className: "bg-gray-600/5 text-muted-foreground" },
};

const STATUS_ORDER: FinalStatus[] = ["Passed", "Failed", "Blocked", "Untested"];

// One decimal, like the report's pass rate.
const percentOf = (value: number, total: number) => (total === 0 ? 0 : Math.round((value / total) * 1000) / 10);

// Spreads the rest of the props (ref, event handlers) so it can be a TooltipTrigger's `render` element.
function StatusBadge({ status, className: extraClassName, ...props }: { status: FinalStatus } & React.ComponentProps<"div">) {
	const { label, Icon, className } = STATUS_CHIP[status];
	return (
		<div {...props} className={cn("flex flex-row items-center gap-1 rounded-md py-1 px-1.5 w-fit", className, extraClassName)}>
			<Icon size={15} />
			<p className="text-xs font-semibold">{label}</p>
		</div>
	);
}

// Columns hold cell functions, so they live in this client file: a Server Component
// can't pass functions down to DataTable.
const columnHelper = createColumnHelper<DataTableFeatures, CaseResultRow>();

// One column per organization, in the order given (the report's org order).
function buildColumns(orgs: string[]) {
	return columnHelper.columns([
		columnHelper.accessor("title", {
			header: "Test case",
			cell: (info) => {
				const { code, title, section } = info.row.original;
				return (
					<div className="min-w-48 whitespace-normal">
						<p className="text-xs font-medium">{title}</p>
						<p className="text-xs text-muted-foreground">{code} - {section}</p>
					</div>
				);
			},
		}),
		...orgs.map((org) =>
			columnHelper.display({
				id: `org:${org}`,
				header: org,
				cell: (info) => {
					const result = info.row.original.perOrg.find((o) => o.organizationName === org);
					if (!result) return <span className="text-muted-foreground">—</span>;
					return (
						// <div className="flex flex-col items-start gap-0.5">
						// 	<StatusBadge status={result.status} />
						// 	{result.roundName && <span className="text-xs text-muted-foreground">{result.roundName}</span>}
						// </div>
						<Tooltip>
							<TooltipTrigger render={
								<StatusBadge status={result.status} />
							} />
							<TooltipContent>
								<p className="text-xs">Result from &quot;{result.roundName}&quot;</p>
							</TooltipContent>
						</Tooltip>
					);
				},
			})
		),
		columnHelper.accessor("status", {
			header: "Final Result",
			cell: (info) => <div className="flex flex-row items-center justify-end gap-1">
				<StatusBadge status={info.getValue()} />
			</div>,
		}),
	]);
}

export function CaseResultsTable({ cases, orgs }: { cases: ReportCaseResult[]; orgs: string[] }) {
	const columns = useMemo(() => buildColumns(orgs), [orgs]);
	const data = useMemo(() => cases.map((c) => ({ ...c, id: c.testCaseId })), [cases]);
	// One table per final status; statuses with no cases are left out.
	const groups = STATUS_ORDER.map((status) => ({ status, rows: data.filter((row) => row.status === status) })).filter((g) => g.rows.length > 0);
	return (
		<div className="border rounded-md">
			{groups.map(({ status, rows }) => (
				<div key={status} className="border-b last:border-b-0">
					<div className="flex flex-col gap-1 p-4 bg-muted/50 border-b sm:flex-row sm:items-center sm:justify-between">
						<p className="text-sm font-semibold">{STATUS_CHIP[status].label} Test Cases</p>
						<p className="text-xs text-muted-foreground">
							<span className="font-mono font-semibold text-foreground">{rows.length}</span> of{" "}
							<span className="font-mono">{data.length}</span> · <span className="font-mono">{percentOf(rows.length, data.length)}%</span>
						</p>
					</div>
					<DataTable columns={columns} data={rows} bordered={false} />
				</div>
			))}
		</div>
	);
}
