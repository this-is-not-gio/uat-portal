"use client";

import { Ban, CircleCheck, CircleX, type LucideIcon } from "lucide-react";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTable } from "../table/data-table";
import type { DataTableFeatures } from "../table/data-table-features";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import type { CaseAuditEntry, ExecutedStatus } from "@/lib/supabase/sign-off-report";
import { cn } from "@/lib/utils";

// `runs` is the case's result per iteration, oldest first. Reports frozen before the audit
// trail was recorded don't have it, so those fall back to the `detail` text.
export type ChangeListItem = { key: string; label: string; detail: string; runs?: CaseAuditEntry["runs"] };
type ChangeListRow = ChangeListItem & { id: string };

const RUN_CHIP: Record<ExecutedStatus, { icon: LucideIcon; className: string }> = {
	Passed: { icon: CircleCheck, className: "text-green-800 bg-green-500/10" },
	Failed: { icon: CircleX, className: "text-red-800 bg-red-500/10" },
	Blocked: { icon: Ban, className: "text-gray-800 bg-gray-500/10" },
};

function RunChips({ row }: { row: ChangeListRow }) {
	if (!row.runs?.length) return <p className="text-xs text-muted-foreground whitespace-nowrap">{row.detail}</p>;
	return (
		<div className="flex flex-row flex-wrap items-center gap-1">
			{row.runs.map((run) => {
				const { icon: Icon, className } = RUN_CHIP[run.status];
				return (
					<Tooltip key={run.roundName}>
						<TooltipTrigger
							render={
								<div className={cn("flex items-center rounded-md p-1", className)}>
									<Icon className="size-4" />
								</div>
							}
						/>
						<TooltipContent>
							<p>{run.roundName}: {run.status}</p>
						</TooltipContent>
					</Tooltip>
				);
			})}
		</div>
	);
}

// Columns hold cell functions, so they live in this client file: a Server Component
// can't pass functions down to DataTable.
const columnHelper = createColumnHelper<DataTableFeatures, ChangeListRow>();
const columns = columnHelper.columns([
	columnHelper.accessor("label", {
		header: "Test Cases",
		cell: (info) => <p className="text-xs font-medium break-words whitespace-normal">{info.getValue()}</p>,
	}),
	columnHelper.accessor("detail", {
		header: "Testing History",
		cell: (info) => <div className="flex flex-row justify-end">
			<RunChips row={info.row.original} />
		</div>,
	}),
]);

export function ChangeListTable({ items }: { items: ChangeListItem[] }) {
	return <DataTable columns={columns} data={items.map((item) => ({ ...item, id: item.key }))} bordered={false} />;
}
