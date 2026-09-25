"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import type { testIteration } from "@/lib/supabase/test-iterations"
import { Badge } from "../ui/badge"
import { CircleCheck, RotateCwFadingClock } from "lucide-react"

const ITERATION_STATUS_MAPPING = {
	in_progress: { label: "In Progress", icon: RotateCwFadingClock, className: "bg-blue-50 text-blue-800 border-blue-600/40" },
	completed: { label: "Completed", icon: CircleCheck, className: "bg-green-50 text-green-800 border-green-600/40" },
} as const

const columnHelper = createColumnHelper<DataTableFeatures, testIteration>()

export function getIterationColumns() {
	return columnHelper.columns([
		columnHelper.display({
			id: "name",
			header: "Iteration",
			cell: (info) => (
				<div className="flex flex-col">
					<p className="text-sm">{info.row.original.name}</p>
					<p className="text-xs text-muted-foreground">Round {info.row.original.iterationNumber}</p>
				</div>
			),
		}),
		columnHelper.accessor("status", {
			header: "Status",
			cell: (info) => {
				const status = ITERATION_STATUS_MAPPING[info.getValue()]
				const Icon = status.icon
				return (
					<Badge variant="outline" className={`text-xs ${status.className}`}>
						<Icon data-icon="inline-start" size={12} />
						{status.label}
					</Badge>
				)
			},
		}),
		columnHelper.accessor("startedAt", {
			header: "Started",
			cell: (info) => <p className="text-xs text-muted-foreground">{new Date(info.getValue()).toLocaleDateString()}</p>,
		}),
		columnHelper.accessor("completedAt", {
			header: "Completed",
			cell: (info) => (
				<p className="text-xs text-muted-foreground">
					{info.getValue() ? new Date(info.getValue() as string).toLocaleDateString() : "—"}
				</p>
			),
		}),
	])
}
