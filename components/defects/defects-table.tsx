"use client"

import { createColumnHelper } from "@tanstack/react-table";
import { useState } from "react";
import { CircleCheck, CircleDot, CircleSlash, ExternalLink } from "lucide-react";
import { DataTableFeatures } from "@/components/table/data-table-features";
import { DataTable } from "@/components/table/data-table";
import { Badge } from "@/components/ui/badge";
import { DEFECT_SEVERITIES, DEFECT_STATUS_LABELS, defectRef } from "@/lib/supabase/defect-format";
import type { defect, defectSeverity, defectStatus } from "@/lib/supabase/defects";
import { cn, humanizeTimestamp } from "@/lib/utils";
import { DefectSheet } from "./defect-sheet";
import { SEVERITY_CLASSNAMES, SEVERITY_ICONS } from "./defect-badges";
import { Button } from "../ui/button";

type SummaryCellProps = {
	summary: string;
	reference: string;
	status: defectStatus;
	severity: defectSeverity;
};

const STATUS_ICONS = {
	open: { icon: CircleDot, className: "text-emerald-600" },
	resolved: { icon: CircleCheck, className: "text-purple-600" },
	wont_fix: { icon: CircleSlash, className: "text-stone-400" },
} as const;

const SummaryCell = ({ summary, reference, status, severity }: SummaryCellProps) => {
	const { icon: StatusIcon, className } = STATUS_ICONS[status];
	const SeverityIcon = SEVERITY_ICONS[severity];
	return (
		<div className="flex flex-row gap-2 items-start">
			<StatusIcon size={20} className={`shrink-0 ${className}`} aria-label={DEFECT_STATUS_LABELS[status]} />
			<div className="flex flex-col gap-1 mt-0.5">
				<p className="font-semibold text-xs">{summary}</p>
				<p className="text-xs font-mono text-muted-foreground">{reference}</p>
			</div>
			<Badge variant="outline" className={cn(SEVERITY_CLASSNAMES[severity], "text-xs font-mono font-semibold")}><SeverityIcon data-icon="inline-start" />{DEFECT_SEVERITIES.find((s) => s.value === severity)?.label}</Badge>
		</div>
	)
};

export default function DefectsTable({ defects, suiteSlug, iterationNumber }: { defects: defect[]; suiteSlug: string; iterationNumber: number | null }) {
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const columnHelper = createColumnHelper<DataTableFeatures, defect>()

	const columns = columnHelper.columns([
		columnHelper.display({
			id: "summary",
			header: "Defects",
			cell: ({ row }) => <SummaryCell severity={row.original.severity} status={row.original.status} reference={defectRef(row.original)} summary={row.original.summary} />,
		}),
	
		columnHelper.display({
			id: "jira",
			header: () => <div className="flex justify-end font-mono text-xs text-muted-foreground">{defects.length} reported</div>,
			cell: ({ row }) => {
				const jiraUrl = row.original.externalRefs[0]?.url;
				if (!jiraUrl) return null;
				return (
					<Button variant="ghost" size="icon" aria-label="Open external link" onClick={(e) => { e.stopPropagation(); window.open(jiraUrl, "_blank", "noopener,noreferrer") }}>
						<ExternalLink size={16} />
					</Button>
				);
			},
		}),
	])

	return (
		<>
			<DataTable columns={columns} data={defects} onRowClick={(row) => setSelectedId(row.id)} emptyTitle="No defects" emptyDescription="No defects have been logged in this round yet." />
			<DefectSheet defect={defects.find((d) => d.id === selectedId) ?? null} suiteSlug={suiteSlug} iterationNumber={iterationNumber} onClose={() => setSelectedId(null)} />
		</>
	)
}
