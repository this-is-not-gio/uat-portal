"use client"

import { createColumnHelper } from "@tanstack/react-table"
import { type DataTableFeatures } from "./data-table-features"
import { TestingSuites } from "@/lib/supabase/Init"
import { TestCase } from "../types"
import { Ban, CircleCheck, CircleX, Info, TestTube, TestTubeDiagonal, TestTubes, TriangleAlert } from "lucide-react"
import { Badge } from "../ui/badge"
import { testCase } from "@/lib/supabase/test-cases"
import { cn, humanizeTimestamp } from "@/lib/utils"


// export type testCaseStatus = "Untested" | "In Progress" | "Passed" | "Failed";
export const TestStatusMapping = {
	"Untested": {
		icon: TestTubes,
		variant: "outline",
		className: "bg-gray-100 text-gray-800",
	},
	"In Progress": {
		icon: TestTubeDiagonal,
		variant: "secondary",
		className: "bg-gray-100 text-gray-800",
	},
	"Passed": {
		icon: CircleCheck,
		variant: "default",
		className: "bg-green-100 text-green-800",
	},
	"Failed": {
		icon: CircleX,
		variant: "destructive",
		className: "bg-red-100 text-red-800",
	},
	"Blocked": {
		icon: Ban,
		variant: "secondary",
		className: "bg-gray-200 text-gray-800",
	}
} as const



const READINESS_LABELS: Record<string, string> = {
	no_steps: "No steps",
	step_without_expected_result: "Step missing expected result",
};

const SYNC_MARKERS = {
	not_in_round: { label: "🆕 Not in round", className: "border-blue-600/40 bg-blue-50 text-blue-800" },
	changed: { label: "✏️ Changed", className: "border-amber-600/40 bg-amber-50 text-amber-800" },
	outdated: { label: "⚠️ Outdated · retest next round", className: "border-red-600/40 bg-red-50 text-red-800" },
} as const;

const columnHelper = createColumnHelper<DataTableFeatures, testCase>()

export const columns = columnHelper.columns([
	columnHelper.display({
		cell: (info) => {
			const status = TestStatusMapping[info.row.original.status as keyof typeof TestStatusMapping];
			const Icon = status?.icon || Info;
			const classNameVariant = status?.className || "bg-gray-100 text-gray-800";
			return (
				<div className="flex flex-row justify-between items-center gap-1">
					<div className="flex flex-row items-center gap-4">
							<Icon data-icon="inline-start" size={15} className={`text-${info.row.original.status === "Passed" ? "green-800" : info.row.original.status === "Failed" ? "red-500" : "gray-500"}`} />
						<div className="">
							<div className="flex flex-row items-center gap-2">
								<p className="text-sm">{info.row.original.title}</p>
								<Badge variant="secondary" className="text-xs">{info.row.original.stepsToExecute?.length ?? 0} steps</Badge>
								{info.row.original.lifecycleStatus === "updated" && (
									<Badge variant="outline" className="text-xs">Updated</Badge>
								)}
								{/* Set by the Test Cases tab while a round runs: where this live case stands vs the round. */}
								{(() => {
									const marker = (info.row.original as testCase & { syncMarker?: keyof typeof SYNC_MARKERS }).syncMarker;
									return marker ? (
										<Badge variant="outline" className={`text-xs ${SYNC_MARKERS[marker].className}`}>{SYNC_MARKERS[marker].label}</Badge>
									) : null;
								})()}
								{/* Set by the Test Cases tab while the suite is Draft/Ready: what blocks Mark ready. */}
								{((info.row.original as testCase & { readinessIssues?: string[] }).readinessIssues ?? []).map((issue) => (
									<Badge key={issue} variant="outline" className="text-xs border-amber-600/50 bg-amber-50 text-amber-800">
										<TriangleAlert data-icon="inline-start" size={12} />
										{READINESS_LABELS[issue] ?? issue}
									</Badge>
								))}
							</div>
							<p className="text-xs text-muted-foreground">{info.row.original.code}</p>
							{/* <p className="text-xs text-muted-foreground">{info.row.original.id}</p> */}
						</div>
					</div>
				</div>
			)
		},
		header: "Test Cases",
	}),
	columnHelper.accessor("roleAssignee", {
		header: "Role Assignee",
		cell: (info) => (
			<p className="text-xs text-muted-foreground">{info.getValue()}</p>
		)
	}),
	columnHelper.accessor("status", {
		header: "Status",
		cell: (info) => {
			const status = TestStatusMapping[info.getValue() as keyof typeof TestStatusMapping];
			const Icon = status?.icon || Info;
			const variant = status?.variant || "outline";
			return (
				<Badge className={`text-xs ${info.getValue() === "Passed" ? "bg-green-100 text-green-800" : ""}`} variant={variant || "outline"}>
					<Icon data-icon="inline-start" size={15} className={`text-${info.getValue() === "Passed" ? "green-800" : "gray-500"}`} />
					{info.getValue()}
				</Badge>
			)
		}
	}),
	columnHelper.display({
		cell: (info) => (
			<div className="flex flex-col items-end justify-end gap-2">
				<p className="text-xs text-muted-foreground">{humanizeTimestamp(info.row.original.created_at)}</p>
			</div>
		),
		header: "Timestamp",
	})
])
