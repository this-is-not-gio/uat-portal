"use client"

import { createColumnHelper } from "@tanstack/react-table";
import { ExternalLink } from "lucide-react";
import { DataTableFeatures } from "@/components/table/data-table-features";
import { DataTable } from "@/components/table/data-table";
import { Badge } from "@/components/ui/badge";
import { DEFECT_SEVERITIES, DEFECT_STATUS_LABELS } from "@/lib/supabase/defect-format";
import type { defect, defectSeverity, defectStatus } from "@/lib/supabase/defects";
import { humanizeTimestamp } from "@/lib/utils";

const SEVERITY_CLASSNAMES: Record<defectSeverity, string> = {
	critical: "border-red-700 bg-red-100/60 text-red-700 dark:bg-red-950/40 dark:text-red-400",
	high: "border-orange-600/40 bg-orange-50 text-orange-800",
	medium: "border-yellow-600/40 bg-yellow-50 text-amber-800",
	low: "border-stone-400/40 bg-stone-50 text-stone-700",
};

const STATUS_CLASSNAMES: Record<defectStatus, string> = {
	open: "border-blue-600/40 bg-blue-50 text-blue-800",
	resolved: "border-green-600/40 bg-green-50 text-green-800",
	wont_fix: "text-muted-foreground",
};

export default function DefectsTable({ defects }: { defects: defect[] }) {
	const columnHelper = createColumnHelper<DataTableFeatures, defect>()

	const columns = columnHelper.columns([
		columnHelper.display({
			header: "ID",
			cell: ({ row }) => <p className="font-mono text-xs font-semibold whitespace-nowrap">{row.original.code}</p>,
		}),
		columnHelper.display({
			header: "Summary",
			cell: ({ row }) => <p className="text-sm font-medium">{row.original.summary}</p>,
		}),
		columnHelper.display({
			header: "Severity",
			cell: ({ row }) => <Badge variant="outline" className={SEVERITY_CLASSNAMES[row.original.severity]}>
				{DEFECT_SEVERITIES.find((s) => s.value === row.original.severity)?.label}
			</Badge>,
		}),
		columnHelper.display({
			header: "Status",
			cell: ({ row }) => <Badge variant="outline" className={STATUS_CLASSNAMES[row.original.status]}>{DEFECT_STATUS_LABELS[row.original.status]}</Badge>,
		}),
		columnHelper.display({
			header: "Test case",
			cell: ({ row }) => <p className="font-mono text-xs whitespace-nowrap" title={row.original.caseTitle}>{row.original.caseCode ?? "—"}</p>,
		}),
		columnHelper.display({
			header: "Step",
			cell: ({ row }) => {
				// The first cited remark decides the column; null step order means overall feedback.
				const first = row.original.references[0];
				if (!first) return <p className="text-xs text-muted-foreground">—</p>;
				return <p className="text-xs" title={first.stepText ?? undefined}>{first.stepOrder === null ? "Overall feedback" : `Step ${first.stepOrder + 1}`}</p>;
			},
		}),
		columnHelper.display({
			header: "Jira",
			cell: ({ row }) => row.original.jiraUrl
				? <a href={row.original.jiraUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs underline">
					Open
					<ExternalLink className="size-3" />
				</a>
				: <p className="text-xs text-muted-foreground">—</p>,
		}),
		columnHelper.display({
			header: "Created",
			cell: ({ row }) => <p className="text-xs text-muted-foreground whitespace-nowrap">{humanizeTimestamp(row.original.createdAt)}</p>,
		}),
	])

	return (
		<DataTable columns={columns} data={defects} emptyTitle="No defects" emptyDescription="No defects have been logged in this round yet." />
	)
}
