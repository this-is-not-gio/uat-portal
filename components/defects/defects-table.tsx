"use client"

import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { DataTableFeatures } from "@/components/table/data-table-features";
import { DataTable } from "@/components/table/data-table";
import { Badge } from "@/components/ui/badge";
import { DEFECT_SEVERITIES, DEFECT_STATUS_LABELS } from "@/lib/supabase/defect-format";
import type { defect } from "@/lib/supabase/defects";
import { humanizeTimestamp } from "@/lib/utils";
import { DefectSheet } from "./defect-sheet";
import { SEVERITY_CLASSNAMES, STATUS_CLASSNAMES } from "./defect-badges";

export default function DefectsTable({ defects, suiteSlug, iterationNumber }: { defects: defect[]; suiteSlug: string; iterationNumber: number | null }) {
	const [selectedId, setSelectedId] = useState<string | null>(null)
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
				// Null step order means overall feedback; several cited remarks list each step once.
				const refs = row.original.references;
				if (refs.length === 0) return <p className="text-xs text-muted-foreground">—</p>;
				const steps = [...new Set(refs.filter((r) => r.stepOrder !== null).map((r) => r.stepOrder as number + 1))];
				const parts = [...steps.map((n) => `Step ${n}`), ...(refs.some((r) => r.stepOrder === null) ? ["Overall feedback"] : [])];
				return <p className="text-xs" title={refs.map((r) => r.stepText).filter(Boolean).join(" / ") || undefined}>{parts.join(", ")}</p>;
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
		<>
			<DataTable columns={columns} data={defects} onRowClick={(row) => setSelectedId(row.id)} emptyTitle="No defects" emptyDescription="No defects have been logged in this round yet." />
			<DefectSheet defect={defects.find((d) => d.id === selectedId) ?? null} suiteSlug={suiteSlug} iterationNumber={iterationNumber} onClose={() => setSelectedId(null)} />
		</>
	)
}
